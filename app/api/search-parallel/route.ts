/**
 * Parallel Streaming Search API Route
 * Searches all sources in parallel and streams results immediately as they arrive.
 * Supports abort via request.signal when clients disconnect.
 * Caps results per source and total to prevent OOM.
 */

import { NextRequest } from 'next/server';
import { searchVideos } from '@/lib/api/client';
import { getSourceName } from '@/lib/utils/source-names';
import { traditionalToSimplified } from '@/lib/utils/chinese-convert';
import type { VideoItem, VideoSource } from '@/lib/types';

export const runtime = 'nodejs';

const MAX_TOTAL_VIDEOS = 2000;
const PER_SOURCE_TIMEOUT_MS = 20000;

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Use the request signal for abort detection
      const signal = request.signal;

      const safeSend = (data: object) => {
        if (signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller may be closed
        }
      };

      try {
        const body = await request.json() as {
            query?: unknown;
            sources?: VideoSource[];
            page?: unknown;
        };
        const { query, sources: sourceConfigs, page: requestedPage } = body;

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
          safeSend({ type: 'error', message: 'Invalid query' });
          controller.close();
          return;
        }

        const pageNumber = Number(requestedPage);
        const startPage =
          Number.isFinite(pageNumber) && pageNumber > 0 ? Math.floor(pageNumber) : 1;

        const normalizedQuery = traditionalToSimplified(query.trim());
        const sources = Array.isArray(sourceConfigs) && sourceConfigs.length > 0
          ? sourceConfigs
          : [];

        if (sources.length === 0) {
          safeSend({ type: 'error', message: 'No valid sources provided' });
          controller.close();
          return;
        }

        safeSend({ type: 'start', totalSources: sources.length });

        let completedSources = 0;
        let totalVideosFound = 0;
        let maxPageCount = 1;

        const searchPromises = sources.map(async (source: VideoSource) => {
          if (signal.aborted) return;

          const startTime = performance.now();

          // Per-source timeout via AbortController
          const sourceController = new AbortController();
          const sourceTimeout = setTimeout(
            () => sourceController.abort(),
            PER_SOURCE_TIMEOUT_MS
          );

          // Cascade request abort to source controller
          const onRequestAbort = () => sourceController.abort();
          signal.addEventListener('abort', onRequestAbort, { once: true });

          try {
            const result = await searchVideos(
              normalizedQuery, [source], startPage, sourceController.signal
            );
            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);
            const rawVideos = result[0]?.results || [];
            const pagecount = result[0]?.pagecount ?? 1;
            if (pagecount > maxPageCount) maxPageCount = pagecount;

            const remaining = Math.max(0, MAX_TOTAL_VIDEOS - totalVideosFound);
            const videos = rawVideos.slice(0, remaining);

            completedSources++;
            totalVideosFound += videos.length;

            if (videos.length > 0 && !signal.aborted) {
              safeSend({
                type: 'videos',
                videos: videos.map((video: VideoItem) => ({
                  ...video,
                  sourceDisplayName: getSourceName(source.id),
                  latency,
                })),
                source: source.id,
                pagecount,
                completedSources,
                totalSources: sources.length,
                latency,
              });
            }

            safeSend({
              type: 'progress',
              completedSources,
              totalSources: sources.length,
              totalVideosFound,
            });
          } catch (error) {
            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);
            console.error(
              `[Search] Source ${source.id} failed after ${latency}ms:`,
              error
            );
            completedSources++;

            safeSend({
              type: 'progress',
              completedSources,
              totalSources: sources.length,
              totalVideosFound,
            });
          } finally {
            clearTimeout(sourceTimeout);
            signal.removeEventListener('abort', onRequestAbort);
          }
        });

        await Promise.all(searchPromises);

        if (!signal.aborted) {
          safeSend({
            type: 'complete',
            totalVideosFound,
            totalSources: sources.length,
            maxPageCount,
          });
        }

        controller.close();
      } catch (error) {
        if (!signal.aborted) {
          console.error('Search error:', error);
          safeSend({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
