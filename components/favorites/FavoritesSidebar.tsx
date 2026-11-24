/**
 * FavoritesSidebar - Main favorites sidebar component
 * Positioned on the left side of the screen (opposite to WatchHistorySidebar)
 * 入口已统一到顶部 Navbar，本组件只负责抽屉本身。
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useFavorites } from '@/lib/store/favorites-store';
import { useSidebarStore } from '@/lib/store/sidebar-store';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { FavoritesHeader } from './FavoritesHeader';
import { FavoritesList } from './FavoritesList';
import { FavoritesFooter } from './FavoritesFooter';
import { trapFocus } from '@/lib/accessibility/focus-management';

export function FavoritesSidebar({ isPremium = false }: { isPremium?: boolean }) {
    const activePanel = useSidebarStore((state) => state.activePanel);
    const closePanel = useSidebarStore((state) => state.closePanel);
    const isOpen = activePanel === 'favorites';

    const [deleteConfirm, setDeleteConfirm] = useState<{
        isOpen: boolean;
        videoId?: string;
        source?: string;
        isClearAll?: boolean;
    }>({ isOpen: false });
    const { favorites, removeFavorite, clearFavorites } = useFavorites(isPremium);
    const sidebarRef = useRef<HTMLElement>(null);
    const cleanupFocusTrapRef = useRef<(() => void) | null>(null);

    // Setup focus trap when sidebar opens
    useEffect(() => {
        if (isOpen && sidebarRef.current) {
            cleanupFocusTrapRef.current = trapFocus(sidebarRef.current);
        }

        return () => {
            if (cleanupFocusTrapRef.current) {
                cleanupFocusTrapRef.current();
                cleanupFocusTrapRef.current = null;
            }
        };
    }, [isOpen]);

    // Handle escape key to close sidebar
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                closePanel();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, closePanel]);

    // Handle delete confirmation
    const handleDeleteItem = (videoId: string | number, source: string) => {
        setDeleteConfirm({ isOpen: true, videoId: String(videoId), source });
    };

    const handleClearAll = () => {
        setDeleteConfirm({ isOpen: true, isClearAll: true });
    };

    const confirmDelete = () => {
        if (deleteConfirm.isClearAll) {
            clearFavorites();
        } else if (deleteConfirm.videoId && deleteConfirm.source) {
            removeFavorite(deleteConfirm.videoId, deleteConfirm.source);
        }
        setDeleteConfirm({ isOpen: false });
    };

    const cancelDelete = () => {
        setDeleteConfirm({ isOpen: false });
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[1999] bg-black/40 opacity-0 animate-[fadeIn_0.2s_ease-out_forwards]"
                    onClick={closePanel}
                />
            )}

            {/* Sidebar - Left side */}
            <aside
                ref={sidebarRef}
                role="complementary"
                aria-labelledby="favorites-sidebar-title"
                aria-hidden={!isOpen}
                style={{
                    transform: isOpen ? 'translate3d(0, 0, 0)' : 'translate3d(-100%, 0, 0)',
                    willChange: isOpen ? 'transform' : 'auto'
                }}
                className={`fixed top-0 left-0 bottom-0 w-[85%] sm:w-[90%] max-w-[420px] z-[2000] bg-[var(--glass-bg)] backdrop-blur-[8px] saturate-[120%] border-r border-[var(--glass-border)] rounded-tr-[var(--radius-2xl)] rounded-br-[var(--radius-2xl)] p-6 flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-transform duration-250 ease-out`}
            >
                <FavoritesHeader onClose={closePanel} />

                <FavoritesList
                    favorites={favorites}
                    onRemove={handleDeleteItem}
                    isPremium={isPremium}
                />

                <FavoritesFooter
                    hasFavorites={favorites.length > 0}
                    onClearAll={handleClearAll}
                />
            </aside>

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                title={deleteConfirm.isClearAll ? '清空收藏夹' : '取消收藏'}
                message={
                    deleteConfirm.isClearAll
                        ? '确定要清空所有收藏吗？此操作无法撤销。'
                        : '确定要取消收藏这个视频吗？'
                }
                onConfirm={confirmDelete}
                onCancel={cancelDelete}
                confirmText="确定"
                cancelText="取消"
                variant="danger"
            />
        </>
    );
}
