/**
 * Cross-source media grouping.
 * Merges same-title results conservatively: different year or season
 * always stay in separate groups.
 */

import type {
  MediaCandidate,
  MediaGroup,
  MergeConfidence,
  Video,
} from "@/lib/types";
import {
  extractEpisodeCount,
  normalizePeople,
  normalizeSynopsis,
  parseMediaTitle,
} from "./normalize";

interface PreparedMedia {
  video: Video;
  candidate: MediaCandidate;
  title: string;
  displayTitle: string;
  year?: string;
  season?: number;
  synopsis: string;
  actors: string[];
  directors: string[];
  episodeCount?: number;
  order: number;
}

interface YearPartition {
  year?: string;
  items: PreparedMedia[];
  confidence: MergeConfidence;
}

interface GroupedEntry {
  group: MediaGroup;
  order: number;
  year?: string;
  season?: number;
  normalizedTitles: string[];
  episodeCount?: number;
  items: PreparedMedia[];
  synopses: string[];
}

function prepareMedia(video: Video, order: number): PreparedMedia {
  const parsed = parseMediaTitle(video.vod_name, video.vod_year);

  return {
    video,
    candidate: {
      sourceId: video.source,
      vodId: video.vod_id,
      sourceName: video.sourceName || video.source,
      title: parsed.displayTitle,
      year: parsed.year,
      type: video.type_name,
      poster: video.vod_pic,
      remarks: video.vod_remarks,
    },
    title: parsed.title,
    displayTitle: parsed.displayTitle,
    year: parsed.year,
    season: parsed.season,
    synopsis: normalizeSynopsisCached(video),
    actors: normalizePeople(video.vod_actor),
    directors: normalizePeople(video.vod_director),
    episodeCount: extractEpisodeCount(video.vod_remarks, video.vod_name),
    order,
  };
}

const SYNOPSIS_CACHE_LIMIT = 4000;
const synopsisCache = new Map<string, { raw: string; normalized: string }>();

// Search results stream in batches; avoid re-normalizing the same synopsis on every batch.
function normalizeSynopsisCached(video: Video): string {
  const raw = video.vod_content || '';
  const key = `${video.source}:${String(video.vod_id)}`;
  const cached = synopsisCache.get(key);
  if (cached && cached.raw === raw) return cached.normalized;

  const normalized = normalizeSynopsis(raw);
  if (synopsisCache.size >= SYNOPSIS_CACHE_LIMIT) synopsisCache.clear();
  synopsisCache.set(key, { raw, normalized });
  return normalized;
}

function splitByYear(items: PreparedMedia[]): YearPartition[] {
  const byYear = new Map<string, PreparedMedia[]>();
  const missing: PreparedMedia[] = [];

  for (const item of items) {
    if (!item.year) {
      missing.push(item);
      continue;
    }

    const bucket = byYear.get(item.year);
    if (bucket) {
      bucket.push(item);
    } else {
      byYear.set(item.year, [item]);
    }
  }

  if (byYear.size === 0) {
    return [{ year: undefined, items: missing, confidence: "medium" }];
  }

  if (byYear.size === 1) {
    const [year, knownItems] = Array.from(byYear.entries())[0];
    return [
      {
        year,
        items: missing.length > 0 ? [...knownItems, ...missing] : knownItems,
        confidence: missing.length > 0 ? "medium" : "high",
      },
    ];
  }

  const partitions: YearPartition[] = Array.from(byYear.entries()).map(
    ([year, knownItems]) => ({
      year,
      items: knownItems,
      confidence: "high",
    }),
  );

  if (missing.length > 0) {
    partitions.push({ year: undefined, items: missing, confidence: "medium" });
  }

  return partitions;
}

export function buildMediaKey(input: {
  title: string;
  year?: string;
  season?: number;
}): string {
  return [
    input.title,
    input.year ?? "unknown",
    `s${input.season ?? 0}`,
  ].join("|");
}

function compareByLatency(a: PreparedMedia, b: PreparedMedia): number {
  const latencyA = a.video.latency;
  const latencyB = b.video.latency;

  if (latencyA === undefined && latencyB === undefined)
    return a.order - b.order;
  if (latencyA === undefined) return 1;
  if (latencyB === undefined) return -1;
  if (latencyA !== latencyB) return latencyA - latencyB;
  return a.order - b.order;
}

