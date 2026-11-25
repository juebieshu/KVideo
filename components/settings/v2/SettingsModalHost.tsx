'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useSettingsUiStore } from '@/lib/store/settings-ui-store';
import { SettingsSurface } from './SettingsSurface';

function subscribeToHydration(): () => void {
  return () => {};
}

function getHydratedSnapshot(): boolean {
  return true;
}

function getServerHydratedSnapshot(): boolean {
  return false;
}

export function SettingsModalHost() {
  const isOpen = useSettingsUiStore((state) => state.isOpen);
  const close = useSettingsUiStore((state) => state.close);
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );

  const previousFocus = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(isOpen);

  if (isOpen && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (isOpen) return;

    const timer = window.setTimeout(() => setMounted(false), 200);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocus.current = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus({ preventScroll: true });
    };
  }, [close, isOpen]);

  if (!mounted || !isHydrated) return null;

  return createPortal(
    <div
      aria-hidden={!isOpen}
      className={`settings-modal-overlay fixed inset-0 z-3000 flex items-center justify-center overflow-hidden overscroll-contain bg-black/60 p-0 md:p-8 ${
        isOpen ? 'is-open' : 'is-closing pointer-events-none'
      }`}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <SettingsSurface variant="modal" onClose={close} />
    </div>,
    document.body,
  );
}