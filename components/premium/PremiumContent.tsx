'use client';

import { TagManager } from '@/components/home/TagManager';
import { MovieGrid } from '@/components/home/MovieGrid';
import { PremiumContentGrid } from './PremiumContentGrid';
import { usePremiumTagManager } from '@/lib/hooks/usePremiumTagManager';
import { usePremiumContent } from '@/lib/hooks/usePremiumContent';
import { usePersonalizedRecommendations } from '@/components/home/hooks/usePersonalizedRecommendations';

interface PremiumContentProps {
    onSearch?: (query: string) => void;
}

export function PremiumContent({ onSearch }: PremiumContentProps) {
    const {
        tags,
        selectedTag,
        newTagInput,
        showTagManager,
        justAddedTag,
        setNewTagInput,
        setShowTagManager,
        setJustAddedTag,
        handleAddTag,
        handleDeleteTag,
        handleRestoreDefaults,
        handleDragEnd,
    } = usePremiumTagManager();

    const {
        movies: recommendMovies,
        loading: recommendLoading,
        hasMore: recommendHasMore,
        hasHistory,
        prefetchRef: recommendPrefetchRef,
        loadMoreRef: recommendLoadMoreRef,
    } = usePersonalizedRecommendations(true);

    // Track whether the recommendation tab is active
    // 标签选择入口已移除，有观看记录时推荐始终生效，不再需要本地 state 同步
    const effectiveRecommendSelected = hasHistory;

    // Get the category value from selected tag
    const categoryValue = tags.find(t => t.id === selectedTag)?.value || '';

    const {
        videos,
        loading,
        hasMore,
        prefetchRef,
        loadMoreRef,
    } = usePremiumContent(effectiveRecommendSelected ? '' : categoryValue);

    const handleVideoClick = (video: { vod_name?: string; title?: string }) => {
        if (onSearch) {
            onSearch(video.vod_name || video.title || '');
        }
    };

    return (
        <div className="animate-fade-in">
            <TagManager
                tags={tags}
                showTagManager={showTagManager}
                newTagInput={newTagInput}
                justAddedTag={justAddedTag}
                onTagDelete={handleDeleteTag}
                onToggleManager={() => setShowTagManager(!showTagManager)}
                onRestoreDefaults={handleRestoreDefaults}
                onNewTagInputChange={setNewTagInput}
                onAddTag={handleAddTag}
                onDragEnd={handleDragEnd}
                onJustAddedTagHandled={() => setJustAddedTag(false)}
            />

            {effectiveRecommendSelected ? (
                <MovieGrid
                    movies={recommendMovies}
                    loading={recommendLoading}
                    hasMore={recommendHasMore}
                    onMovieClick={handleVideoClick}
                    prefetchRef={recommendPrefetchRef}
                    loadMoreRef={recommendLoadMoreRef}
                />
            ) : (
                <PremiumContentGrid
                    videos={videos}
                    loading={loading}
                    hasMore={hasMore}
                    onVideoClick={handleVideoClick}
                    prefetchRef={prefetchRef}
                    loadMoreRef={loadMoreRef}
                />
            )}
        </div>
    );
}
