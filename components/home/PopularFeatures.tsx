/**
 * PopularFeatures - 首页热门内容（网飞 TV 风格）
 *
 * 每个标签一行、从上到下排列，每行是一条可左右翻页的横版卡片轮播。
 * 观看记录 ≥ 2 条时，最上方多一行「为你推荐」。
 *
 * 切换 电影 ⇄ 电视剧：
 * - 每行旧卡片整排向左滑出，完全离开后新分类的卡片再从右侧滑入（两个方向一致）
 * - 行标题向上淡出滑走，新标题从下方弹入，逐行错开
 */

'use client';

import { useState } from 'react';
import { HotFeature } from './HotFeature';
import { TagMovieRow, RecommendRow } from './MovieRow';
import type { DoubanMovie } from './MovieCard';
import type { Tag } from './SortableTag';
import { useTagManager } from './hooks/useTagManager';
import { usePersonalizedRecommendations } from './hooks/usePersonalizedRecommendations';

interface PopularFeaturesProps {
  onSearch?: (query: string) => void;
}

/** 标签还没拿到时先占几行骨架 */
const DEFAULT_SKELETON_ROWS = 4;

export function PopularFeatures({ onSearch }: PopularFeaturesProps) {
  const { tags, tagsReady, contentType } = useTagManager();

  const {
    movies: recommendMovies,
    loading: recommendLoading,
    hasMore: recommendHasMore,
    hasHistory,
    loadMore: recommendLoadMore,
  } = usePersonalizedRecommendations(false);

  // 「热门」已提升为整屏焦点区，不再作为普通横排行出现
  const rowTags = tags.filter((tag) => tag.id !== 'popular');

  const [skeletonRowCount, setSkeletonRowCount] = useState(DEFAULT_SKELETON_ROWS);
  if (tagsReady && rowTags.length > 0 && rowTags.length !== skeletonRowCount) {
    setSkeletonRowCount(rowTags.length);
  }

  const rows: (Tag | null)[] = tagsReady
    ? rowTags
    : Array.from({ length: skeletonRowCount }, () => null);

  const handleMovieClick = (movie: DoubanMovie) => {
    onSearch?.(movie.title);
  };

  const rowOffset = hasHistory ? 1 : 0;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col gap-6 md:gap-8">
        <HotFeature key={contentType} contentType={contentType} onMovieClick={handleMovieClick} />

        {hasHistory && (
          <RecommendRow
            movies={recommendMovies}
            loading={recommendLoading}
            hasMore={recommendHasMore}
            onLoadMore={recommendLoadMore}
            onMovieClick={handleMovieClick}
          />
        )}

        {/* 按位置作 key：切换分类时同一行原地播放标题滚动和卡片滑动 */}
        {rows.map((tag, i) => (
          <TagMovieRow
            key={i}
            index={i + rowOffset}
            tag={tag}
            contentType={contentType}
            onMovieClick={handleMovieClick}
          />
        ))}
      </div>
    </div>
  );
}