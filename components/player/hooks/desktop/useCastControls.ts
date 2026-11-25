'use client';

import { useCallback, useEffect, useRef, useMemo } from 'react';

interface UseCastControlsProps {
    src: string;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    setIsCastAvailable: (available: boolean) => void;
    setIsCasting: (casting: boolean) => void;
}

type SessionState = 'SESSION_STARTED' | 'SESSION_RESUMED' | 'SESSION_ENDED';
type CastContextEventType = 'sessionstatechanged';
type AutoJoinPolicy = 'tab_and_origin_scoped' | 'origin_scoped';

interface MediaInfo {
    contentType: string;
}

interface LoadRequest {
    currentTime?: number;
}

interface SessionStateEventData {
    sessionState: SessionState;
}

interface CastOptions {
    receiverApplicationId: string;
    autoJoinPolicy: AutoJoinPolicy;
}

interface Session {
    loadMedia(request: LoadRequest): Promise<unknown>;
}

interface CastContext {
    setOptions(options: CastOptions): void;
    getCurrentSession(): Session | null;
    addEventListener(
        type: CastContextEventType,
        listener: (event: SessionStateEventData) => void
    ): void;
    removeEventListener(
        type: CastContextEventType,
        listener: (event: SessionStateEventData) => void
    ): void;
    requestSession(): Promise<Session>;
}

interface CastSdk {
    chrome: {
        cast: {
            media: {
                DEFAULT_MEDIA_RECEIVER_APP_ID: string;
                MediaInfo: new (contentId: string, contentType: string) => MediaInfo;
                LoadRequest: new (mediaInfo: MediaInfo) => LoadRequest;
            };
            AutoJoinPolicy: {
                ORIGIN_SCOPED: 'origin_scoped';
            };
        };
    };
    cast: {
        framework: {
            CastContext: {
                getInstance: () => CastContext;
            };
            CastContextEventType: {
                SESSION_STATE_CHANGED: CastContextEventType;
            };
            SessionState: {
                SESSION_STARTED: 'SESSION_STARTED';
                SESSION_RESUMED: 'SESSION_RESUMED';
            };
        };
    };
}

declare global {
    interface Window {
        chrome?: CastSdk['chrome'];
        cast?: CastSdk['cast'];
        __onGCastApiAvailable?: (isAvailable: boolean) => void;
    }
}

function hasCastSdk(value: Window): value is Window & CastSdk {
    return Boolean(
        value.cast?.framework?.CastContext?.getInstance &&
        value.cast?.framework?.CastContextEventType?.SESSION_STATE_CHANGED &&
        value.cast?.framework?.SessionState &&
        value.chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID &&
        value.chrome?.cast?.media?.MediaInfo &&
        value.chrome?.cast?.media?.LoadRequest &&
        value.chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED
    );
}

export function useCastControls({
    src,
    videoRef,
    setIsCastAvailable,
    setIsCasting
}: UseCastControlsProps) {
    const castContextRef = useRef<CastContext | null>(null);
    const loadMediaRef = useRef<() => void>(() => {});

    const isCastSdkReady = useCallback(() => {
        if (typeof window === 'undefined') return false;

        return hasCastSdk(window);
    }, []);

    const loadMedia = useCallback(() => {
        const castMedia = window.chrome?.cast?.media;
        if (!castContextRef.current || !src || !castMedia?.MediaInfo || !castMedia?.LoadRequest) return;

        const castContext = castContextRef.current;
        const session = castContext.getCurrentSession();
        if (!session) return;

        const mediaInfo = new castMedia.MediaInfo(src, 'video/mp4');
        // Handle HLS specifically if possible, though DEFAULT_MEDIA_RECEIVER supports it
        if (src.includes('.m3u8')) {
            mediaInfo.contentType = 'application/x-mpegurl';
        }

        const request = new castMedia.LoadRequest(mediaInfo);

        // Sync current time
        if (videoRef.current) {
            request.currentTime = videoRef.current.currentTime;
        }

        session.loadMedia(request).then(
            () => console.log('Cast: Media loaded successfully'),
            (error: unknown) => console.error('Cast: Media load failed', error)
        );
    }, [src, videoRef]);

    useEffect(() => {
        loadMediaRef.current = loadMedia;
    }, [loadMedia]);

    useEffect(() => {
        let sessionStateListener: ((event: SessionStateEventData) => void) | null = null;
        let onGCastApiAvailable: ((isAvailable: boolean) => void) | null = null;

        const markCastUnavailable = () => {
            castContextRef.current = null;
            setIsCastAvailable(false);
            setIsCasting(false);
        };

        // Function to initialize Cast
        const initializeCastApi = () => {
            if (typeof window === 'undefined' || !hasCastSdk(window)) {
                markCastUnavailable();
                return;
            }

            try {
                const framework = window.cast.framework;
                const castContext = framework.CastContext.getInstance();
                castContextRef.current = castContext;

                castContext.setOptions({
                    receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
                    autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
                });

                // SDK loaded — show cast button immediately.
                // requestSession() will re-scan and show Chrome's native device picker.
                setIsCastAvailable(true);

                // Monitor session state
                sessionStateListener = (event: SessionStateEventData) => {
                    const sessionState = event.sessionState;
                    const isSessionActive = sessionState === framework.SessionState.SESSION_STARTED ||
                        sessionState === framework.SessionState.SESSION_RESUMED;

                    setIsCasting(isSessionActive);

                    if (isSessionActive && videoRef.current) {
                        videoRef.current.pause();
                        loadMediaRef.current();
                    }
                };

                castContext.addEventListener(
                    framework.CastContextEventType.SESSION_STATE_CHANGED,
                    sessionStateListener
                );
            } catch (error) {
                console.warn('Cast SDK is not usable in this browser context.', error);
                markCastUnavailable();
            }
        };

        // If API is already loaded
        if (isCastSdkReady()) {
            initializeCastApi();
        } else {
            // Wait for API to be available
            onGCastApiAvailable = (isAvailable: boolean) => {
                if (isAvailable) {
                    initializeCastApi();
                } else {
                    markCastUnavailable();
                }
            };
            window.__onGCastApiAvailable = onGCastApiAvailable;
        }

        return () => {
            if (onGCastApiAvailable && window.__onGCastApiAvailable === onGCastApiAvailable) {
                delete window.__onGCastApiAvailable;
            }

            const castContext = castContextRef.current;
            const sessionStateChanged = window.cast?.framework?.CastContextEventType?.SESSION_STATE_CHANGED;
            if (
                sessionStateListener &&
                castContext?.removeEventListener &&
                sessionStateChanged
            ) {
                castContext.removeEventListener(
                    sessionStateChanged,
                    sessionStateListener
                );
            }
        };
    }, [isCastSdkReady, setIsCastAvailable, setIsCasting, videoRef]);

    const showCastMenu = useCallback(() => {
        if (typeof window === 'undefined' || !hasCastSdk(window)) return;

        try {
            window.cast.framework.CastContext.getInstance().requestSession();
        } catch (error) {
            console.warn('Cast session request failed.', error);
            setIsCastAvailable(false);
        }
    }, [setIsCastAvailable]);

    const castActions = useMemo(() => ({
        showCastMenu
    }), [showCastMenu]);

    return castActions;
}
