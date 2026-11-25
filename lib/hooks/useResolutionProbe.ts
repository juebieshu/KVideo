'use client';

import { useState, useEffect, useRef, useMemo, useCallback, useSyncExternalStore } from 'react';
import type { VideoSource } from '@/lib/types';
import { settingsStore } from '@/lib/store/settings-store';
import {
  getCachedResolution,
  setCachedResolution,
  shouldReuseCachedResolution,
  type ResolutionCacheEntry,
} from '@/lib/player/resolution-cache';

export type ResolutionInfo = ResolutionCacheEntry;

interface VideoToProbe {
  id: string | number;
  source: string;
  episodeIndex?: number;
}

interface ResolutionProbeEvent {
  done?: boolean;
  id: string | number;
  source: string;
  episodeIndex?: number;
  resolution?: ResolutionInfo | null;
  resolutionOrigin?: 'manifest' | 'hint';
}

const EMPTY_RESOLUTIONS: Record<string, ResolutionInfo | null> = {};

function subscribeToResolutionCache(): () => void {
  return () => {};
}

function getServerResolutionSnapshot(): string {
  return '{}';
}

function getSourceConfigsForProbe(videos: VideoToProbe[]): VideoSource[] {
  if (typeof window === 'undefined' || videos.length === 0) {
    return [];
  }

  const configuredSources = new Map<string, VideoSource>();
  const { sources, premiumSources } = settingsStore.getSettings();

  [...sources, ...premiumSources].forEach((source) => {
    if (source?.id) {
      configuredSources.set(source.id, source);
    }
  });

  return Array.from(new Set(videos.map((video) => video.source)))
    .map((sourceId) => configuredSources.get(sourceId))
    .filter((source): source is VideoSource => !!source);
}

async function openResolutionProbeStream(
  videos: VideoToProbe[],
  signal: AbortSignal,
): Promise<ReadableStreamDefaultReader<Uint8Array> | null> {
  const sourceConfigs = getSourceConfigsForProbe(videos);
  const response = await fetch('/api/probe-resolution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videos, sourceConfigs }),
    signal,
  });

  if (!response.ok || !response.body) {
    return null;
  }

  return response.body.getReader();
}

/**
 * Hook that probes actual video resolutions via m3u8 manifests.
 * Returns a map of "source:id" -> ResolutionInfo.
 */
export function useResolutionProbe(videos: VideoToProbe[]): {
  resolutions: Record<string, ResolutionInfo | null>;
  isProbing: boolean;
} {
  const [resolutions, setResolutions] = useState<Record<string, ResolutionInfo | null>>({});
  const [completedRequestKeys, setCompletedRequestKeys] = useState<Set<string>>(() => new Set());
  const [settledVideos, setSettledVideos] = useState<VideoToProbe[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const completedKeysRef = useRef<Set<string>>(new Set());
  const inFlightKeysRef = useRef<Set<string>>(new Set());

  const getCachedResolutionSnapshot = useCallback(() => {
    const cached: Record<string, ResolutionInfo> = {};

    for (const video of videos ?? []) {
      const resultKey = `${video.source}:${video.id}`;
      const cachedInfo = getCachedResolution(video.source, video.id);

      if (cachedInfo && shouldReuseCachedResolution(cachedInfo, video.episodeIndex)) {
        cached[resultKey] = cachedInfo;
      }
    }

    return JSON.stringify(cached);
  }, [videos]);
  const cachedResolutionSnapshot = useSyncExternalStore(
    subscribeToResolutionCache,
    getCachedResolutionSnapshot,
    getServerResolutionSnapshot,
  );
  const cachedResolutions = useMemo<Record<string, ResolutionInfo | null>>(
    () => cachedResolutionSnapshot === '{}'
      ? EMPTY_RESOLUTIONS
      : JSON.parse(cachedResolutionSnapshot) as Record<string, ResolutionInfo>,
    [cachedResolutionSnapshot],
  );

  useEffect(() => {
    if (!videos || videos.length === 0) return;

    const inFlightKeys = inFlightKeysRef.current;
    const completedKeys = completedKeysRef.current;
    const needProbe: VideoToProbe[] = [];
    const batchRequestKeys: string[] = [];

    for (const video of videos) {
      const resultKey = `${video.source}:${video.id}`;
      const requestKey = `${video.source}:${video.id}:${video.episodeIndex ?? 0}`;
      const cachedInfo = getCachedResolution(video.source, video.id);

      if (
        !(cachedInfo && shouldReuseCachedResolution(cachedInfo, video.episodeIndex)) &&
        !completedKeys.has(requestKey) &&
        !inFlightKeys.has(requestKey)
      ) {
        needProbe.push(video);
        batchRequestKeys.push(requestKey);
        inFlightKeys.add(requestKey);
      }
    }

    if (needProbe.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    void openResolutionProbeStream(needProbe, controller.signal).then(async reader => {
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6)) as ResolutionProbeEvent;
            if (data.done) continue;

            const resultKey = `${data.source}:${data.id}`;
            const requestKey = `${data.source}:${data.id}:${data.episodeIndex ?? 0}`;
            inFlightKeys.delete(requestKey);
            completedKeys.add(requestKey);
            setCompletedRequestKeys(previous => new Set(previous).add(requestKey));

            if (data.resolution) {
              const resolution: ResolutionInfo = {
                ...data.resolution,
                origin: data.resolutionOrigin === 'hint' ? 'hint' : 'probed',
                episodeIndex: typeof data.episodeIndex === 'number' ? data.episodeIndex : undefined,
              };
              setCachedResolution(data.source, data.id, resolution);
              setResolutions((previous) => ({ ...previous, [resultKey]: resolution }));
            } else {
              setResolutions((previous) => ({ ...previous, [resultKey]: null }));
            }
          } catch {
            // Ignore malformed SSE chunks and continue reading.
          }
        }
      }
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.warn('[ResolutionProbe] Failed:', error);
      }
    }).finally(() => {
      for (const requestKey of batchRequestKeys) {
        inFlightKeys.delete(requestKey);
      }
      setSettledVideos(videos);
    });

    return () => {
      controller.abort();
      for (const requestKey of batchRequestKeys) {
        inFlightKeys.delete(requestKey);
      }
    };
  }, [videos]);

  const isProbing = settledVideos !== videos && (videos ?? []).some(video => {
    const resultKey = `${video.source}:${video.id}`;
    const cachedInfo = cachedResolutions[resultKey];

    if (cachedInfo && shouldReuseCachedResolution(cachedInfo, video.episodeIndex)) {
      return false;
    }

    const requestKey = `${video.source}:${video.id}:${video.episodeIndex ?? 0}`;
    return !completedRequestKeys.has(requestKey);
  });
  const mergedResolutions = useMemo(
    () => ({ ...cachedResolutions, ...resolutions }),
    [cachedResolutions, resolutions],
  );

  return { resolutions: mergedResolutions, isProbing };
}
