'use client';

import { create } from 'zustand';

/**
 * 全局抽屉状态：收藏 / 观看历史。
 * 入口统一放在顶部 Navbar，抽屉组件自身不再渲染浮动按钮。
 */
export type SidebarPanel = 'favorites' | 'history';

interface SidebarState {
  activePanel: SidebarPanel | null;
  openPanel: (panel: SidebarPanel) => void;
  closePanel: () => void;
  togglePanel: (panel: SidebarPanel) => void;
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  activePanel: null,
  openPanel: (panel) => set({ activePanel: panel }),
  closePanel: () => set({ activePanel: null }),
  togglePanel: (panel) =>
    set({ activePanel: get().activePanel === panel ? null : panel }),
}));
