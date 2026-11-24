/**
 * Minimal TMDB adapter for homepage metadata enrichment.
 *
 * - Single credential value, auto-detected by shape (see lib/server/tmdb-env.ts).
 * - Two API bases: primary plus the reachable legacy domain for mainland China.
 * - A 401 means "credential invalid" and never triggers a second domain attempt.
 * - No image-gallery calls: search results already provide poster/backdrop/overview.
 */

import { getTmdbCredential, type TmdbCredential } from '@/lib/server/tmdb-env';

const TMDB_API_BASES = ['https://api.themoviedb.org/3', 'https://api.tmdb.org/3'] as const;
const REQUEST_TIMEOUT_MS = 6000;

export class TmdbAuthError extends Error {
  constructor(message = 'TMDB credential is missing or invalid') {
    super(message);
    this.name = 'TmdbAuthError';
  }
}

export class TmdbUnavailableError extends Error {
  constructor(message = 'TMDB is unreachable') {
    super(message);
    this.name = 'TmdbUnavailableError';
  }
}

export interface TmdbSearchItem {
  id: number;
  media_type: 'movie' | 'tv';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
}

interface TmdbSearchResponse {
  results?: TmdbSearchItem[];
}

function buildUrl(
  base: string,
  path: string,
  params: Record<string, string | number | undefined>,
  credential: TmdbCredential
): URL {
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  if (credential.mode === 'v3') {
    url.searchParams.set('api_key', credential.value);
  }
  return url;
}

async function tmdbRequest<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  signal?: AbortSignal
): Promise<T> {
  const credential = getTmdbCredential();
  if (!credential.mode) throw new TmdbAuthError();

  let lastError: unknown;

  for (const base of TMDB_API_BASES) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (credential.mode === 'v4') {
        headers.Authorization = `Bearer ${credential.value}`;
      }

      const response = await fetch(buildUrl(base, path, params, credential), {
        headers,
        signal: controller.signal,
        cache: 'no-store',
      });

      // Invalid credential is terminal: retrying another domain cannot help.
      if (response.status === 401) throw new TmdbAuthError();
      if (!response.ok) {
        lastError = new Error(`TMDB responded ${response.status}`);
        continue;
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof TmdbAuthError) throw error;
      lastError = error;
    } finally {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onExternalAbort);
    }
  }

  throw new TmdbUnavailableError(
    lastError instanceof Error ? lastError.message : undefined
  );
}

/** One request covers both movies and TV; person results are dropped. */
export async function searchMulti(query: string, signal?: AbortSignal): Promise<TmdbSearchItem[]> {
  const data = await tmdbRequest<TmdbSearchResponse>(
    '/search/multi',
    {
      query,
      language: 'zh-CN',
      region: 'CN',
      include_adult: 'false',
    },
    signal
  );
  return (data.results ?? []).filter(
    (item) => item.media_type === 'movie' || item.media_type === 'tv'
  );
}

export function tmdbImageUrl(
  path: string | null | undefined,
  size: 'w500' | 'w780' | 'w1280' = 'w500'
): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith('/') ? path : `/${path}`}`;
}
