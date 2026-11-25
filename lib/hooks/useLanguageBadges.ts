'use client';

import { useState, useMemo, useCallback } from 'react';
import type { LanguageBadge } from '@/lib/types';

/**
 * Custom hook to collect and filter by vod_lang values from video results
 * Mirrors useTypeBadges pattern
 */
export function useLanguageBadges<T extends { vod_lang?: string }>(videos: T[]) {
  const [selectedLangState, setSelectedLangs] = useState<Set<string>>(new Set);

  // Collect and count language badges from videos
  const languageBadges = useMemo<LanguageBadge[]>(() => {
    const langMap = new Map<string, number>();

    videos.forEach(video => {
      if (video.vod_lang && video.vod_lang.trim()) {
        const lang = video.vod_lang.trim();
        langMap.set(lang, (langMap.get(lang) || 0) + 1);
      }
    });

    return Array.from(langMap.entries())
      .map(([lang, count]) => ({ lang, count }))
      .sort((a, b) => b.count - a.count);
  }, [videos]);

  // Ignore stale selections without synchronizing state from an effect.
  const selectedLangs = useMemo(() => {
    const availableLangs = new Set(languageBadges.map(badge => badge.lang));
    const filtered = new Set(
      Array.from(selectedLangState).filter(lang => availableLangs.has(lang))
    );

    return filtered.size === selectedLangState.size
      ? selectedLangState
      : filtered;
  }, [languageBadges, selectedLangState]);

  // Filter videos by selected languages
  const filteredVideos = useMemo(() => {
    if (selectedLangs.size === 0) {
      return videos;
    }

    return videos.filter(video =>
      video.vod_lang && selectedLangs.has(video.vod_lang.trim())
    );
  }, [videos, selectedLangs]);

  // Toggle language selection
  const toggleLang = useCallback((lang: string) => {
    setSelectedLangs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lang)) {
        newSet.delete(lang);
      } else {
        newSet.add(lang);
      }
      return newSet;
    });
  }, []);

  return {
    languageBadges,
    selectedLangs,
    filteredVideos,
    toggleLang,
  };
}
