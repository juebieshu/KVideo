'use client';

import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: 'light' | 'dark';
}

interface ThemeViewTransition {
  finished: Promise<void>;
  skipTransition: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => Theme;
  setTheme: (theme: Theme) => void;
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';

  try {
    const saved = window.localStorage.getItem('theme');
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  } catch {
    return 'system';
  }
}

function getServerThemeSnapshot(): Theme {
  return 'system';
}

function createThemeStore(): ThemeStore {
  let snapshot = readStoredTheme();
  const listeners = new Set<() => void>();

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      const handleStorage = (event: StorageEvent) => {
        if (event.key !== 'theme' && event.key !== null) return;
        snapshot = readStoredTheme();
        listener();
      };
      window.addEventListener('storage', handleStorage);

      return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', handleStorage);
      };
    },
    getSnapshot: () => snapshot,
    setTheme: (nextTheme) => {
      snapshot = nextTheme;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('theme', nextTheme);
        } catch {
          // Keep the in-memory theme when storage is unavailable.
        }
      }
      listeners.forEach((listener) => listener());
    },
  };
}

function getSystemThemeSnapshot(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getServerSystemThemeSnapshot(): 'light' | 'dark' {
  return 'dark';
}

function subscribeToSystemTheme(listener: () => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', listener);
  return () => mediaQuery.removeEventListener('change', listener);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeStore] = useState(createThemeStore);
  const theme = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    getServerThemeSnapshot,
  );
  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemThemeSnapshot,
    getServerSystemThemeSnapshot,
  );
  const actualTheme = theme === 'system' ? systemTheme : theme;
  const transitionRef = React.useRef<ThemeViewTransition | null>(null);

  useEffect(() => {
    const applyTheme = () => {
      document.documentElement.setAttribute('data-theme', theme);
    };

    const applyThemeWithTransition = () => {
      // Abort previous transition if it exists
      if (transitionRef.current) {
        try {
          transitionRef.current.skipTransition();
        } catch (e) {
          // Ignore if transition already finished
        }
      }

      // Check if document is visible - skip transition if hidden
      if (document.hidden) {
        applyTheme();
        return;
      }

      // Check if View Transition API is supported
      const transitionDocument = document as Document & {
        startViewTransition?: (callback: () => void) => ThemeViewTransition;
      };
      if (typeof transitionDocument.startViewTransition === 'function') {
        try {
          transitionRef.current = transitionDocument.startViewTransition(() => {
            applyTheme();
          });
          
          // Clear ref after transition completes or fails
          if (transitionRef.current) {
            transitionRef.current.finished
              .then(() => { transitionRef.current = null; })
              .catch((error: Error) => { 
                // Silently handle transition errors (visibility changes, etc.)
                transitionRef.current = null;
              });
          }
        } catch (error) {
          // Fallback if transition fails to start
          applyTheme();
        }
      } else {
        // Fallback for browsers that don't support View Transition API
        applyTheme();
      }
    };

    applyThemeWithTransition();

    // Listen for visibility changes to abort transitions
    const handleVisibilityChange = () => {
      if (document.hidden && transitionRef.current) {
        try {
          transitionRef.current.skipTransition();
        } catch (e) {
          // Ignore
        }
        transitionRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Abort any pending transition on unmount
      if (transitionRef.current) {
        try {
          transitionRef.current.skipTransition();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [theme, actualTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: themeStore.setTheme, actualTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
