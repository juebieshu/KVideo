/**
 * usePersonalizedRecommendations
 *
 * Fetches personalized content based on viewing history patterns.
 * Designed to integrate into the tag system — returns the same shape
 * as usePopularMovies (movies, loading, hasMore, prefetchRef, loadMoreRef).
 *
 * Features:
 * - Interleaves results from multiple recommendation queries into a single mixed feed
 * - Randomizes Douban API offsets so each page load shows different content
 * - Excludes already-watched titles
 * - Auto-infinite-scroll via useInfiniteScroll (no "load more" button)
 * - When current queries exhaust, regenerates with new random offsets for more content
 * - Caches results for 30 minutes
 * - hasHistory = true when viewingHistory.length >= 2
 */

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { useHistoryStore, usePremiumHistoryStore } from '@/lib/store/history-store';
import { useInfiniteScroll } from '@/lib/hooks/useInfiniteScroll';
import {
  generateRecommendations,
  getWatchedTitles,
  interleaveResults,
  type RecommendationQuery,
} from '@/lib/utils/recommendation-engine';

interface DoubanMovie {
  id: string;
  title: string;
  cover: string;
  rate: string;
  url: string;
}

interface InterleavedMovie extends DoubanMovie {
  sourceLabel: string;
}

interface InitialRecommendationsState {
  historyLength: number;
  loaded: boolean;
  movies: InterleavedMovie[];
  hasMore: boolean;
  page: number;
}

interface LoadMoreState {
  historyLength: number;
  loading: boolean;
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const ITEMS_PER_PAGE = 18; // How many to fetch per query per page
const MAX_ROUNDS = 8; // Max times to regenerate queries before giving up

function subscribeToHydration(): () => void {
  return () => {};
}

function getHydratedSnapshot(): boolean {
  return true;
}

function getServerHydratedSnapshot(): boolean {
  return false;
}

export function usePersonalizedRecommendations(isPremium = false) {
  const normalHistory = useHistoryStore();
  const premiumHistory = usePremiumHistoryStore();
  const { viewingHistory } = isPremium ? premiumHistory : normalHistory;
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );

  const [initialResult, setInitialResult] = useState<InitialRecommendationsState>(() => ({
    historyLength: isHydrated ? viewingHistory.length : -1,
    loaded: isHydrated ? viewingHistory.length < 2 : false,
    movies: [],
    hasMore: true,
    page: 0,
  }));
  const [loadMoreState, setLoadMoreState] = useState<LoadMoreState>(() => ({
    historyLength: isHydrated ? viewingHistory.length : -1,
    loading: false,
  }));
  const queriesRef = useRef<RecommendationQuery[]>([]);
  const roundRef = useRef(0); // Track how many times we've regenerated queries
  const allSeenTitlesRef = useRef<Set<string>>(new Set()); // Global dedup across rounds
  const cacheRef = useRef<{
    key: string;
    movies: InterleavedMovie[];
    timestamp: number;
  } | null>(null);

  const hasHistory = isHydrated && viewingHistory.length >= 2;
  const isCurrentHistory = initialResult.historyLength === viewingHistory.length;
  const initialLoading = hasHistory && (!isCurrentHistory || !initialResult.loaded);
  const movies = hasHistory && isCurrentHistory ? initialResult.movies : [];
  const hasMore = isHydrated
    ? hasHistory && (initialLoading || (isCurrentHistory && initialResult.hasMore))
    : true;
  const page = isCurrentHistory ? initialResult.page : 0;
  const loading = isHydrated && (
    initialLoading || (loadMoreState.historyLength === viewingHistory.length && loadMoreState.loading)
  );

  // Fetch a page of results from all queries
  const fetchPage = useCallback(async (
    queries: RecommendationQuery[],
    pageNum: number,
    watchedTitles: Set<string>,
  ): Promise<InterleavedMovie[]> => {
    const results = await Promise.all(
      queries.map(async (query) => {
        try {
          const offset = query.pageStart + pageNum * ITEMS_PER_PAGE;
          const res = await fetch(
            `/api/douban/recommend?tag=${encodeURIComponent(query.tag)}&type=${query.type}&page_limit=${ITEMS_PER_PAGE}&page_start=${offset}`
          );
          if (!res.ok) return { label: query.label, movies: [] as DoubanMovie[] };
          const data = await res.json();
          const movies: DoubanMovie[] = (Array.isArray(data.subjects) ? data.subjects : []).map(
            (s: Partial<DoubanMovie>) => ({
              id: String(s.id ?? ''),
              title: String(s.title ?? ''),
              cover: String(s.cover ?? ''),
              rate: String(s.rate ?? ''),
              url: String(s.url ?? ''),
            })
          );
          return { label: query.label, movies };
        } catch {
          return { label: query.label, movies: [] as DoubanMovie[] };
        }
      })
    );

    return interleaveResults(results, watchedTitles);
  }, []);

