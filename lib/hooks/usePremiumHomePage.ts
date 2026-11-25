import { useState, useRef, useEffect, useMemo, useCallback, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSearchCache } from '@/lib/hooks/useSearchCache';
import { useParallelSearch } from '@/lib/hooks/useParallelSearch';
import { useSubscriptionSync } from '@/lib/hooks/useSubscriptionSync';
import { settingsStore, type SortOption } from '@/lib/store/settings-store';
import type { VideoSource } from '@/lib/types';

const EMPTY_PREMIUM_SOURCES: VideoSource[] = [];

function subscribeToPremiumSources(listener: () => void): () => void {
    return settingsStore.subscribe(listener);
}

function getPremiumSourcesSnapshot(): string {
    const enabledSources = settingsStore.getSettings().premiumSources.filter(source => source.enabled);
    return JSON.stringify(enabledSources);
}

function getServerPremiumSourcesSnapshot(): string {
    return '[]';
}

export function usePremiumHomePage() {
    useSubscriptionSync();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { saveToCache } = useSearchCache();
    const hasLoadedCache = useRef(false);
    const hasSearchedWithSourcesRef = useRef(false);

    const initialQuery = searchParams.get('q') ?? '';
    const latestQueryRef = useRef(initialQuery);
    const [query, setQuery] = useState(initialQuery);
    const [hasRequestedSearch, setHasRequestedSearch] = useState(false);
    const [currentSortBy] = useState<SortOption>('default');

    const premiumSourcesSnapshot = useSyncExternalStore(
        subscribeToPremiumSources,
        getPremiumSourcesSnapshot,
        getServerPremiumSourcesSnapshot,
    );
    const enabledPremiumSources = useMemo<VideoSource[]>(
        () => premiumSourcesSnapshot === '[]'
            ? EMPTY_PREMIUM_SOURCES
            : JSON.parse(premiumSourcesSnapshot) as VideoSource[],
        [premiumSourcesSnapshot],
    );
    const hasSearched = hasRequestedSearch || (
        query.trim().length > 0 && enabledPremiumSources.length > 0
    );

    const onUrlUpdate = useCallback((q: string) => {
        router.replace(`/premium?q=${encodeURIComponent(q)}`, { scroll: false });
    }, [router]);

    // Search stream hook
    const {
        loading,
        results,
        availableSources,
        completedSources,
        totalSources,
        performSearch,
        resetSearch,
        cancelSearch,
        loadCachedResults,
        applySorting,
        loadMore,
        hasMore,
        loadingMore,
    } = useParallelSearch(
        saveToCache,
        onUrlUpdate
    );

    // Core search execution function - extracted to eliminate duplication
    const executeSearch = useCallback((searchQuery: string, sources: VideoSource[]) => {
        if (!searchQuery.trim() || sources.length === 0) {
            return null;
        }

        hasSearchedWithSourcesRef.current = true;
        return performSearch(searchQuery, sources, currentSortBy);
    }, [performSearch, currentSortBy]);

    // Re-sort results when sort preference changes
    useEffect(() => {
        if (hasSearched && results.length > 0) {
            applySorting(currentSortBy);
        }
    }, [currentSortBy, applySorting, hasSearched, results.length]);

    // Retry when settings asynchronously provide premium sources.
    useEffect(() => {
        const updateSettings = () => {
            const newPremiumSources = settingsStore.getSettings().premiumSources.filter(source => source.enabled);

            // If we have a query, and we haven't searched with sources yet,
            // and we suddenly have sources, trigger the search.
            if (query && newPremiumSources.length > 0 && !hasSearchedWithSourcesRef.current && !loading) {
                if (executeSearch(query, newPremiumSources)) {
                    setHasRequestedSearch(true);
                }
            }
        };

        return settingsStore.subscribe(updateSettings);
    }, [query, loading, executeSearch]);

    const handleSearch = useCallback((searchQuery: string) => {
        latestQueryRef.current = searchQuery;
        setQuery(searchQuery);
        setHasRequestedSearch(true);
        void executeSearch(searchQuery, enabledPremiumSources);
    }, [enabledPremiumSources, executeSearch]);

    // Load cached results on mount
    useEffect(() => {
        if (hasLoadedCache.current) return;
        hasLoadedCache.current = true;

        const urlQuery = searchParams.get('q');

        if (urlQuery) {
            const currentSources = settingsStore.getSettings().premiumSources.filter(source => source.enabled);
            const search = executeSearch(urlQuery, currentSources);

            if (search) {
                void search.then(() => {
                    if (latestQueryRef.current === urlQuery) {
                        setHasRequestedSearch(true);
                    }
                });
            }
            // If no sources yet, the settings subscription will start the search.
        }
    }, [searchParams, executeSearch]);

    const handleReset = () => {
        latestQueryRef.current = '';
        setHasRequestedSearch(false);
        setQuery('');
        hasSearchedWithSourcesRef.current = false;
        resetSearch();
        router.replace('/premium', { scroll: false });
    };

    return {
        query,
        hasSearched,
        loading,
        results,
        availableSources,
        completedSources,
        totalSources,
        handleSearch,
        handleReset,
        handleCancelSearch: cancelSearch,
        loadMore,
        hasMore,
        loadingMore,
    };
}
