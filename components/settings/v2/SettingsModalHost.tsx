'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSettingsUiStore } from '@/lib/store/settings-ui-store';
import { SettingsSurface } from './SettingsSurface';

export function SettingsModalHost() {
  const isOpen = useSettingsUiStore((state) => state.isOpen);
  const close = useSettingsUiStore((state) => state.close);

  const previousFocus = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(isOpen);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      return;
    }

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

  if (!mounted || !portalTarget) return null;

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
    portalTarget,
  );
}