'use client';

import { create } from 'zustand';

export type ContentType = 'movie' | 'tv';

const STORAGE_KEY = 'kvideo_default_content_type';

interface ContentTypeState {
  contentType: ContentType;
  setContentType: (type: ContentType) => void;
}

function readStoredContentType(): ContentType {
  if (typeof window === 'undefined') return 'movie';
  return window.localStorage.getItem(STORAGE_KEY) === 'tv' ? 'tv' : 'movie';
}

export const useContentTypeStore = create<ContentTypeState>((set) => ({
  contentType: readStoredContentType(),
  setContentType: (type) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, type);
    }
    set({ contentType: type });
  },
}));
