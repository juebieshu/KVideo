/**
 * useTVDetection
 * Detects if the user is on a TV/set-top-box browser.
 */

import { useSyncExternalStore } from 'react';

const TV_USER_AGENT_PATTERNS = [
  /smarttv/i,
  /tizen/i,
  /webos/i,
  /firetv/i,
  /android tv/i,
  /googletv/i,
  /crkey/i, // Chromecast
  /aftt/i, // Amazon Fire TV Stick
  /aftm/i, // Amazon Fire TV
  /bravia/i, // Sony Bravia
  /netcast/i, // LG NetCast
  /viera/i, // Panasonic Viera
  /hbbtv/i,
];

function subscribeToTVDetection(): () => void {
  return () => {};
}

function detectTV(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent;

  // Check UA for TV indicators
  if (TV_USER_AGENT_PATTERNS.some(pattern => pattern.test(ua))) {
    return true;
  }

  // Fallback heuristic: large screen + no touch + low pixel density
  const isLargeScreen = window.innerWidth >= 1280;
  const hasNoTouch = !('ontouchstart' in window) && navigator.maxTouchPoints === 0;
  const lowDensity = window.devicePixelRatio <= 1.5;

  return isLargeScreen && hasNoTouch && lowDensity;
}

function getTVServerSnapshot(): boolean {
  return false;
}

export function useTVDetection(): boolean {
  return useSyncExternalStore(
    subscribeToTVDetection,
    detectTV,
    getTVServerSnapshot,
  );
}
