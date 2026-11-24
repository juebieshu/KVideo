/**
 * MovieCard - 网飞 TV 风格横版卡片
 * 海报铺满整张卡片，剧名和评分悬浮在左下角。
 */

'use client';

import { memo, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Icons } from '@/components/ui/Icon';

export interface DoubanMovie {
  id: string;
  title: string;
  cover: string;
  rate: string;
  url: string;
}

interface MovieCardProps {
  movie: DoubanMovie;
  onMovieClick: (movie: DoubanMovie) => void;
  /** 首屏可见：立即加载，别等懒加载判断（LCP 元素） */
  eager?: boolean;
  /** 首屏里最靠前的一张，额外提成高优先级 */
  highPriority?: boolean;
  /** 竖版 2:3 卡片（热门区下方海报） */
  portrait?: boolean;
  /** 热门区海报卡不需要标题和评分 */
  showMeta?: boolean;
  className?: string;
}

const PLACEHOLDER = '/placeholder-poster.svg';

/** 横版会裁掉竖版海报的上下部分，换成豆瓣的大图，避免放大后发糊 */
function largeCover(url: string) {
  return url.replace(/\/[sm]_ratio_poster\//, '/l_ratio_poster/');
}

// 加载结果按 URL 记在模块级：切换分类时组件会 remount，
// 图片明明还在浏览器缓存里，不该再闪一下骨架；失败过的也不再反复重试
const loadedUrls = new Set<string>();
const failedUrls = new Set<string>();

function initialIndex(sources: string[]) {
  const ok = sources.findIndex((s) => loadedUrls.has(s));
  if (ok >= 0) return ok;
  const fresh = sources.findIndex((s) => !failedUrls.has(s));
  return fresh >= 0 ? fresh : sources.length - 1;
}

export const MovieCard = memo(function MovieCard({
  movie,
  onMovieClick,
  eager = false,
  highPriority = false,
  portrait = false,
  showMeta = true,
  className = '',
}: MovieCardProps) {
  // 依次尝试：大图 → 原图 → 占位图 → 纯文字
  const sources = useMemo(() => {
    const large = largeCover(movie.cover);
    return large !== movie.cover ? [large, movie.cover, PLACEHOLDER] : [movie.cover, PLACEHOLDER];
  }, [movie.cover]);
  const [srcIndex, setSrcIndex] = useState(() => initialIndex(sources));
  const [loadedSrc, setLoadedSrc] = useState<string | null>(() => {
    const s = sources[initialIndex(sources)];
    return s !== undefined && loadedUrls.has(s) ? s : null;
  });

  const src = sources[srcIndex];
  // 只认 load 事件：图片完整到位前骨架一直盖着，不会露出半加载状态
  const loaded = src !== undefined && loadedSrc === src;
  const rate = parseFloat(movie.rate);
  const hasRate = Number.isFinite(rate) && rate > 0;

  return (
    <Link
      href={`/?q=${encodeURIComponent(movie.title)}`}
      onClick={(e) => {
        // 按住修饰键时保留默认行为（新标签页打开等）
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onMovieClick(movie);
      }}
      data-focusable
      aria-label={hasRate ? `${movie.title}，豆瓣 ${movie.rate} 分` : movie.title}
      className={['kv-card', portrait ? 'kv-card--portrait' : '', 'group cursor-pointer', className]
        .filter(Boolean)
        .join(' ')}
    >
      {src !== undefined && (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          unoptimized
          decoding="async"
          loading={eager ? 'eager' : undefined}
          fetchPriority={highPriority ? 'high' : undefined}
          referrerPolicy="no-referrer"
          sizes="(max-width: 860px) 50vw, (max-width: 1240px) 33vw, 25vw"
          className={`kv-poster object-cover ${loaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ objectPosition: '50% 22%' }}
          onLoad={() => {
            loadedUrls.add(src);
            setLoadedSrc(src);
          }}
          onError={() => {
            failedUrls.add(src);
            setSrcIndex((i) => i + 1);
          }}
        />
      )}

      {/* 骨架盖在海报上层：海报完整加载（onLoad）后才淡出，淡出过程即海报的显现过渡 */}
      <div
        className={`kv-skeleton kv-card-skeleton absolute inset-0 ${loaded ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        aria-hidden="true"
      />

      <div className="kv-card-shade" aria-hidden="true" />

      {/* 左下角：平时只有一行小剧名，hover / 聚焦后遮罩、完整剧名和评分才浮现 */}
      {showMeta && <div className="kv-card-meta absolute inset-x-0 bottom-0 z-10 p-3 md:p-4">
        <h3
          className="max-w-[92%] text-left text-sm font-bold leading-snug text-white line-clamp-1 group-hover:line-clamp-2 group-focus-visible:line-clamp-2 md:text-[15px]"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,.6), 0 4px 16px rgba(0,0,0,.45)' }}
        >
          {movie.title}
        </h3>

        {/* 评分行收起时不占高度：剧名平时贴着卡片底部，hover 后评分在下方展开 */}
        <div className="kv-card-extra">
          <div className="kv-card-extra-clip">
            <div className="mt-1.5 flex items-center gap-2">
              {hasRate && (
                <span
                  role="link"
                  tabIndex={-1}
                  title="在豆瓣中查看"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation(); // 不触发外层卡片的搜索
                    window.open(movie.url, '_blank', 'noopener,noreferrer');
                  }}
                  className="kv-rate inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-black/75 md:text-xs"
                >
                  <Icons.StarFilled size={11} className="fill-yellow-400 text-yellow-400" />
                  {movie.rate}
                </span>
              )}
              <span className="kv-card-hint inline-flex items-center gap-1 text-[11px] font-medium text-white/80 md:text-xs">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 4.5v15a1 1 0 0 0 1.52.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5Z" />
                </svg>
                搜索播放
              </span>
            </div>
          </div>
        </div>
      </div>}
    </Link>
  );
});

/** 骨架卡片：和真实卡片同尺寸，左下角模拟剧名和评分 */
export function MovieCardSkeleton({ portrait = false }: { portrait?: boolean }) {
  return (
    <div
      className={`kv-skeleton relative rounded-[10px] ${portrait ? 'aspect-[2/3]' : 'aspect-video'}`}
      aria-hidden="true"
    >
      <div className="absolute bottom-3 left-3 right-3 md:bottom-4 md:left-4">
        <span className="kv-skeleton-line h-3.5 w-1/2" />
        <span className="kv-skeleton-line mt-2 h-3 w-10" />
      </div>
    </div>
  );
}
