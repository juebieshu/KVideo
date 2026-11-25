import { useState, useEffect, useCallback, useRef } from 'react';
import { useInfiniteScroll } from '@/lib/hooks/useInfiniteScroll';
import { settingsStore } from '@/lib/store/settings-store';
import type { SourceSubscription, Video, VideoSource } from '@/lib/types';

type PremiumSubscription = SourceSubscription & Partial<Pick<VideoSource, 'group' | 'enabled'>>;

function isPremiumSubscription(source: SourceSubscription): source is PremiumSubscription {
    return (source as PremiumSubscription).group === 'premium';
}

interface PremiumContentState {
    category: string;
    videos: Video[];
    loading: boolean;
    hasMore: boolean;
    page: number;
}

interface PremiumPageResult {
    videos: Video[];
    hasMore: boolean;
}

const PAGE_LIMIT = 20;

export function usePremiumContent(categoryValue: string) {
    const [state, setState] = useState<PremiumContentState>(() => ({
        category: categoryValue,
        videos: [],
        loading: true,
        hasMore: true,
        page: 1,
    }));
    const requestIdRef = useRef(0);
    const loadingRef = useRef(false);

    const fetchPremiumPage = useCallback(async (
        category: string,
        pageNum: number,
    ): Promise<PremiumPageResult | null> => {
        const settings = settingsStore.getSettings();
        // Resolve all relevant sources (premium sources + subscriptions that might be premium)
        // For simplicity, we send all enabled premium sources.
        const premiumSources = [
            ...settings.premiumSources,
            // Check if any subscription sources are marked as premium
            ...settings.subscriptions.filter(isPremiumSubscription)
        ].filter(s => s.enabled !== false);

        if (premiumSources.length === 0) {
            return null;
        }

        // Should we include normal subscriptions too if categoryValue requests them?
        // The API handles filtering by categoryValue map.
        // If categoryValue is empty (Recommend), we use all enabled premium sources.
        const response = await fetch('/api/premium/category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sources: premiumSources,
                category,
                page: pageNum.toString(),
                limit: PAGE_LIMIT.toString()
            })
        });

        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        const newVideos: Video[] = data.videos || [];

        return {
            videos: newVideos,
            hasMore: newVideos.length === PAGE_LIMIT,
        };
    }, []);

    const loadVideos = useCallback((pageNum: number, append = false) => {
        if (loadingRef.current) return;

        const requestId = ++requestIdRef.current;
        loadingRef.current = true;
        setState(previous => ({ ...previous, page: pageNum, loading: true }));

        void fetchPremiumPage(categoryValue, pageNum).then(result => {
            if (requestId !== requestIdRef.current) return;

            setState(previous => ({
                ...previous,
                category: categoryValue,
                videos: result
                    ? append
                        ? [...previous.videos, ...result.videos]
                        : result.videos
                    : previous.videos,
                hasMore: result ? result.hasMore : previous.hasMore,
                loading: false,
                page: pageNum,
            }));
        }).catch((error: unknown) => {
            if (requestId !== requestIdRef.current) return;

            console.error('Failed to load videos:', error);
            setState(previous => ({
                ...previous,
                category: categoryValue,
                hasMore: false,
                loading: false,
                page: pageNum,
            }));
        }).finally(() => {
            if (requestId === requestIdRef.current) {
                loadingRef.current = false;
            }
        });
    }, [categoryValue, fetchPremiumPage]);

    // Fetch on mount and when the category changes. The category-keyed state
    // derivation below clears stale results without a synchronous effect reset.
    useEffect(() => {
        const requestId = ++requestIdRef.current;
        loadingRef.current = true;

        void fetchPremiumPage(categoryValue, 1).then(result => {
            if (requestId !== requestIdRef.current) return;

            setState({
                category: categoryValue,
                videos: result?.videos ?? [],
                hasMore: result?.hasMore ?? true,
                page: 1,
                loading: false,
            });
        }).catch((error: unknown) => {
            if (requestId !== requestIdRef.current) return;

            console.error('Failed to load videos:', error);
            setState({
                category: categoryValue,
                videos: [],
                hasMore: false,
                page: 1,
                loading: false,
            });
        }).finally(() => {
            if (requestId === requestIdRef.current) {
                loadingRef.current = false;
            }
        });

        return () => {
            if (requestId === requestIdRef.current) {
                requestIdRef.current += 1;
                loadingRef.current = false;
            }
        };
    }, [categoryValue, fetchPremiumPage]);

    const isCategoryPending = state.category !== categoryValue;
    const videos = isCategoryPending ? [] : state.videos;
    const loading = isCategoryPending || state.loading;
    const hasMore = isCategoryPending ? true : state.hasMore;
    const page = isCategoryPending ? 1 : state.page;

    // Subscribe to settings changes to handle async source loading.
    useEffect(() => {
        const handleSettingsUpdate = () => {
            const settings = settingsStore.getSettings();
            const premiumSources = [
                ...settings.premiumSources,
                ...settings.subscriptions.filter(isPremiumSubscription)
            ].filter(s => s.enabled !== false);

            // If we have 0 videos and suddenly gain sources, retry loading.
            if (
                !isCategoryPending &&
                videos.length === 0 &&
                premiumSources.length > 0 &&
                !loadingRef.current
            ) {
                loadVideos(1, false);
            }
        };

        return settingsStore.subscribe(handleSettingsUpdate);
    }, [isCategoryPending, videos.length, loadVideos]);

    const { prefetchRef, loadMoreRef } = useInfiniteScroll({
        hasMore,
        loading,
        page,
        onLoadMore: (nextPage) => {
            loadVideos(nextPage, true);
        },
    });

    return {
        videos,
        loading,
        hasMore,
        prefetchRef,
        loadMoreRef,
    };
}
