'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useHistory } from '@/lib/store/history-store';
import { CustomVideoPlayer } from './CustomVideoPlayer';
import { VideoPlayerError } from './VideoPlayerError';
import { VideoPlayerEmpty } from './VideoPlayerEmpty';

interface VideoPlayerProps {
  playUrl: string;
  videoId?: string;
  currentEpisode: number;
  onBack: () => void;
  totalEpisodes?: number;
  onNextEpisode?: () => void;
  isReversed?: boolean;
  isPremium?: boolean;
  videoTitle?: string;
  episodeName?: string;
  externalTimeRef?: React.MutableRefObject<number>;
  onResolutionDetected?: (info: import('./hooks/useVideoResolution').VideoResolutionInfo) => void;
}

export function VideoPlayer({
  playUrl,
  videoId,
  currentEpisode,
  onBack,
  totalEpisodes,
  onNextEpisode,
  isReversed = false,
  isPremium = false,
  videoTitle,
  episodeName,
  externalTimeRef,
  onResolutionDetected,
}: VideoPlayerProps) {
  const [videoError, setVideoError] = useState<string>('');
  const [shouldAutoPlay, setShouldAutoPlay] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_MANUAL_RETRIES = 20;
  const lastSaveTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const SAVE_INTERVAL = 5000;

  const { viewingHistory, addToHistory } = useHistory(isPremium);
  const searchParams = useSearchParams();

  const source = searchParams.get('source') || '';
  const title = searchParams.get('title') || '未知视频';

  const getSavedProgress = () => {
    const timeParam = searchParams.get('t');
    if (timeParam) {
      const t = parseFloat(timeParam);
      if (t > 0 && isFinite(t)) return t;
    }

    if (!videoId) return 0;

    const normalizedTitle = title.toLowerCase().trim();
    const historyItem = viewingHistory.find(item =>
      item.title.toLowerCase().trim() === normalizedTitle &&
      item.episodeIndex === currentEpisode
    );

    return historyItem ? historyItem.playbackPosition : 0;
  };

  const saveProgress = useCallback((currentTime: number, duration: number) => {
    if (!videoId || !playUrl || duration === 0 || currentTime <= 1) return;
    addToHistory(
      videoId,
      title,
      playUrl,
      currentEpisode,
      source,
      currentTime,
      duration,
      undefined,
      []
    );
  }, [videoId, playUrl, title, currentEpisode, source, addToHistory]);

  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    currentTimeRef.current = currentTime;
    durationRef.current = duration;
    if (externalTimeRef) externalTimeRef.current = currentTime;

    if (!videoId || !playUrl || duration === 0) return;

    const now = Date.now();
    if (currentTime > 1 && now - lastSaveTimeRef.current >= SAVE_INTERVAL) {
      lastSaveTimeRef.current = now;
      saveProgress(currentTime, duration);
    }
  }, [videoId, playUrl, saveProgress, externalTimeRef]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentTimeRef.current > 1 && durationRef.current > 0) {
        saveProgress(currentTimeRef.current, durationRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveProgress]);

  const handleVideoError = (error: string) => {
    console.error('Video playback error:', error);
    setVideoError(error);
  };

  const handleRetry = () => {
    if (retryCount >= MAX_MANUAL_RETRIES) return;

    setRetryCount(prev => prev + 1);
    setVideoError('');
    setShouldAutoPlay(true);
  };

  if (!playUrl) {
    return <VideoPlayerEmpty />;
  }

  return (
    <div data-no-spatial className="relative">
      {videoError ? (
        <VideoPlayerError
          error={videoError}
          onBack={onBack}
          onRetry={handleRetry}
          retryCount={retryCount}
          maxRetries={MAX_MANUAL_RETRIES}
        />
      ) : (
        <CustomVideoPlayer
          key={`${retryCount}-${source}`}
          src={playUrl}
          onError={handleVideoError}
          onTimeUpdate={handleTimeUpdate}
          initialTime={getSavedProgress()}
          shouldAutoPlay={shouldAutoPlay}
          totalEpisodes={totalEpisodes}
          currentEpisodeIndex={currentEpisode}
          onNextEpisode={onNextEpisode}
          isReversed={isReversed}
          videoTitle={videoTitle}
          episodeName={episodeName}
          isPremium={isPremium}
          onResolutionDetected={onResolutionDetected}
        />
      )}
    </div>
  );
}
