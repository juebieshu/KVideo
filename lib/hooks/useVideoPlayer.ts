'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { settingsStore } from '@/lib/store/settings-store';

interface VideoData {
  vod_id: string;
  vod_name: string;
  vod_pic?: string;
  vod_content?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_year?: string;
  vod_area?: string;
  type_name?: string;
  episodes?: Array<{ name?: string; url: string }>;
}

interface UseVideoPlayerReturn {
  videoData: VideoData | null;
  loading: boolean;
  videoError: string;
  currentEpisode: number;
  playUrl: string;
  setCurrentEpisode: (index: number) => void;
  setPlayUrl: (url: string) => void;
  setVideoError: (error: string) => void;
  fetchVideoDetails: () => Promise<void>;
}

interface PlayerState {
  requestKey: string;
  videoData: VideoData | null;
  loading: boolean;
  videoError: string;
  currentEpisode: number;
  playUrl: string;
  episodeParam: string | null;
}

function createPlayerState(requestKey: string, loading: boolean, episodeParam: string | null): PlayerState {
  return {
    requestKey,
    videoData: null,
    loading,
    videoError: '',
    currentEpisode: 0,
    playUrl: '',
    episodeParam,
  };
}

export function useVideoPlayer(
  videoId: string | null,
  source: string | null,
  episodeParam: string | null,
  isReversed: boolean = false,
  onSourceUnavailable?: () => void
): UseVideoPlayerReturn {
  const requestKey = videoId && source ? `${videoId}\u0000${source}` : '';
  const [playerState, setPlayerState] = useState(() => createPlayerState(
    requestKey,
    !!(videoId && source),
    episodeParam,
  ));
  const latestRequestIdRef = useRef(0);

  const stateMatchesRequest = playerState.requestKey === requestKey;
  const videoData = stateMatchesRequest ? playerState.videoData : null;
  // A new request derives its reset/loading view immediately, without an effect
  // clearing the previous request's state after commit.
  const loading = !!(videoId && source) && (!stateMatchesRequest || playerState.loading);
  const videoError = stateMatchesRequest ? playerState.videoError : '';
  const currentEpisode = stateMatchesRequest ? playerState.currentEpisode : 0;
  const playUrl = stateMatchesRequest ? playerState.playUrl : '';

  // Refs to keep track of latest values for the fetch function without re-triggering it
  // This solves the stale closure problem while keeping fetchVideoDetails stable for the player
  const episodeParamRef = useRef(episodeParam);
  const isReversedRef = useRef(isReversed);
  const onSourceUnavailableRef = useRef(onSourceUnavailable);

  useEffect(() => {
    episodeParamRef.current = episodeParam;
  }, [episodeParam]);

  useEffect(() => {
    isReversedRef.current = isReversed;
  }, [isReversed]);

  useEffect(() => {
    onSourceUnavailableRef.current = onSourceUnavailable;
  }, [onSourceUnavailable]);



  const loadVideoDetails = useCallback(async () => {
    if (!videoId || !source) return;

    const requestId = ++latestRequestIdRef.current;
    const activeRequestKey = requestKey;

    try {
      const settings = settingsStore.getSettings();
      const allSources = [
        ...settings.sources,
        ...settings.premiumSources,
        ...settings.subscriptions,
      ];

      const sourceConfig = allSources.find(s => s.id === source);
      let response;

      if (sourceConfig) {
        response = await fetch('/api/detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: videoId, source: sourceConfig })
        });
      } else {
        response = await fetch(`/api/detail?id=${videoId}&source=${source}`);
      }

      const data = await response.json();
      if (requestId !== latestRequestIdRef.current) return;
      const currentEpisodeParam = episodeParamRef.current;

      const sourceUnavailable =
        response.status === 404 ||
        (response.status === 400 && typeof data?.error === 'string' && data.error.toLowerCase().includes('source')) ||
        (typeof data?.error === 'string' && data.error.includes('视频源不可用'));

      if (!response.ok) {
        if (sourceUnavailable) {
          setPlayerState((previous) => {
            const current = previous.requestKey === activeRequestKey
              ? previous
              : createPlayerState(activeRequestKey, true, currentEpisodeParam);
            return {
              ...current,
              loading: false,
              videoError: data.error || '该视频源不可用。请返回并尝试其他来源。',
            };
          });
          onSourceUnavailableRef.current?.();
          return;
        }
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (data.success && data.data) {
        if (data.data.episodes && data.data.episodes.length > 0) {
          const latestIsReversed = isReversedRef.current;
          const latestEpisodeParam = episodeParamRef.current;

          const defaultIndex = latestIsReversed ? data.data.episodes.length - 1 : 0;
          const episodeIndex = latestEpisodeParam ? parseInt(latestEpisodeParam, 10) : defaultIndex;
          const validIndex = (episodeIndex >= 0 && episodeIndex < data.data.episodes.length) ? episodeIndex : defaultIndex;

          const episodeUrl = data.data.episodes[validIndex].url;
          setPlayerState((previous) => {
            const current = previous.requestKey === activeRequestKey
              ? previous
              : createPlayerState(activeRequestKey, true, latestEpisodeParam);
            return {
              ...current,
              videoData: data.data,
              loading: false,
              videoError: '',
              currentEpisode: validIndex,
              playUrl: episodeUrl,
              episodeParam: latestEpisodeParam,
            };
          });
        } else {
          setPlayerState((previous) => {
            const current = previous.requestKey === activeRequestKey
              ? previous
              : createPlayerState(activeRequestKey, true, currentEpisodeParam);
            return {
              ...current,
              videoData: data.data,
              loading: false,
              videoError: '该来源没有可播放的剧集',
            };
          });
        }
      } else {
        throw new Error(data.error || '来自 API 的响应无效');
      }
    } catch (error) {
      if (requestId !== latestRequestIdRef.current) return;
      const currentEpisodeParam = episodeParamRef.current;
      console.error('Failed to fetch video details:', error);
      setPlayerState((previous) => {
        const current = previous.requestKey === activeRequestKey
          ? previous
          : createPlayerState(activeRequestKey, true, currentEpisodeParam);
        return {
          ...current,
          loading: false,
          videoError: error instanceof Error ? error.message : '加载视频详情失败。',
        };
      });
    }
  }, [videoId, source, requestKey]);

  const fetchVideoDetails = useCallback(async () => {
    if (!videoId || !source) return;

    // This entry point is invoked by retry buttons/store notifications, so the
    // loading reset belongs here rather than in the mounting effect.
    setPlayerState((previous) => {
      const current = previous.requestKey === requestKey
        ? previous
        : createPlayerState(requestKey, true, episodeParam);
      return { ...current, loading: true, videoError: '' };
    });
    await loadVideoDetails();
  }, [videoId, source, requestKey, episodeParam, loadVideoDetails]);

  // EFFECT: Retry logic when settings change (e.g., sources loaded from subscriptions)
  useEffect(() => {
    if (!videoId || !source || !videoError) return;

    const unsubscribe = settingsStore.subscribe(() => {
      // If we are currently in an error state (likely "Invalid source configuration"),
      // and settings updated (likely new sources arrived), try fetching again.
      // We can be smarter: check if the source ID now exists in the store.
      const settings = settingsStore.getSettings();
      const allSources = [
        ...settings.sources,
        ...settings.premiumSources,
        ...settings.subscriptions, // note: subscription items aren't usually video sources directly but let's check broadly
      ];

      // We really need to check if the specific source ID is now available
      // But since 'subscriptions' in store expands into 'sources'/'premiumSources',
      // we just check if any sources exist now.
      if (allSources.length > 0) {
        console.log("Settings updated, retrying video fetch...");
        fetchVideoDetails();
      }
    });

    return () => unsubscribe();
  }, [videoId, source, videoError, fetchVideoDetails]);

  // Replace the previous request's state before commit when navigation changes
  // the video/source. This also handles returning to an earlier request key.
  if (!stateMatchesRequest) {
    setPlayerState(createPlayerState(requestKey, !!(videoId && source), episodeParam));
  }

  // Adjust state during render when back/forward navigation supplies a new
  // episode param. React restarts this render before committing the old selection.
  if (stateMatchesRequest
    && playerState.episodeParam !== episodeParam
    && episodeParam !== null
    && videoData?.episodes) {
    const index = parseInt(episodeParam, 10);
    if (!isNaN(index) && index >= 0 && index < videoData.episodes.length) {
      setPlayerState({
        ...playerState,
        currentEpisode: index,
        playUrl: videoData.episodes[index].url,
        episodeParam,
      });
    }
  }

  useEffect(() => {
    if (videoId && source) {
      void loadVideoDetails();
    }
  }, [videoId, source, loadVideoDetails]);

  const setCurrentEpisode = useCallback((index: number) => {
    setPlayerState((previous) => {
      const current = previous.requestKey === requestKey
        ? previous
        : createPlayerState(requestKey, true, episodeParam);
      return { ...current, currentEpisode: index, episodeParam };
    });
  }, [requestKey, episodeParam]);

  const setPlayUrl = useCallback((url: string) => {
    setPlayerState((previous) => {
      const current = previous.requestKey === requestKey
        ? previous
        : createPlayerState(requestKey, true, episodeParam);
      return { ...current, playUrl: url, episodeParam };
    });
  }, [requestKey, episodeParam]);

  const setVideoError = useCallback((error: string) => {
    setPlayerState((previous) => {
      const current = previous.requestKey === requestKey
        ? previous
        : createPlayerState(requestKey, !!(videoId && source), episodeParam);
      return { ...current, videoError: error };
    });
  }, [requestKey, videoId, source, episodeParam]);

  return {
    videoData,
    loading,
    videoError,
    currentEpisode,
    playUrl,
    setCurrentEpisode,
    setPlayUrl,
    setVideoError,
    fetchVideoDetails,
  };
}
