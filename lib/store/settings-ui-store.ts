'use client';

import { create } from 'zustand';

export type SettingsSectionId =
  | 'account'
  | 'users'
  | 'playback'
  | 'display'
  | 'public-sources'
  | 'personal-sources'
  | 'subscriptions'
  | 'privacy'
  | 'about';

interface SettingsUiState {
  isOpen: boolean;
  section: SettingsSectionId;
  open: (section?: SettingsSectionId) => void;
  close: () => void;
  setSection: (section: SettingsSectionId) => void;
}

export const useSettingsUiStore = create<SettingsUiState>((set) => ({
  isOpen: false,
  section: 'account',
  open: (section) => set({ isOpen: true, section: section ?? 'account' }),
  close: () => set({ isOpen: false }),
  setSection: (section) => set({ section }),
}));
