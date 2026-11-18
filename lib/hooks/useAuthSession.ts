'use client';

import { useSyncExternalStore } from 'react';
import { getSession, type AuthSession } from '@/lib/store/auth-store';

let cachedKey: string | null = null;
let cachedSession: AuthSession | null = null;

function getSnapshot(): AuthSession | null {
  const session = getSession();
  const key = session ? JSON.stringify(session) : 'null';

  if (key !== cachedKey) {
    cachedKey = key;
    cachedSession = session;
  }

  return cachedSession;
}

function getServerSnapshot(): AuthSession | null {
  return null;
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('kvideo-session-changed', onStoreChange);
  return () => window.removeEventListener('kvideo-session-changed', onStoreChange);
}

export function useAuthSession(): AuthSession | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