function resolveEpisodeCount(values: (number | undefined)[]): number | undefined {
  const counts = new Set<number>();
  for (const value of values) {
    if (value !== undefined) counts.add(value);
  }

  return counts.size === 1 ? Array.from(counts)[0] : undefined;
}

function buildGroup(partition: YearPartition): GroupedEntry {
  const ordered = [...partition.items].sort(compareByLatency);
  const representative = ordered[0];

  return {
    order: Math.min(...partition.items.map((item) => item.order)),
    year: partition.year,
    season: representative.season,
    normalizedTitles: collectTitles(ordered),
    episodeCount: resolveEpisodeCount(ordered.map((item) => item.episodeCount)),
    items: ordered,
    synopses: collectSynopses(ordered),
    group: {
      key: buildMediaKey({
        title: representative.title,
        year: partition.year,
        season: representative.season,
      }),
      title: representative.displayTitle,
      year: partition.year,
      type: representative.video.type_name,
      poster: representative.video.vod_pic,
      candidates: ordered.map((item) => item.candidate),
      confidence: partition.confidence,
    },
  };
}

const MIN_SYNOPSIS_LENGTH = 40;
const SYNOPSIS_DICE_THRESHOLD = 0.82;
const SYNOPSIS_PREFIX_LENGTH = 24;
const MAX_EXACT_MATCH_GROUPS = 12;
const MAX_FUZZY_BUCKET_SIZE = 60;

function collectTitles(items: PreparedMedia[]): string[] {
  const titles = new Set<string>();
  for (const item of items) {
    if (item.title) titles.add(item.title);
  }
  return Array.from(titles);
}

function collectSynopses(items: PreparedMedia[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    if (item.synopsis.length < MIN_SYNOPSIS_LENGTH || seen.has(item.synopsis)) {
      continue;
    }

    seen.add(item.synopsis);
    result.push(item.synopsis);
  }

  return result;
}

function canMergeEntries(left: GroupedEntry, right: GroupedEntry): boolean {
  if (left.year && right.year && left.year !== right.year) return false;
  if (
    left.season !== undefined &&
    right.season !== undefined &&
    left.season !== right.season
  ) {
    return false;
  }
  if (
    left.episodeCount !== undefined &&
    right.episodeCount !== undefined &&
    left.episodeCount !== right.episodeCount
  ) {
    return false;
  }

  return true;
}

function toBigrams(text: string): Set<string> {
  const grams = new Set<string>();
  for (let index = 0; index < text.length - 1; index += 1) {
    grams.add(text.slice(index, index + 2));
  }
  return grams;
}

function diceCoefficient(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;

  let overlap = 0;
  for (const gram of left) {
    if (right.has(gram)) overlap += 1;
  }

  return (2 * overlap) / (left.size + right.size);
}

function synopsesSimilar(
  left: string[],
  right: string[],
  bigramCache: Map<string, Set<string>>,
  threshold = SYNOPSIS_DICE_THRESHOLD,
): boolean {
  const getBigrams = (text: string): Set<string> => {
    const cached = bigramCache.get(text);
    if (cached) return cached;

    const grams = toBigrams(text);
    bigramCache.set(text, grams);
    return grams;
  };

  for (const leftText of left) {
    const leftGrams = getBigrams(leftText);
    for (const rightText of right) {
      if (diceCoefficient(leftGrams, getBigrams(rightText)) >= threshold) {
        return true;
      }
    }
  }

  return false;
}

function titlesSimilar(
  left: string[],
  right: string[],
  bigramCache: Map<string, Set<string>>,
): boolean {
  const getBigrams = (text: string): Set<string> => {
    const cached = bigramCache.get(text);
    if (cached) return cached;

    const grams = toBigrams(text);
    bigramCache.set(text, grams);
    return grams;
  };

  for (const leftTitle of left) {
    const leftGrams = getBigrams(leftTitle);
    for (const rightTitle of right) {
      if (diceCoefficient(leftGrams, getBigrams(rightTitle)) >= EPISODE_TITLE_DICE) {
        return true;
      }
    }
  }

  return false;
}

