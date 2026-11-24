/**
 * Batch metadata enrichment for the homepage hot zone.
 *
 * Input is the Douban-backed entity list; output adds TMDB backdrop/overview
 * only when a high-enough-confidence match is found. Every failure mode is
 * silent and returns provider: "none", so the UI can render Douban data alone.
 */

import { NextResponse } from 'next/server';
import {
  searchMulti,
  tmdbImageUrl,
  TmdbAuthError,
  TmdbUnavailableError,
} from '@/lib/api/tmdb-source';
import {
  pickBestTmdbMatch,
  toContentKind,
  type HotAnchorInput,
} from '@/lib/api/metadata-parser';

export const runtime = 'nodejs';

const MAX_ENTITIES = 20;
const HIT_TTL = 30 * 24 * 60 * 60 * 1000;
const MISS_TTL = 5 * 60 * 1000;

interface CacheEntry {
  at: number;
  result: HotResult | null;
  miss: boolean;
}

interface HotResult {
  key: string;
  matched: boolean;
  provider: 'tmdb' | 'none';
  confidence: 'high' | 'medium' | 'low';
  score: number;
  tmdbId?: number;
  title?: string;
  year?: string;
  overview?: string;
  backdrop?: string | null;
  poster?: string | null;
  voteAverage?: number;
  voteCount?: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();

function unmatched(key: string): HotResult {
  return {
    key,
    matched: false,
    provider: 'none',
    confidence: 'low',
    score: 0,
  };
}

function cacheKey(input: HotAnchorInput): string {
  return `${input.type}|${input.title}|${input.year ?? ''}`;
}

function readCache(key: string): CacheEntry | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  const ttl = entry.miss ? MISS_TTL : HIT_TTL;
  if (Date.now() - entry.at > ttl) {
    cache.delete(key);
    return undefined;
  }
  return entry;
}

function yearFromItem(value: string | undefined): string | undefined {
  return value?.slice(0, 4);
}

async function enrich(input: HotAnchorInput, signal: AbortSignal): Promise<CacheEntry> {
  try {
    const candidates = await searchMulti(input.title, signal);
    const match = pickBestTmdbMatch(input, candidates);
    if (!match) {
      return { at: Date.now(), result: null, miss: true };
    }

    const result: HotResult = {
      key: input.key,
      matched: true,
      provider: 'tmdb',
      confidence: match.confidence,
      score: Number(match.score.toFixed(2)),
      tmdbId: match.item.id,
      title: match.item.title ?? match.item.name,
      year: yearFromItem(match.item.release_date ?? match.item.first_air_date),
      overview: match.item.overview ?? '',
      backdrop: tmdbImageUrl(match.item.backdrop_path, 'w1280'),
      // Only overwrite the Douban poster when the match is unambiguous.
      poster:
        match.confidence === 'high' ? tmdbImageUrl(match.item.poster_path, 'w500') : null,
      voteAverage: match.item.vote_average,
      voteCount: match.item.vote_count,
    };
    return { at: Date.now(), result, miss: false };
  } catch (error) {
    // Auth/network failures are transient: never write a miss entry for them.
    if (error instanceof TmdbAuthError || error instanceof TmdbUnavailableError) {
      return { at: Date.now(), result: null, miss: false };
    }
    return { at: Date.now(), result: null, miss: false };
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rawEntities: unknown[] = Array.isArray(body?.entities) ? body.entities : [];
  const entities: HotAnchorInput[] = rawEntities
    .slice(0, MAX_ENTITIES)
    .map((raw, index): HotAnchorInput | null => {
      const item = raw as Record<string, unknown>;
      const title = typeof item?.title === 'string' ? item.title.trim() : '';
      if (!title) return null;
      return {
        key: typeof item?.key === 'string' ? item.key : `${index}`,
        title,
        year: typeof item?.year === 'string' ? item.year : undefined,
        type: toContentKind(item?.type),
      } satisfies HotAnchorInput;
    })
    .filter((item): item is HotAnchorInput => item !== null);

  const signal =
    typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(10000) : undefined;

  const results = await Promise.all(
    entities.map(async (entity) => {
      const key = cacheKey(entity);
      let entry = readCache(key);

      if (!entry) {
        let pending = inflight.get(key);
        if (!pending) {
          pending = enrich(entity, signal ?? new AbortController().signal);
          inflight.set(key, pending);
        }
        try {
          entry = await pending;
          if (!entry.miss) cache.set(key, entry);
        } finally {
          inflight.delete(key);
        }
      }

      return entry?.result ?? unmatched(entity.key);
    })
  );

  return NextResponse.json({ results });
}
