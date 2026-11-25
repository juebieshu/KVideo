'use client';

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { settingsStore } from '@/lib/store/settings-store';
import { userSourcesStore } from '@/lib/store/user-sources-store';
import { parseDanmakuResponse, parseSearchResults, matchEpisode, fuzzyMatchTitle } from '@/lib/utils/danmaku-utils';
import type { DanmakuComment } from '@/lib/types/danmaku';

interface UseDanmakuOptions {
  videoTitle: string;
  episodeName: string;
  episodeIndex?: number;
}

interface UseDanmakuReturn {
  danmakuEnabled: boolean;
  setDanmakuEnabled: (v: boolean) => void;
  comments: DanmakuComment[];
  isLoading: boolean;
  error: string | null;
}

interface DanmakuLoadState {
  key: string;
  error: string | null;
}

function subscribeToDanmakuEnabled(listener: () => void): () => void {
  return settingsStore.subscribe(listener);
}

function getDanmakuEnabledSnapshot(): boolean {
  return settingsStore.getSettings().danmakuEnabled;
}

function getServerDanmakuEnabledSnapshot(): boolean {
  return false;
}

function subscribeToDanmakuApi(listener: () => void): () => void {
  const unsubscribeSettings = settingsStore.subscribe(listener);
  const unsubscribeUserSources = userSourcesStore.subscribe(listener);
  return () => {
    unsubscribeSettings();
    unsubscribeUserSources();
  };
}

function getDanmakuApiSnapshot(): string {
  const settings = settingsStore.getSettings();
  // User's active danmaku API takes priority over system setting.
  return userSourcesStore.getActiveDanmakuApi()?.url ?? settings.danmakuApiUrl;
}

function getServerDanmakuApiSnapshot(): string {
  return '';
}

export function useDanmaku({ videoTitle, episodeName, episodeIndex }: UseDanmakuOptions): UseDanmakuReturn {
  const danmakuEnabled = useSyncExternalStore(
    subscribeToDanmakuEnabled,
    getDanmakuEnabledSnapshot,
    getServerDanmakuEnabledSnapshot,
  );
  const apiUrl = useSyncExternalStore(
    subscribeToDanmakuApi,
    getDanmakuApiSnapshot,
    getServerDanmakuApiSnapshot,
  );
  const [comments, setComments] = useState<DanmakuComment[]>([]);
  const [loadState, setLoadState] = useState<DanmakuLoadState | null>(null);
  const fetchedKeyRef = useRef('');

  const setDanmakuEnabled = useCallback((v: boolean) => {
    const s = settingsStore.getSettings();
    settingsStore.saveSettings({ ...s, danmakuEnabled: v });
  }, []);

  const canFetchComments = danmakuEnabled && !!apiUrl && !!videoTitle;
  const fetchKey = canFetchComments ? `${apiUrl}|${videoTitle}|${episodeName}` : '';

  const fetchDanmaku = useCallback(async (isCancelled: () => boolean) => {
    let fetchError: string | null = null;

    try {
      // Step 1: Search for the anime
      const searchUrl = `/api/danmaku?action=search&keyword=${encodeURIComponent(videoTitle)}&apiUrl=${encodeURIComponent(apiUrl)}`;
      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.status}`);
      const searchData = await searchRes.json();

      if (isCancelled()) return;

      const results = parseSearchResults(searchData);
      if (!results.length) {
        setComments([]);
        return;
      }

      // Step 2: Match title
      const matched = fuzzyMatchTitle(results, videoTitle);
      if (!matched || !matched.episodes.length) {
        setComments([]);
        return;
      }

      // Step 3: Match episode
      const ep = matchEpisode(matched.episodes, episodeName, episodeIndex);
      if (!ep) {
        setComments([]);
        return;
      }

      // Step 4: Fetch comments
      const commentsUrl = `/api/danmaku?action=comments&episodeId=${encodeURIComponent(String(ep.episodeId))}&apiUrl=${encodeURIComponent(apiUrl)}`;
      const commentsRes = await fetch(commentsUrl);
      if (!commentsRes.ok) throw new Error(`Comments fetch failed: ${commentsRes.status}`);
      const commentsData = await commentsRes.json();

      if (isCancelled()) return;

      const parsed = parseDanmakuResponse(commentsData);
      setComments(parsed);
    } catch (err) {
      if (!isCancelled()) {
        fetchError = err instanceof Error ? err.message : 'Failed to load danmaku';
        setComments([]);
      }
    } finally {
      if (!isCancelled()) {
        setLoadState({ key: fetchKey, error: fetchError });
      }
    }
  }, [apiUrl, videoTitle, episodeName, episodeIndex, fetchKey]);

  // Fetch danmaku comments when enabled and API URL is configured
  useEffect(() => {
    if (!canFetchComments) {
      fetchedKeyRef.current = '';
      return;
    }

    if (fetchKey === fetchedKeyRef.current) return;
    fetchedKeyRef.current = fetchKey;

    let cancelled = false;
    void fetchDanmaku(() => cancelled);
    return () => { cancelled = true; };
  }, [canFetchComments, fetchKey, fetchDanmaku]);

  const isLoading = canFetchComments && loadState?.key !== fetchKey;
  const error = canFetchComments && loadState?.key === fetchKey ? loadState.error : null;

  return {
    danmakuEnabled,
    setDanmakuEnabled,
    comments: canFetchComments ? comments : [],
    isLoading,
    error,
  };
}
