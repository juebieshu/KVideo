/**
 * MovieGrid - Grid layout for movie cards with infinite scroll
 * Handles movie display and loading states
 */

import { MovieCard, MovieCardSkeleton } from './MovieCard';
import { Icons } from '@/components/ui/Icon';

interface DoubanMovie {
  id: string;
  title: string;
  cover: string;
  rate: string;
  url: string;
}

interface MovieGridProps {
  movies: DoubanMovie[];
  loading: boolean;
  hasMore: boolean;
  onMovieClick: (movie: DoubanMovie) => void;
  prefetchRef: React.RefObject<HTMLDivElement | null>;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
}

export function MovieGrid({
  movies,
  loading,
  hasMore,
  onMovieClick,
  prefetchRef,
  loadMoreRef
}: MovieGridProps) {
  if (movies.length === 0 && !loading) {
    return <MovieGridEmpty />;
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {movies.map((movie) => (
          <MovieCard
            key={movie.id}
            movie={movie}
            onMovieClick={onMovieClick}
          />
        ))}
      </div>

      {/* Prefetch Trigger - Earlier */}
      {hasMore && !loading && <div ref={prefetchRef} className="h-1" />}

      {/* Loading Indicator */}
      {loading && <MovieGridLoading />}

      {/* Intersection Observer Target */}
      {hasMore && !loading && <div ref={loadMoreRef} className="h-20" />}

      {/* No More Content */}
      {!hasMore && movies.length > 0 && <MovieGridNoMore />}
    </>
  );
}

function MovieGridLoading() {
  // 骨架屏代替旋转加载动画
  return (
    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 md:mt-6" aria-busy="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{ ['--vi' as string]: i % 4 }}>
          <MovieCardSkeleton />
        </div>
      ))}
    </div>
  );
}

function MovieGridNoMore() {
  return (
    <div className="text-center py-12">
      <p className="text-[var(--text-color-secondary)]">没有更多内容了</p>
    </div>
  );
}

function MovieGridEmpty() {
  return (
    <div className="text-center py-20">
      <Icons.Film size={64} className="text-[var(--text-color-secondary)] mx-auto mb-4" />
      <p className="text-[var(--text-color-secondary)]">暂无内容</p>
    </div>
  );
}
