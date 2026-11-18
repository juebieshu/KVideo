import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SourceManager } from '@/components/settings/SourceManager';
import type { VideoSource } from '@/lib/types';
import { DEFAULT_SOURCES } from '@/lib/api/default-sources';

interface PremiumSourceSettingsProps {
    sources: VideoSource[];
    onSourcesChange: (sources: VideoSource[]) => void;
    onRestoreDefaults: () => void;
    onAddSource: () => void;
    onEditSource?: (source: VideoSource) => void;
}

export function PremiumSourceSettings({
    sources,
    onSourcesChange,
    onRestoreDefaults,
    onAddSource,
    onEditSource,
}: PremiumSourceSettingsProps) {
    const [showAllSources, setShowAllSources] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredSources = sources.filter(source =>
        source.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        source.baseUrl.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const displayedSources = showAllSources || searchQuery
        ? filteredSources
        : filteredSources.slice(0, 10);

    const handleToggle = (id: string) => {
        const updated = sources.map(s =>
            s.id === id ? { ...s, enabled: !s.enabled } : s
        );
        onSourcesChange(updated);
    };

    const handleDelete = (id: string) => {
        const updated = sources.filter(s => s.id !== id);
        onSourcesChange(updated);
    };

    const handleReorder = (id: string, direction: 'up' | 'down') => {
        const currentIndex = sources.findIndex(s => s.id === id);
        if (currentIndex === -1) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= sources.length) return;

        const updated = [...sources];
        [updated[currentIndex], updated[newIndex]] = [updated[newIndex], updated[currentIndex]];

        // Update priorities
        updated.forEach((s, idx) => s.priority = idx + 1);
        onSourcesChange(updated);
    };

    return (
        <div className="mx-auto w-full max-w-2xl">
            <header className="mb-4 border-b border-(--sv2-border) pb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="min-w-0">
                    <h2 className="text-[18px] font-semibold text-(--text-color)">高级源管理</h2>
                    <p className="mt-1.5 text-[13px] leading-5 text-(--text-color-secondary)">
                        管理高级内容来源，调整优先级和启用状态
                    </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="normal" color="neutral" onClick={onRestoreDefaults}>
                        恢复默认
                    </Button>
                    <Button type="button" variant="solid" color="primary" onClick={onAddSource}>
                        添加源
                    </Button>
                </div>
            </header>

            <section aria-label="搜索高级源" className="border-b border-(--sv2-border) pb-4">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="搜索源..."
                        aria-label="搜索源"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-[var(--radius-2xl)] border border-(--glass-border) bg-(--glass-bg) py-2 pl-9 pr-3 text-sm text-(--text-color) placeholder:text-(--text-color-secondary) transition-colors focus:border-(--accent-color) focus:outline-none sm:h-8 sm:py-1"
                    />
                    <svg
                        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-color-secondary)"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </section>

            <section aria-label="高级源列表">
                <SourceManager
                    sources={displayedSources}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onReorder={handleReorder}
                    onEdit={onEditSource}
                    defaultIds={DEFAULT_SOURCES.map(s => s.id)}
                    deleteTitle="删除高级源"
                />

                {displayedSources.length === 0 && (
                    <p className="py-8 text-center text-[13px] text-(--text-color-secondary)">
                        没有匹配的高级源
                    </p>
                )}

                {!searchQuery && sources.length > 10 && (
                    <button
                        type="button"
                        onClick={() => setShowAllSources(!showAllSources)}
                        className="w-full cursor-pointer py-3 text-center text-[13px] text-(--text-color-secondary) transition-colors hover:text-(--text-color)"
                    >
                        {showAllSources ? '收起' : `显示全部 (${sources.length})`}
                    </button>
                )}
            </section>
        </div>
    );
}
