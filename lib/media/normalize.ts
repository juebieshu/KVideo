/**
 * Media title normalization.
 * Produces a stable grouping title plus year / season hints.
 */

import { traditionalToSimplified } from '@/lib/utils/chinese-convert';
import { htmlToText } from '@/lib/utils/html';

export interface ParsedMediaTitle {
  /** Normalized title used for grouping. */
  title: string;
  /** Human-readable title with noise removed. */
  displayTitle: string;
  year?: string;
  season?: number;
}

const SEASON_SOURCES = [
  '第\\s*([0-9一二三四五六七八九十百两]+)\\s*季',
  '\\bseason\\s*([0-9]{1,2})\\b',
  '(?:^|[\\s._-])s\\s*([0-9]{1,2})(?=$|[\\s._-])',
];

const YEAR_SOURCE = '(?<!\\d)((?:19|20)\\d{2})(?!\\d)';

const MAX_SYNOPSIS_LENGTH = 400;

const EPISODE_PATTERNS = [
  /(\d{1,4})\s*[-~至]\s*(\d{1,4})\s*[集话話期]/,
  /(?:全|共)\s*(\d{1,4})\s*[集话話期]/,
  /(?:更新至|连载至|更新)\s*(?:第)?\s*(\d{1,4})\s*[集话話期]/,
  /(?:第)?\s*(\d{1,4})\s*[集话話期](?:全)?/,
];

const EXPLICIT_EPISODE_PATTERN = /(?:全|共|更新至|连载至)\s*(?:第)?\s*\d{1,4}\s*[集话話期]/;

const NOISE_SOURCES = [
  '\\b(?:hd|fhd|uhd|4k|8k|2k|2160p|1440p|1080p|720p|540p|480p|360p|hdts|web-?dl|webrip|bluray|bdrip|bd|hdr|dolby|tc|ts)\\b',
  '(?:蓝光|高清版?|超清版?|标清|修复版|导演剪辑版|加长版|未删减版?|无删减版?|完整版|国语|粤语|英语|双语|中字|中文字幕|简繁字幕|简体字幕|繁体字幕|简体|繁体|字幕)',
  '(?:全|共)\\s*\\d+\\s*集',
  '更新至?\\s*\\d+\\s*集',
  '第\\s*[0-9一二三四五六七八九十百]+\\s*集',
  '(?:已)?完结',
  '全集',
  '连载中',
];

const CHINESE_DIGITS: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

function chineseNumberToArabic(input: string): number | null {
  if (/^\d+$/.test(input)) {
    return parseInt(input, 10);
  }

  if (input === '十') return 10;

  const tenIndex = input.indexOf('十');
  if (tenIndex >= 0) {
    const tens = tenIndex === 0 ? 1 : CHINESE_DIGITS[input[tenIndex - 1]] ?? 0;
    const ones = tenIndex === input.length - 1 ? 0 : CHINESE_DIGITS[input[tenIndex + 1]] ?? 0;
    const value = tens * 10 + ones;
    return value > 0 ? value : null;
  }

  if (input.length === 1) {
    return CHINESE_DIGITS[input] ?? null;
  }

  return null;
}

function stripNoise(text: string): string {
  return NOISE_SOURCES.reduce(
    (current, source) => current.replace(new RegExp(source, 'gi'), ' '),
    text,
  );
}

function unwrapBrackets(text: string): string {
  return text.replace(/[\[【(（]([^\]】)）]*)[\]】)）]/g, (_match, inner: string) => {
    const cleanedInner = stripNoise(inner).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    return cleanedInner ? ` ${cleanedInner} ` : ' ';
  });
}

export function extractSeason(title: string): number | undefined {
  for (const source of SEASON_SOURCES) {
    const match = new RegExp(source, 'i').exec(title);
    if (match) {
      const season = chineseNumberToArabic(match[1]);
      if (season !== null) return season;
    }
  }
  return undefined;
}

function removeSeasonMarkers(title: string): string {
  return SEASON_SOURCES.reduce(
    (current, source) => current.replace(new RegExp(source, 'gi'), ' '),
    title,
  );
}

export function extractYearFromTitle(title: string): string | undefined {
  return new RegExp(YEAR_SOURCE).exec(title)?.[1];
}

