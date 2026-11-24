/**
 * Work-level favorites for the homepage hot zone.
 *
 * Unlike the existing favorites-store, items here are works, not playable
 * sources. A detail page can later resolve sources asynchronously from the
 * stored title/year/type, so no source id is required at save time.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { profiledKey } from '@/lib/utils/profile-storage';

export type MediaKind = 'movie' | 'tv';

export interface MediaFavorite {
  /** Stable work id, e.g. "douban:1292059". */
  id: string;
  type: MediaKind;
  title: string;
  year?: string;
  poster: string;
  backdrop?: string | null;
  rate?: string;
  overview?: string;
  tmdbId?: number;
  addedAt: number;
}

type NewMediaFavorite = Omit<MediaFavorite, 'addedAt'>;

interface MediaFavoritesState {
  items: MediaFavorite[];
}

interface MediaFavoritesActions {
  isFavorite: (id: string) => boolean;
  toggleFavorite: (item: NewMediaFavorite) => boolean;
  removeFavorite: (id: string) => void;
}

type MediaFavoritesStore = MediaFavoritesState & MediaFavoritesActions;

export const useMediaFavorites = create<MediaFavoritesStore>()(
  persist(
    (set, get) => ({
      items: [],

      isFavorite: (id) => get().items.some((item) => item.id === id),

      toggleFavorite: (item) => {
        const exists = get().items.some((favorite) => favorite.id === item.id);
        if (exists) {
          set((state) => ({ items: state.items.filter((favorite) => favorite.id !== item.id) }));
          return false;
        }
        set((state) => ({
          items: [{ ...item, addedAt: Date.now() }, ...state.items],
        }));
        return true;
      },

      removeFavorite: (id) => {
        set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
      },
    }),
    { name: profiledKey('kvideo-media-favorites') }
  )
);
