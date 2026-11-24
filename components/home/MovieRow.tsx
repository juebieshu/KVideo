/**
 * MovieRow - 一个标签一行：标题 + 横向轮播
 * 标题变化时（如 电影「最新」→ 电视剧「国产剧」）旧标题向上淡出滑走，新标题从下方弹入。
 */

'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icons } from '@/components/ui/Icon';
import { MovieLane } from './MovieLane';
import { useRowMovies } from './hooks/useRowMovies';
import type { DoubanMovie } from './MovieCard';
import type { Tag } from './SortableTag';

function TitleText({ label }: { label: string | null }) {
  if (label === null) {
    return <span className="kv-skeleton inline-block h-7 w-24 rounded-md align-middle" aria-hidden="true" />;
  }
  return <span>{label}</span>;
}

export function RollingTitle({ label, delay = 0 }: { label: string | null; delay?: number }) {
  const [state, setState] = useState<{ current: string | null; previous?: string | null; version: number }>({
    current: label,
    version: 0,
  });

  if (state.current !== label) {
    setState({ current: label, previous: state.current, version: state.version + 1 });
  }

  const version = state.version;

  return (
    <span className="kv-roll" style={{ '--row-delay': `${delay}ms` } as CSSProperties}>
      {state.previous !== undefined && (
        <span
          key={`out-${version}`}
          className="kv-roll-out"
          aria-hidden="true"
          onAnimationEnd={() =>
            setState((s) => (s.version === version ? { current: s.current, version: s.version } : s))
          }
        >
          <TitleText label={state.previous} />
        </span>
      )}
      <span key={`in-${version}`} className="kv-roll-in">
        <TitleText label={state.current} />
      </span>
    </span>
  );
}

interface MovieRowShellProps {
  title: string | null;
  icon?: ReactNode;
  index: number;
  sectionRef?: React.Ref<HTMLElement>;
  /** 屏幕外：这一行的标题动画也一并冻结 */
  idle?: boolean;
  children: ReactNode;
}

function MovieRowShell({ title, icon, index, sectionRef, idle = false, children }: MovieRowShellProps) {
  return (
    <section ref={sectionRef} className={`kv-row${idle ? ' kv-row-idle' : ''}`}>
      <h2 className="kv-row-title flex items-center gap-2 text-lg font-bold tracking-tight text-[var(--text-color)] md:text-xl">
        {icon}
        {/* 逐行错开一点，标题像波浪一样依次滚动，与卡片切换的错峰一致 */}
        <RollingTitle label={title} delay={Math.min(index, 8) * 40} />
      </h2>
      {children}
    </section>
  );
}

/**
 * 视口状态：
 * - near：行接近视口（480px 内）才开始请求数据，避免一次性打出十几个请求
 * - visible：行真正在视口内才允许这一行跑动画，屏幕外的全部冻结
 */
function useRowViewport<T extends Element>(nearMargin = '480px 0px') {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);

  // 接近视口才取数据（一旦取到就不再观察）
  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: nearMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near, nearMargin]);

  // 是否在视口内（要持续观察，会来回变化）
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((e) => e.isIntersecting)),
      { rootMargin: '0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, near, visible] as const;
}

interface TagMovieRowProps {
  index: number;
  tag: Tag | null;
  contentType: 'movie' | 'tv';
  onMovieClick: (movie: DoubanMovie) => void;
}

export function TagMovieRow({ index, tag, contentType, onMovieClick }: TagMovieRowProps) {
  const [sectionRef, near, visible] = useRowViewport<HTMLElement>();
  const row = useRowMovies(tag?.value ?? null, contentType, near);

  return (
    <MovieRowShell title={tag?.label ?? null} index={index} sectionRef={sectionRef} idle={!visible}>
      <MovieLane
        label={tag?.label}
        animKey={contentType}
        dataKey={tag?.id ?? 'pending'}
        movies={row.movies}
        initialLoading={row.initialLoading}
        loadingMore={row.loadingMore}
        hasMore={row.hasMore}
        error={row.error}
        onRetry={row.retry}
        onLoadMore={row.loadMore}
        onMovieClick={onMovieClick}
        switchDelay={Math.min(index, 8) * 40}
        active={visible}
        aboveFold={index === 0}
      />
    </MovieRowShell>
  );
}

interface RecommendRowProps {
  movies: DoubanMovie[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onMovieClick: (movie: DoubanMovie) => void;
}

export function RecommendRow({ movies, loading, hasMore, onLoadMore, onMovieClick }: RecommendRowProps) {
  const [sectionRef, , visible] = useRowViewport<HTMLElement>();
  const initialLoading = movies.length === 0 && (loading || hasMore);
  if (!initialLoading && movies.length === 0) return null;
  return (
    <MovieRowShell
      title="为你推荐"
      index={0}
      sectionRef={sectionRef}
      idle={!visible}
      icon={<Icons.Sparkles size={18} className="text-[var(--accent-color)]" />}
    >
      <MovieLane
        label="为你推荐"
        animKey="recommend"
        dataKey="recommend"
        movies={movies}
        initialLoading={initialLoading}
        loadingMore={loading && movies.length > 0}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        onMovieClick={onMovieClick}
        active={visible}
        aboveFold
      />
    </MovieRowShell>
  );
}