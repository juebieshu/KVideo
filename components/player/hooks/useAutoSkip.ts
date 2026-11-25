'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayerSettings } from './usePlayerSettings';

interface UseAutoSkipProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    src: string;
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    isPremium?: boolean;
    totalEpisodes?: number;
    currentEpisodeIndex?: number;
    onNextEpisode?: () => void;
    isReversed?: boolean;
}

/**
 * Hook to handle auto-skip intro/outro and auto-next episode logic
 * 
 * Skip intro: When currentTime < skipIntroSeconds, seek to skipIntroSeconds
 * Skip outro: When (duration - currentTime) <= skipOutroSeconds, trigger next episode
 * Auto next: When video ends, auto-advance to next episode if enabled
 */
export function useAutoSkip({
    videoRef,
    isPremium = false,
    totalEpisodes = 1,
    currentEpisodeIndex = 0,
    onNextEpisode,
    isReversed = false,
    src,
}: UseAutoSkipProps) {
    const {
        autoNextEpisode,
        autoSkipIntro,
        skipIntroSeconds,
        autoSkipOutro,
        skipOutroSeconds,
    } = usePlayerSettings(isPremium);

    interface SkipSession {
        src: string;
        videoRef: React.RefObject<HTMLVideoElement | null>;
    }

    // Session-keyed flags reset synchronously by derivation when the source or
    // media element changes, while the refs remain synchronous duplicate guards.
    const hasSkippedIntroRef = useRef<SkipSession & { skipped: boolean }>({
        src,
        videoRef,
        skipped: false,
    });
    const [introSkipState, setIntroSkipState] = useState(() => ({
        src,
        videoRef,
        skipped: false,
    }));
    // Track if we've already handled navigation for this specific source
    const lastHandledSrcRef = useRef<string>('');
    // Track if we've triggered outro skip to prevent multiple triggers within the same video session
    const hasTriggeredOutroSkipRef = useRef<SkipSession & { triggered: boolean }>({
        src,
        videoRef,
        triggered: false,
    });
    const [outroSkipState, setOutroSkipState] = useState(() => ({
        src,
        videoRef,
        triggered: false,
    }));
    // Track if we're currently in the outro zone for UI purposes
    const [outroZoneState, setOutroZoneState] = useState(() => ({
        src,
        videoRef,
        active: false,
    }));
    // Track if we're transitioning to next episode (for custom loading indicator)
    const [isTransitioningToNextEpisode, setIsTransitioningToNextEpisode] = useState(false);

    const hasSkippedIntro = introSkipState.src === src
        && introSkipState.videoRef === videoRef
        && introSkipState.skipped;
    const hasTriggeredOutroSkip = outroSkipState.src === src
        && outroSkipState.videoRef === videoRef
        && outroSkipState.triggered;
    const isOutroActive = autoSkipOutro
        && skipOutroSeconds > 0
        && outroZoneState.src === src
        && outroZoneState.videoRef === videoRef
        && outroZoneState.active;

    // Handle resetting transition state when video is ready
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleReady = () => {
            setIsTransitioningToNextEpisode(false);
        };

        video.addEventListener('canplay', handleReady);
        video.addEventListener('playing', handleReady);
        return () => {
            video.removeEventListener('canplay', handleReady);
            video.removeEventListener('playing', handleReady);
        };
    }, [videoRef]);

    // Check if we can advance to next episode
    const canAdvanceToNext = useCallback(() => {
        if (totalEpisodes <= 1) return false;

        const nextEpisodeFn = onNextEpisode;

        if (!isReversed) {
            // Normal order: next is index + 1
            return currentEpisodeIndex < totalEpisodes - 1 && !!nextEpisodeFn;
        } else {
            // Reversed order: next is index - 1 (since we're going backwards)
            return currentEpisodeIndex > 0 && !!nextEpisodeFn;
        }
    }, [totalEpisodes, currentEpisodeIndex, isReversed, onNextEpisode]);

    // Helper to trigger next episode exactly once per source
    const triggerNextEpisode = useCallback((reason: string) => {
        if (!onNextEpisode) return;

        // Prevent double trigger for the same source URL
        if (lastHandledSrcRef.current === src) {
            console.log(`[AutoSkip] Ignoring ${reason} trigger: already handled for this source`);
            return;
        }

        // Safety check: if we are already transitioning, do not trigger again
        // This is a critical guard against infinite loops where the trigger might be called repeatedly
        // before the parent component has a chance to unmount or change the source.
        if (isTransitioningToNextEpisode) {
            console.log(`[AutoSkip] Ignoring ${reason} trigger: already transitioning`);
            return;
        }

        console.log(`[AutoSkip] Triggering next episode via ${reason}`);
        lastHandledSrcRef.current = src;
        // Set transitioning state for custom loading indicator
        setIsTransitioningToNextEpisode(true);
        onNextEpisode();
    }, [src, isTransitioningToNextEpisode, onNextEpisode]);

    // Handle intro skip from real media events. The ref is updated before the
    // seek so repeated events in the same tick cannot trigger another skip.
    const attemptIntroSkip = useCallback(() => {
        if (!autoSkipIntro || skipIntroSeconds <= 0) return;

        const video = videoRef.current;
        if (!video) return;

        const mediaDuration = video.duration;
        const mediaTime = video.currentTime;
        if (!(mediaDuration > 0) || !Number.isFinite(mediaDuration)
            || !Number.isFinite(mediaTime)) return;
        if (hasSkippedIntroRef.current.src === src
            && hasSkippedIntroRef.current.videoRef === videoRef
            && hasSkippedIntroRef.current.skipped) return;

        // Only skip if we're in the intro zone (between 0 and skipIntroSeconds)
        if (mediaTime >= 0 && mediaTime < skipIntroSeconds && mediaTime < mediaDuration) {
            if (video.readyState >= 2) { // HAVE_CURRENT_DATA or better
                console.log(`[AutoSkip] Jumping from ${mediaTime}s to intro skip point ${skipIntroSeconds}s`);
                const nextState = { src, videoRef, skipped: true };
                hasSkippedIntroRef.current = nextState;
                video.currentTime = Math.min(skipIntroSeconds, mediaDuration - 1);
                setIntroSkipState(nextState);
            }
        }
    }, [autoSkipIntro, skipIntroSeconds, src, videoRef]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        video.addEventListener('timeupdate', attemptIntroSkip);
        video.addEventListener('canplay', attemptIntroSkip);
        video.addEventListener('loadedmetadata', attemptIntroSkip);
        video.addEventListener('durationchange', attemptIntroSkip);
        return () => {
            video.removeEventListener('timeupdate', attemptIntroSkip);
            video.removeEventListener('canplay', attemptIntroSkip);
            video.removeEventListener('loadedmetadata', attemptIntroSkip);
            video.removeEventListener('durationchange', attemptIntroSkip);
        };
    }, [videoRef, attemptIntroSkip]);

    // Handle outro skip from media events rather than synchronously from an effect.
    const checkOutroZone = useCallback(() => {
        if (!autoSkipOutro || skipOutroSeconds <= 0) return;

        const video = videoRef.current;
        if (!video) return;

        const mediaDuration = video.duration;
        const mediaTime = video.currentTime;
        if (!(mediaDuration > 0) || !Number.isFinite(mediaDuration)
            || !Number.isFinite(mediaTime)) return;
        if (hasTriggeredOutroSkipRef.current.src === src
            && hasTriggeredOutroSkipRef.current.videoRef === videoRef
            && hasTriggeredOutroSkipRef.current.triggered) return;

        const remainingTime = mediaDuration - mediaTime;

        // Check if we're in the outro zone
        const inOutroZone = remainingTime > 0 && remainingTime <= skipOutroSeconds && mediaTime > 0;
        setOutroZoneState({ src, videoRef, active: inOutroZone });

        // Only auto-trigger if video is actually playing
        if (!inOutroZone || video.paused || video.ended) return;

        console.log(`[AutoSkip] Outro detected: ${remainingTime.toFixed(1)}s remaining`);
        const nextState = { src, videoRef, triggered: true };
        hasTriggeredOutroSkipRef.current = nextState;
        setOutroSkipState(nextState);

        // If we can advance to next episode, do it
        if (autoNextEpisode && canAdvanceToNext()) {
            triggerNextEpisode('outro-timer');
        } else {
            // Otherwise just seek to end to trigger ended event
            console.log('[AutoSkip] No next episode, seeking to end');
            video.currentTime = mediaDuration;
        }
    }, [autoSkipOutro, skipOutroSeconds, src, videoRef, autoNextEpisode, canAdvanceToNext, triggerNextEpisode]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        video.addEventListener('timeupdate', checkOutroZone);
        video.addEventListener('seeking', checkOutroZone);
        video.addEventListener('play', checkOutroZone);
        video.addEventListener('pause', checkOutroZone);
        video.addEventListener('loadedmetadata', checkOutroZone);
        video.addEventListener('durationchange', checkOutroZone);
        video.addEventListener('canplay', checkOutroZone);
        return () => {
            video.removeEventListener('timeupdate', checkOutroZone);
            video.removeEventListener('seeking', checkOutroZone);
            video.removeEventListener('play', checkOutroZone);
            video.removeEventListener('pause', checkOutroZone);
            video.removeEventListener('loadedmetadata', checkOutroZone);
            video.removeEventListener('durationchange', checkOutroZone);
            video.removeEventListener('canplay', checkOutroZone);
        };
    }, [videoRef, checkOutroZone]);

    // Handle video ended event for auto-next
    const handleVideoEnded = useCallback(() => {
        console.log(`[AutoSkip] Video ended naturally`);
        if (!autoNextEpisode) return;
        if (!canAdvanceToNext()) return;
        if (hasTriggeredOutroSkipRef.current.src === src
            && hasTriggeredOutroSkipRef.current.videoRef === videoRef
            && hasTriggeredOutroSkipRef.current.triggered) return;

        // Slight delay to ensure clean transition
        setTimeout(() => {
            triggerNextEpisode('ended-event');
        }, 100);
    }, [autoNextEpisode, canAdvanceToNext, triggerNextEpisode, src, videoRef]);

    // Attach ended event listener
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        video.addEventListener('ended', handleVideoEnded);
        return () => video.removeEventListener('ended', handleVideoEnded);
    }, [videoRef, handleVideoEnded]);

    return {
        hasSkippedIntro,
        hasTriggeredOutroSkip,
        isOutroActive,
        isTransitioningToNextEpisode,
    };
}
