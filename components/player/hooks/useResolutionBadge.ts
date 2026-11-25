/**
 * Resolution Badge Auto-Hide Hook
 * Shows the resolution badge when detected, then auto-hides after a delay.
 * Reappears briefly on user interaction (mouse move / touch).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { VideoResolutionInfo } from './useVideoResolution';

const AUTO_HIDE_DELAY = 5000; // 5 seconds

export function useResolutionBadge(resolution: VideoResolutionInfo | null) {
  const [visibility, setVisibility] = useState(() => ({
    resolution,
    visible: resolution !== null,
  }));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startHideTimer = useCallback((nextResolution: VideoResolutionInfo) => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setVisibility({ resolution: nextResolution, visible: false });
    }, AUTO_HIDE_DELAY);
  }, [clearTimer]);

  // A new resolution is visible immediately by derivation; only the timeout
  // callback performs the state update that hides it.
  useEffect(() => {
    if (resolution) {
      startHideTimer(resolution);
    } else {
      clearTimer();
    }
    return clearTimer;
  }, [resolution, startHideTimer, clearTimer]);

  // Briefly show badge on user interaction
  const flashBadge = useCallback(() => {
    if (!resolution) return;
    setVisibility({ resolution, visible: true });
    startHideTimer(resolution);
  }, [resolution, startHideTimer]);

  const badgeVisible = resolution !== null
    && (visibility.resolution !== resolution || visibility.visible);

  return { badgeVisible, flashBadge };
}
