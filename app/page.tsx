'use client';

import { Suspense, useMemo } from 'react';
import { NoResults } from '@/components/search/NoResults';
import { PopularFeatures } from '@/components/home/PopularFeatures';
import { FavoritesSidebar } from '@/components/favorites/FavoritesSidebar';
import { WatchHistorySidebar } from '@/components/history/WatchHistorySidebar';
import { Navbar } from '@/components/layout/Navbar';
import { SearchResults } from '@/components/home/SearchResults';
import { useHomePage } from '@/lib/hooks/useHomePage';
import { useLatencyPing } from '@/lib/hooks/useLatencyPing';

function HomePage() {
  const {
    hasSearched,
    loading,
    results,
    availableSources,
    handleSearch,
    handleReset,
  } = useHomePage();

  // Real-time latency pinging
  const sourceUrls = useMemo(() =>
    availableSources.flatMap((source) =>
      source.baseUrl ? [{ id: source.id, baseUrl: source.baseUrl }] : []
    ),
    [availableSources]
  );

  const { latencies } = useLatencyPing({
    sourceUrls,
    enabled: hasSearched && results.length > 0,
  });

  return (
    <div className="min-h-screen">
      {/* Glass Navbar */}
      <Navbar onReset={handleReset} />

      {/* 主内容：不设统一宽度，各部件自行配置 */}
      <main className="pb-20">
        {/* 搜索结果 */}
        {results.length > 0 && (
          <div className="kv-content">
            <SearchResults
              results={results}
              availableSources={availableSources}
              loading={loading}
              latencies={latencies}
            />
          </div>
        )}

        {/* 首页内容行：通栏铺开，边缘渐隐由每一行自己处理 */}
        {!loading && !hasSearched && <PopularFeatures onSearch={handleSearch} />}

        {/* 无结果 */}
        {!loading && hasSearched && results.length === 0 && (
          <div className="kv-content">
            <NoResults onReset={handleReset} />
          </div>
        )}
      </main>

      {/* Favorites / History Sidebar - 入口在顶部 Navbar */}
      <FavoritesSidebar />
      <WatchHistorySidebar />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[var(--accent-color)] border-t-transparent"></div>
      </div>
    }>
      <HomePage />
    </Suspense>
  );
}
