import { useEffect } from 'react';

/**
 * Hook for managing screen orientation on mobile devices
 * Auto-rotates to landscape on fullscreen, portrait on exit
 */
export function useScreenOrientation(isFullscreen: boolean) {
    useEffect(() => {
        if (typeof window === 'undefined' || !('screen' in window)) return;

        const handleOrientation = async () => {
            try {
                const orientation = window.screen.orientation;

                if (isFullscreen) {
                    // Fullscreen: Lock to landscape
                    if (orientation?.lock) {
                        await orientation.lock('landscape').catch((error: unknown) => {
                            console.warn('Could not lock orientation:', error);
                        });
                    }
                } else {
                    // Exit fullscreen: Unlock to allow portrait
                    if (orientation?.unlock) {
                        orientation.unlock();
                    }
                }
            } catch (error) {
                console.warn('Orientation API not supported:', error);
            }
        };

        handleOrientation();

        // Cleanup: Always unlock on unmount
        return () => {
            try {
                const orientation = window.screen.orientation;
                if (orientation?.unlock) {
                    orientation.unlock();
                }
            } catch (error) {
                // Ignore cleanup errors
            }
        };
    }, [isFullscreen]);
}