function removeYear(title: string): string {
  return title.replace(new RegExp(YEAR_SOURCE, 'g'), ' ');
}

export function normalizeYear(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const year = Math.trunc(value);
    return year >= 1900 && year <= 2099 ? String(year) : undefined;
  }

  if (typeof value === 'string') {
    const match = value.match(/(?:19|20)\d{2}/);
    return match?.[0];
  }

  return undefined;
}

function firstEpisodeCount(text: string): number | undefined {
  for (const pattern of EPISODE_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;

    const value = parseInt(match[match.length - 1], 10);
    if (Number.isInteger(value) && value >= 1 && value <= 2000) return value;
  }

  return undefined;
}

/**
 * Extract the episode count from remarks, falling back to explicit markers
 * in the title. Titles without 全/共/更新至 markers are ignored to avoid
 * treating a number that is part of the title as an episode count.
 */
export function extractEpisodeCount(
  remarks?: string | null,
  title?: string | null,
): number | undefined {
  const fromRemarks = firstEpisodeCount(htmlToText(remarks || ''));
  if (fromRemarks !== undefined) return fromRemarks;

  const titleText = htmlToText(title || '');
  if (!EXPLICIT_EPISODE_PATTERN.test(titleText)) return undefined;

  return firstEpisodeCount(titleText);
}

export function normalizeMediaTitle(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

const PEOPLE_LABEL_PATTERN = /(?:主演|导演|演员|配音|编剧|制片人|出品人|监制|directors?|actors?|starring|cast)\s*[:：]?/gi;
const ROLE_SUFFIX_PATTERN = /(?:饰演|饰)\s*[\p{L}\p{N}·]+/gu;
const PEOPLE_SEPARATOR_PATTERN = /[,，、/|;；&\\·•・\s]+/u;
const PEOPLE_NOISE = new Set([
  '等',
  '暂无',
  '未知',
  '内详',
  '无',
  '不详',
  'null',
  'undefined',
  'none',
  'n/a',
  'na',
]);

/**
 * Normalize a cast or director list into comparable names.
 * Labels, role annotations and separators are removed; names are deduplicated.
 */
export function normalizePeople(value?: string | null): string[] {
  if (!value) return [];

  const text = traditionalToSimplified(htmlToText(value))
    .normalize('NFKC')
    .toLowerCase()
    .replace(ROLE_SUFFIX_PATTERN, ' ')
    .replace(PEOPLE_LABEL_PATTERN, ' ');

  const seen = new Set<string>();
  const names: string[] = [];

  for (const part of text.split(PEOPLE_SEPARATOR_PATTERN)) {
    const name = part.replace(/[^\p{L}\p{N}]+/gu, '');
    if (name.length < 2 || PEOPLE_NOISE.has(name) || seen.has(name)) continue;

    seen.add(name);
    names.push(name);
    if (names.length >= 20) break;
  }

  return names;
}

/**
 * Normalize a synopsis for similarity comparison.
 * HTML is flattened, traditional Chinese converted to simplified, and
 * punctuation/whitespace removed. The result is capped to bound comparison cost.
 */
export function normalizeSynopsis(value?: string | null): string {
  if (!value) return '';

  const text = traditionalToSimplified(htmlToText(value).slice(0, MAX_SYNOPSIS_LENGTH));

  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, MAX_SYNOPSIS_LENGTH);
}

export function parseMediaTitle(rawTitle: string, fallbackYear?: unknown): ParsedMediaTitle {
  const source = traditionalToSimplified(rawTitle || '').normalize('NFKC').trim();

  const season = extractSeason(source);
  let text = season === undefined ? source : removeSeasonMarkers(source);

  const titleYear = extractYearFromTitle(text);
  if (titleYear) {
    const withoutYear = removeYear(text).trim();
    if (withoutYear) text = withoutYear;
  }

  text = unwrapBrackets(stripNoise(text))
    .replace(/[\[\]【】()（）]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const displayTitle = text || source || rawTitle.trim();
  const normalized = normalizeMediaTitle(displayTitle) || normalizeMediaTitle(rawTitle);

  return {
    title: normalized,
    displayTitle,
    year: normalizeYear(fallbackYear) ?? titleYear,
    season,
  };
}