  // Initial load
  useEffect(() => {
    if (viewingHistory.length < 2) return;

    const historyLength = viewingHistory.length;
    const queries = generateRecommendations(viewingHistory);
    queriesRef.current = queries;
    roundRef.current = 0;
    allSeenTitlesRef.current = new Set();

    // Cache key based on query tags (not pageStart, since that's randomized)
    const cacheKey = queries.map(q => `${q.tag}:${q.type}`).join('|');
    const cached = cacheRef.current &&
      cacheRef.current.key === cacheKey &&
      Date.now() - cacheRef.current.timestamp < CACHE_DURATION
      ? cacheRef.current
      : null;

    const loadInitialPage = async (): Promise<InterleavedMovie[]> => {
      if (queries.length === 0) return [];
      if (cached) return cached.movies;
      return fetchPage(queries, 0, getWatchedTitles(viewingHistory));
    };

    let cancelled = false;
    loadInitialPage().then((interleaved) => {
      if (cancelled) return;

      for (const m of interleaved) {
        allSeenTitlesRef.current.add(m.title.toLowerCase().trim());
      }
      setInitialResult({
        historyLength,
        loaded: true,
        movies: interleaved,
        hasMore: queries.length > 0 && (cached ? true : interleaved.length > 0),
        page: 0,
      });
      if (!cached && queries.length > 0) {
        cacheRef.current = {
          key: cacheKey,
          movies: interleaved,
          timestamp: Date.now(),
        };
      }
    }).catch(() => {
      if (cancelled) return;
      setInitialResult((current) => ({
        historyLength,
        loaded: true,
        movies: current.historyLength === historyLength ? current.movies : [],
        hasMore: current.historyLength === historyLength ? current.hasMore : true,
        page: 0,
      }));
    });

    return () => { cancelled = true; };
  }, [viewingHistory.length, fetchPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load more via infinite scroll
  const handleLoadMore = useCallback(async (nextPage: number) => {
    const queries = queriesRef.current;
    if (queries.length === 0 || loading) return;

    const historyLength = viewingHistory.length;
    setLoadMoreState({ historyLength, loading: true });
    const watchedTitles = getWatchedTitles(viewingHistory);

    try {
      const newMovies = await fetchPage(queries, nextPage, watchedTitles);

      // Deduplicate against all previously seen movies (across all rounds)
      const uniqueNew = newMovies.filter(
        m => !allSeenTitlesRef.current.has(m.title.toLowerCase().trim())
      );

      if (uniqueNew.length === 0) {
        // Current queries exhausted — regenerate with new random offsets
        if (roundRef.current < MAX_ROUNDS) {
          roundRef.current += 1;
          const freshQueries = generateRecommendations(viewingHistory);
          queriesRef.current = freshQueries;

          // Fetch page 0 with fresh random offsets
          const freshMovies = await fetchPage(freshQueries, 0, watchedTitles);
          const freshUnique = freshMovies.filter(
            m => !allSeenTitlesRef.current.has(m.title.toLowerCase().trim())
          );

          if (freshUnique.length > 0) {
            for (const m of freshUnique) {
              allSeenTitlesRef.current.add(m.title.toLowerCase().trim());
            }
            setInitialResult((current) => (
              current.historyLength === historyLength && current.loaded
                ? { ...current, movies: [...current.movies, ...freshUnique], page: 0 }
                : current
            ));
            if (cacheRef.current) {
              cacheRef.current.movies = [...cacheRef.current.movies, ...freshUnique];
            }
          } else {
            // Even fresh queries yielded nothing new — stop
            setInitialResult((current) => (
              current.historyLength === historyLength && current.loaded
                ? { ...current, hasMore: false }
                : current
            ));
          }
        } else {
          // Exceeded max rounds — stop
          setInitialResult((current) => (
            current.historyLength === historyLength && current.loaded
              ? { ...current, hasMore: false }
              : current
          ));
        }
      } else {
        for (const m of uniqueNew) {
          allSeenTitlesRef.current.add(m.title.toLowerCase().trim());
        }
        setInitialResult((current) => (
          current.historyLength === historyLength && current.loaded
            ? { ...current, movies: [...current.movies, ...uniqueNew], page: nextPage }
            : current
        ));
        if (cacheRef.current) {
          cacheRef.current.movies = [...cacheRef.current.movies, ...uniqueNew];
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoadMoreState((current) => (
        current.historyLength === historyLength
          ? { ...current, loading: false }
          : current
      ));
    }
  }, [loading, viewingHistory, fetchPage]);

  const { prefetchRef, loadMoreRef } = useInfiniteScroll({
    hasMore,
    loading,
    page,
    onLoadMore: handleLoadMore,
  });

  // 供横向轮播翻到末尾时主动加载下一页
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    handleLoadMore(page + 1);
  }, [loading, hasMore, page, handleLoadMore]);

  return { movies, loading, hasMore, hasHistory, prefetchRef, loadMoreRef, loadMore };
}
