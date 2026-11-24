/**
 * Parsing / matching helpers for the homepage hot-zone enrichment.
 *
 * This is intentionally narrower than the full metadata anchoring layer:
 * one TMDB `search/multi` result per title, with hard vetoes on year and
 * movie/TV type. Alias-based anchoring belongs to the later full layer.
 */

import type { TmdbSearchItem } from '@/lib/api/tmdb-source';

export type ContentKind = 'movie' | 'tv';

export interface HotAnchorInput {
  key: string;
  title: string;
  year?: string;
  type: ContentKind;
}

export type AnchorConfidence = 'high' | 'medium' | 'low';

export interface HotAnchorMatch {
  item: TmdbSearchItem;
  score: number;
  confidence: AnchorConfidence;
  titleExact: boolean;
}

export function toContentKind(value: unknown): ContentKind {
  if (value === 'tv' || value === '电视剧' || value === '剧集') return 'tv';
  return 'movie';
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/第\d+季/g, '')
    .replace(/(电视剧|电影|剧集)/g, '')
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

function extractYear(value: string | undefined): number | null {
  const match = value?.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function candidateTitles(item: TmdbSearchItem): string[] {
  return [item.title, item.name, item.original_title, item.original_name]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map(normalizeTitle)
    .filter(Boolean);
}

/**
 * Picks the best TMDB candidate. Year/type conflicts are hard vetoes; a
 * low-confidence result is returned as null so the UI keeps Douban data.
 */
export function pickBestTmdbMatch(
  input: HotAnchorInput,
  candidates: TmdbSearchItem[]
): HotAnchorMatch | null {
  const wantedTitle = normalizeTitle(input.title);
  const wantedYear = extractYear(input.year);
  if (!wantedTitle) return null;

  let best: HotAnchorMatch | null = null;

  for (const item of candidates) {
    if (toContentKind(item.media_type) !== input.type) continue;

    const candidateYear = extractYear(item.release_date ?? item.first_air_date);
    if (wantedYear !== null && candidateYear !== null && Math.abs(wantedYear - candidateYear) > 1) {
      continue;
    }

    const titles = candidateTitles(item);
    const titleExact = titles.includes(wantedTitle);
    const titleSimilar = titles.some(
      (title) => title.includes(wantedTitle) || wantedTitle.includes(title)
    );
    if (!titleExact && !titleSimilar) continue;

    const score =
      4.0 * (titleExact ? 1 : 0) +
      1.5 * (titleSimilar && !titleExact ? 1 : 0) +
      0.8 +
      (wantedYear !== null && candidateYear !== null ? 0.6 : 0) +
      (item.overview ? 0.3 : 0) +
      (item.backdrop_path ? 0.3 : 0);

    const confidence: AnchorConfidence = score >= 5.0 ? 'high' : score >= 3.5 ? 'medium' : 'low';
    if (confidence === 'low') continue;
    if (!best || score > best.score) {
      best = { item, score, confidence, titleExact };
    }
  }

  return best;
}
