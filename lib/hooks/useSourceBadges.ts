'use client';

import { useState, useMemo, useCallback } from 'react';
import type { SourceBadge } from '@/lib/types';

/**
 * Custom hook to manage source badge filtering
 * 
 * Features:
 * - Tracks available video sources
 * - Supports filtering by selected sources
 * - Auto-cleanup when sources no longer exist
 */
export function useSourceBadges<T extends { source?: string; sourceName?: string }>(
  videos: T[],
  availableSources: SourceBadge[]
) {
  const [selectedSourceState, setSelectedSources] = useState<Set<string>>(new Set);

  // Derive the valid selection so removed sources never filter the UI.
  const selectedSources = useMemo(() => {
    const availableSourceIds = new Set(availableSources.map(source => source.id));
    const filtered = new Set(
      Array.from(selectedSourceState).filter(sourceId => availableSourceIds.has(sourceId))
    );

    return filtered.size === selectedSourceState.size
      ? selectedSourceState
      : filtered;
  }, [availableSources, selectedSourceState]);

  // Filter videos by selected sources
  const filteredVideos = useMemo(() => {
    if (selectedSources.size === 0) {
      return videos;
    }

    return videos.filter(video =>
      video.source && selectedSources.has(video.source)
    );
  }, [videos, selectedSources]);

  // Toggle source selection
  const toggleSource = useCallback((sourceId: string) => {
    setSelectedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sourceId)) {
        newSet.delete(sourceId);
      } else {
        newSet.add(sourceId);
      }
      return newSet;
    });
  }, []);

  return {
    selectedSources,
    filteredVideos,
    toggleSource,
  };
}