function combineEntries(cluster: GroupedEntry[]): GroupedEntry {
  const items = cluster.flatMap((entry) => entry.items).sort(compareByLatency);
  const representative = items[0];

  const seen = new Set<string>();
  const candidates: MediaCandidate[] = [];
  for (const item of items) {
    const key = `${item.candidate.sourceId}:${String(item.candidate.vodId)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(item.candidate);
  }

  const year = cluster.find((entry) => entry.year)?.year;
  const season = cluster.find((entry) => entry.season !== undefined)?.season;

  return {
    order: Math.min(...cluster.map((entry) => entry.order)),
    year,
    season,
    normalizedTitles: collectTitles(items),
    episodeCount: resolveEpisodeCount(cluster.map((entry) => entry.episodeCount)),
    items,
    synopses: collectSynopses(items),
    group: {
      key: buildMediaKey({ title: representative.title, year, season }),
      title: representative.displayTitle,
      year,
      type: representative.video.type_name,
      poster: representative.video.vod_pic,
      candidates,
      confidence: "medium",
    },
  };
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left];

  let overlap = 0;
  for (const value of smaller) {
    if (larger.has(value)) overlap += 1;
  }

  return overlap;
}

function mergeEntries(
  entries: GroupedEntry[],
  pairKeys: Set<string>,
  shouldMerge: (leftIndex: number, rightIndex: number) => boolean,
): GroupedEntry[] {
  if (entries.length <= 1) return entries;

  const parent = entries.map((_, index) => index);
  const clusterYears = entries.map((entry) => new Set(entry.year ? [entry.year] : []));
  const clusterSeasons = entries.map(
    (entry) => new Set(entry.season !== undefined ? [entry.season] : []),
  );
  const clusterEpisodes = entries.map(
    (entry) => new Set(entry.episodeCount !== undefined ? [entry.episodeCount] : []),
  );

  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) {
      parent[root] = parent[parent[root]];
      root = parent[root];
    }
    return root;
  };

  const canUnion = (left: number, right: number): boolean => {
    if (left === right) return false;

    if (clusterYears[left].size > 0 && clusterYears[right].size > 0) {
      const leftYear = Array.from(clusterYears[left])[0];
      const rightYear = Array.from(clusterYears[right])[0];
      if (leftYear !== rightYear) return false;
    }

    if (clusterSeasons[left].size > 0 && clusterSeasons[right].size > 0) {
      const leftSeason = Array.from(clusterSeasons[left])[0];
      const rightSeason = Array.from(clusterSeasons[right])[0];
      if (leftSeason !== rightSeason) return false;
    }

    if (clusterEpisodes[left].size > 0 && clusterEpisodes[right].size > 0) {
      const leftEpisodes = Array.from(clusterEpisodes[left])[0];
      const rightEpisodes = Array.from(clusterEpisodes[right])[0];
      if (leftEpisodes !== rightEpisodes) return false;
    }

    return true;
  };

  const union = (left: number, right: number): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (!canUnion(leftRoot, rightRoot)) return;

    parent[rightRoot] = leftRoot;
    for (const year of clusterYears[rightRoot]) clusterYears[leftRoot].add(year);
    for (const season of clusterSeasons[rightRoot]) clusterSeasons[leftRoot].add(season);
    for (const count of clusterEpisodes[rightRoot]) clusterEpisodes[leftRoot].add(count);
  };

  for (const pairKey of pairKeys) {
    const [left, right] = pairKey.split(":").map(Number);
    if (shouldMerge(left, right)) union(left, right);
  }

  const clusters = new Map<number, GroupedEntry[]>();
  entries.forEach((entry, index) => {
    const root = find(index);
    const cluster = clusters.get(root);
    if (cluster) {
      cluster.push(entry);
    } else {
      clusters.set(root, [entry]);
    }
  });

  return Array.from(clusters.values()).map((cluster) =>
    cluster.length === 1 ? cluster[0] : combineEntries(cluster),
  );
}

function mergeBySynopsis(entries: GroupedEntry[]): GroupedEntry[] {
  if (entries.length <= 1) return entries;

  const pairKeys = new Set<string>();
  const addPair = (left: number, right: number): void => {
    if (left === right) return;
    if (!canMergeEntries(entries[left], entries[right])) return;
    pairKeys.add(left < right ? `${left}:${right}` : `${right}:${left}`);
  };

  const exact = new Map<string, Set<number>>();
  entries.forEach((entry, index) => {
    for (const synopsis of entry.synopses) {
      const bucket = exact.get(synopsis);
      if (bucket) {
        bucket.add(index);
      } else {
        exact.set(synopsis, new Set([index]));
      }
    }
  });

  const oversizedSynopses = new Set<string>();
  for (const [synopsis, bucket] of exact) {
    if (bucket.size > MAX_EXACT_MATCH_GROUPS) {
      oversizedSynopses.add(synopsis);
      continue;
    }

    if (bucket.size < 2) continue;

    const indices = Array.from(bucket);
    for (let left = 0; left < indices.length; left += 1) {
      for (let right = left + 1; right < indices.length; right += 1) {
        addPair(indices[left], indices[right]);
      }
    }
  }

  const prefix = new Map<string, Set<number>>();
  const suffix = new Map<string, Set<number>>();
  entries.forEach((entry, index) => {
    for (const synopsis of entry.synopses) {
      if (oversizedSynopses.has(synopsis)) continue;

      const prefixKey = synopsis.slice(0, SYNOPSIS_PREFIX_LENGTH);
      const prefixBucket = prefix.get(prefixKey);
      if (prefixBucket) {
        prefixBucket.add(index);
      } else {
        prefix.set(prefixKey, new Set([index]));
      }

      const suffixKey = synopsis.slice(-SYNOPSIS_PREFIX_LENGTH);
      const suffixBucket = suffix.get(suffixKey);
      if (suffixBucket) {
        suffixBucket.add(index);
      } else {
        suffix.set(suffixKey, new Set([index]));
      }
    }
  });

  const addBucketPairs = (buckets: Map<string, Set<number>>): void => {
    for (const bucket of buckets.values()) {
      if (bucket.size < 2 || bucket.size > MAX_FUZZY_BUCKET_SIZE) continue;

      const indices = Array.from(bucket);
      for (let left = 0; left < indices.length; left += 1) {
        for (let right = left + 1; right < indices.length; right += 1) {
          addPair(indices[left], indices[right]);
        }
      }
    }
  };

  addBucketPairs(prefix);
  addBucketPairs(suffix);

  const bigramCache = new Map<string, Set<string>>();
  return mergeEntries(entries, pairKeys, (left, right) =>
    synopsesSimilar(entries[left].synopses, entries[right].synopses, bigramCache),
  );
}

const MAX_DIRECTOR_BUCKET_SIZE = 40;
const MAX_ACTOR_BUCKET_SIZE = 30;

interface PeopleInfo {
  actors: Set<string>;
  directors: Set<string>;
}

function peopleMatch(
  left: PeopleInfo,
  right: PeopleInfo,
  leftYear?: string,
  rightYear?: string,
): boolean {
  const directorOverlap = intersectionSize(left.directors, right.directors);
  const actorOverlap = intersectionSize(left.actors, right.actors);

  if (directorOverlap > 0) {
    if (left.actors.size > 0 && right.actors.size > 0) return actorOverlap > 0;
    return Boolean(leftYear && rightYear && leftYear === rightYear);
  }

  if (left.directors.size > 0 && right.directors.size > 0) return false;

  if (actorOverlap >= 3) return true;

  const minActors = Math.min(left.actors.size, right.actors.size);
  return actorOverlap >= 2 && minActors > 0 && actorOverlap / minActors >= 0.5;
}

function addPeopleBucketPairs<K>(
  buckets: Map<K, Set<number>>,
  maxBucketSize: number,
  addPair: (left: number, right: number) => void,
): void {
  for (const bucket of buckets.values()) {
    if (bucket.size < 2 || bucket.size > maxBucketSize) continue;

    const indices = Array.from(bucket);
    for (let left = 0; left < indices.length; left += 1) {
      for (let right = left + 1; right < indices.length; right += 1) {
        addPair(indices[left], indices[right]);
      }
    }
  }
}

function mergeByPeople(entries: GroupedEntry[]): GroupedEntry[] {
  if (entries.length <= 1) return entries;

  const people: PeopleInfo[] = entries.map((entry) => ({
    actors: new Set(entry.items.flatMap((item) => item.actors)),
    directors: new Set(entry.items.flatMap((item) => item.directors)),
  }));

  const pairKeys = new Set<string>();
  const addPair = (left: number, right: number): void => {
    if (left === right) return;
    if (!canMergeEntries(entries[left], entries[right])) return;
    pairKeys.add(left < right ? `${left}:${right}` : `${right}:${left}`);
  };

  const directorBuckets = new Map<string, Set<number>>();
  const actorBuckets = new Map<string, Set<number>>();

  people.forEach((info, index) => {
    for (const director of info.directors) {
      const bucket = directorBuckets.get(director);
      if (bucket) {
        bucket.add(index);
      } else {
        directorBuckets.set(director, new Set([index]));
      }
    }

    for (const actor of info.actors) {
      const bucket = actorBuckets.get(actor);
      if (bucket) {
        bucket.add(index);
      } else {
        actorBuckets.set(actor, new Set([index]));
      }
    }
  });

  addPeopleBucketPairs(directorBuckets, MAX_DIRECTOR_BUCKET_SIZE, addPair);
  addPeopleBucketPairs(actorBuckets, MAX_ACTOR_BUCKET_SIZE, addPair);

  return mergeEntries(entries, pairKeys, (left, right) =>
    peopleMatch(people[left], people[right], entries[left].year, entries[right].year),
  );
}

const MIN_EPISODE_COUNT = 2;
const MAX_EPISODE_BUCKET_SIZE = 60;
const EPISODE_TITLE_DICE = 0.5;
const EPISODE_SYNOPSIS_DICE = 0.5;

function mergeByEpisodeCount(entries: GroupedEntry[]): GroupedEntry[] {
  if (entries.length <= 1) return entries;

  const buckets = new Map<number, Set<number>>();
  entries.forEach((entry, index) => {
    if (entry.episodeCount === undefined || entry.episodeCount < MIN_EPISODE_COUNT) {
      return;
    }

    const bucket = buckets.get(entry.episodeCount);
    if (bucket) {
      bucket.add(index);
    } else {
      buckets.set(entry.episodeCount, new Set([index]));
    }
  });

  const pairKeys = new Set<string>();
  const addPair = (left: number, right: number): void => {
    if (left === right) return;

    const leftCount = entries[left].episodeCount;
    const rightCount = entries[right].episodeCount;
    if (leftCount === undefined || rightCount === undefined) return;
    if (leftCount < MIN_EPISODE_COUNT || rightCount < MIN_EPISODE_COUNT) return;
    if (leftCount !== rightCount) return;
    if (!canMergeEntries(entries[left], entries[right])) return;

    pairKeys.add(left < right ? `${left}:${right}` : `${right}:${left}`);
  };

  addPeopleBucketPairs(buckets, MAX_EPISODE_BUCKET_SIZE, addPair);

  if (pairKeys.size === 0) return entries;

  const people: PeopleInfo[] = entries.map((entry) => ({
    actors: new Set(entry.items.flatMap((item) => item.actors)),
    directors: new Set(entry.items.flatMap((item) => item.directors)),
  }));
  const titleBigrams = new Map<string, Set<string>>();
  const synopsisBigrams = new Map<string, Set<string>>();

  return mergeEntries(entries, pairKeys, (left, right) => {
    if (
      titlesSimilar(
        entries[left].normalizedTitles,
        entries[right].normalizedTitles,
        titleBigrams,
      )
    ) {
      return true;
    }

    if (
      synopsesSimilar(
        entries[left].synopses,
        entries[right].synopses,
        synopsisBigrams,
        EPISODE_SYNOPSIS_DICE,
      )
    ) {
      return true;
    }

    if (intersectionSize(people[left].actors, people[right].actors) > 0) return true;
    if (intersectionSize(people[left].directors, people[right].directors) > 0) {
      return true;
    }

    return false;
  });
}

export function groupMedia(videos: Video[]): MediaGroup[] {
  const prepared = videos.map((video, index) => prepareMedia(video, index));

  const byBaseKey = new Map<string, PreparedMedia[]>();
  for (const item of prepared) {
    const baseKey = `${item.title}\u0000${item.season ?? ""}`;
    const bucket = byBaseKey.get(baseKey);
    if (bucket) {
      bucket.push(item);
    } else {
      byBaseKey.set(baseKey, [item]);
    }
  }

  const grouped: GroupedEntry[] = [];

  for (const items of byBaseKey.values()) {
    for (const yearPart of splitByYear(items)) {
      grouped.push(buildGroup(yearPart));
    }
  }

  return mergeByEpisodeCount(mergeByPeople(mergeBySynopsis(grouped)))
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.group);
}
