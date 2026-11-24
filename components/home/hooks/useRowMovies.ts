/**
 * useRowMovies - 单行（一个标签）的豆瓣数据
 *
 * - enabled 为 false 时不请求（行还没滚动到附近）
 * - 模块级缓存：电影 / 电视剧来回切换时直接复用，不用再看一次骨架屏
 * - 同一请求并发去重
 * - loadMore 供横向轮播翻到末尾时追加下一页
 */

import { useCallback, useEffect, useState } from 'react';
import type { DoubanMovie } from '../MovieCard';

const PAGE_LIMIT = 20;
const CACHE_TTL = 10 * 60 * 1000;

interface CacheEntry {
  movies: DoubanMovie[];
  hasMore: boolean;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<DoubanMovie[]>>();

function readCache(key: string | null) {
  if (!key) return undefined;
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return undefined;
  }
  return entry;
}

function fetchPage(type: string, tag: string, start: number): Promise<DoubanMovie[]> {
  const requestKey = `${type}|${tag}|${start}`;
  const existing = inflight.get(requestKey);
  if (existing) return existing;

  const request = fetch(
    `/api/douban/recommend?type=${type}&tag=${encodeURIComponent(tag)}&page_limit=${PAGE_LIMIT}&page_start=${start}`
  )
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => (Array.isArray(data?.subjects) ? (data.subjects as DoubanMovie[]) : []))
    .finally(() => inflight.delete(requestKey));

  inflight.set(requestKey, request);
  return request;
}

type Status = 'idle' | 'ready' | 'error';

interface RowState {
  key: string | null;
  movies: DoubanMovie[];
  hasMore: boolean;
  status: Status;
  loadingMore: boolean;
}

function initialState(key: string | null): RowState {
  const cached = readCache(key);
  return cached
    ? { key, movies: cached.movies, hasMore: cached.hasMore, status: 'ready', loadingMore: false }
    : { key, movies: [], hasMore: true, status: 'idle', loadingMore: false };
}

export function useRowMovies(tagValue: string | null, contentType: 'movie' | 'tv', enabled: boolean) {
  const key = tagValue ? `${contentType}|${tagValue}` : null;
  const [rawState, setState] = useState<RowState>(() => initialState(key));

  // 标签或分类变了：在渲染阶段直接换成新状态（有缓存就立即可用），不会闪一下旧数据
  let state = rawState;
  if (rawState.key !== key) {
    state = initialState(key);
    setState(state);
  }

  const { status } = state;

  useEffect(() => {
    if (!key || !tagValue || !enabled || status !== 'idle') return;
    let cancelled = false;

    fetchPage(contentType, tagValue, 0)
      .then((movies) => {
        const hasMore = movies.length === PAGE_LIMIT;
        cache.set(key, { movies, hasMore, timestamp: Date.now() });
        if (!cancelled) {
          setState((s) => (s.key === key ? { ...s, movies, hasMore, status: 'ready' } : s));
        }
      })
      .catch((error) => {
        console.error('Failed to load row:', error);
        if (!cancelled) {
          setState((s) => (s.key === key ? { ...s, status: 'error' } : s));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, tagValue, contentType, enabled, status]);

  const loadMore = useCallback(() => {
    if (!key || !tagValue) return;
    if (state.key !== key || state.status !== 'ready' || !state.hasMore || state.loadingMore) return;

    const offset = state.movies.length;
    setState((s) => (s.key === key ? { ...s, loadingMore: true } : s));

    fetchPage(contentType, tagValue, offset)
      .then((next) => {
        setState((s) => {
          if (s.key !== key) return s;
          const seen = new Set(s.movies.map((m) => m.id));
          const movies = [...s.movies, ...next.filter((m) => !seen.has(m.id))];
          const hasMore = next.length === PAGE_LIMIT;
          cache.set(key, { movies, hasMore, timestamp: Date.now() });
          return { ...s, movies, hasMore, loadingMore: false };
        });
      })
      .catch(() => {
        setState((s) => (s.key === key ? { ...s, loadingMore: false, hasMore: false } : s));
      });
  }, [key, tagValue, contentType, state]);

  const retry = useCallback(() => {
    setState((s) => (s.key === key ? { ...s, status: 'idle' } : s));
  }, [key]);

  return {
    movies: state.movies,
    initialLoading: state.status === 'idle',
    loadingMore: state.loadingMore,
    hasMore: state.hasMore,
    error: state.status === 'error',
    loadMore,
    retry,
  };
}
