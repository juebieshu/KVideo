'use client';

import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
} from 'react';
import { Icons } from '@/components/ui/Icon';
import { useMediaFavorites } from '@/lib/store/media-favorites-store';
import { useRowMovies } from './hooks/useRowMovies';
import { MovieCard, MovieCardSkeleton, type DoubanMovie } from './MovieCard';

interface HotFeatureProps {
  contentType: 'movie' | 'tv';
  onMovieClick: (movie: DoubanMovie) => void;
}

interface HotEnrichment {
  key: string;
  matched: boolean;
  provider: 'tmdb' | 'none';
  confidence: 'high' | 'medium' | 'low';
  tmdbId?: number;
  overview?: string;
  backdrop?: string | null;
  poster?: string | null;
  voteAverage?: number;
  voteCount?: number;
}

interface SettledBackdrop {
  src: string;
  isFallback: boolean;
}

const POSTER_COUNT = 10;

function ScrambleRating({ value }: { value: string }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const clean = value.trim();
    if (!clean) return;

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const id = window.setTimeout(() => setDisplay(clean), 0);
      return () => window.clearTimeout(id);
    }

    const digits = '0123456789';
    const steps = 5;
    const stepMs = 45;
    const timers: number[] = [];

    for (let i = 0; i < steps; i += 1) {
      const timer = window.setTimeout(() => {
        setDisplay(
          clean.replace(/\d/g, () => digits[Math.floor(Math.random() * digits.length)])
        );
      }, i * stepMs);
      timers.push(timer);
    }

    const finalTimer = window.setTimeout(() => {
      setDisplay(clean);
    }, steps * stepMs);
    timers.push(finalTimer);

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [value]);

  return <span className="kv-hot-rating-value">{display}</span>;
}

export function HotFeature({ contentType, onMovieClick }: HotFeatureProps) {
  const { movies, initialLoading } = useRowMovies('热门', contentType, true);
  const [selection, setSelection] = useState<{ id: string | null; dir: 1 | -1 }>({
    id: null,
    dir: 1,
  });
  const [enrichment, setEnrichment] = useState<Record<string, HotEnrichment>>({});
  const [enrichFailed, setEnrichFailed] = useState(false);
  const [loadedMap, setLoadedMap] = useState<Record<string, true>>({});
  const [settledBackdrop, setSettledBackdrop] = useState<SettledBackdrop | null>(null);
  const [imgErrorMap, setImgErrorMap] = useState<Record<string, true>>({});
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const requestedRef = useRef<Set<string>>(new Set());
  const postersRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isFavorite = useMediaFavorites((state) => state.isFavorite);
  const toggleFavorite = useMediaFavorites((state) => state.toggleFavorite);

  const posters = movies.slice(0, POSTER_COUNT);
  const activeIndex = Math.max(
    0,
    posters.findIndex((movie) => movie.id === selection.id)
  );
  const lead = posters[activeIndex] ?? movies[0];

  const updateScrollEdges = useCallback(() => {
    const el = postersRef.current;
    if (!el) return;
    setCanScrollPrev(el.scrollLeft > 8);
    setCanScrollNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(updateScrollEdges);
    const el = postersRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return () => window.cancelAnimationFrame(rafId);
    }
    const ro = new ResizeObserver(updateScrollEdges);
    ro.observe(el);
    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [posters.length, updateScrollEdges]);

  const selectMovieWithDirection = useCallback(
    (movieId: string) => {
      const nextIndex = posters.findIndex((m) => m.id === movieId);
      const dir: 1 | -1 = nextIndex >= activeIndex ? 1 : -1;
      setSelection({ id: movieId, dir });
    },
    [posters, activeIndex]
  );

  const handlePosterClick = useCallback(
    (movie: DoubanMovie, isActive: boolean) => {
      if (isActive) {
        onMovieClick(movie);
        return;
      }
      selectMovieWithDirection(movie.id);
      cardRefs.current[movie.id]?.scrollIntoView({
        behavior: 'smooth',
        inline: 'nearest',
        block: 'nearest',
      });
    },
    [onMovieClick, selectMovieWithDirection]
  );

  // TV 遥控器 / 键盘方向键聚焦时自动切换主视觉并居中
  const handlePosterFocus = useCallback(
    (movie: DoubanMovie, event: FocusEvent<HTMLDivElement>) => {
      const isTvMode = document.body.classList.contains('tv-mode');
      const isKeyboardFocus =
        event.target instanceof HTMLElement && event.target.matches(':focus-visible');
      if (!isTvMode && !isKeyboardFocus) return;

      selectMovieWithDirection(movie.id);
      cardRefs.current[movie.id]?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    },
    [selectMovieWithDirection]
  );

  const scrollPosters = useCallback((dir: -1 | 1) => {
    const el = postersRef.current;
    if (!el) return;
    const distance = Math.max(280, Math.round(el.clientWidth * 0.65));
    el.scrollBy({ left: dir * distance, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (movies.length === 0) return;
    const reqKey = `${contentType}:${movies[0]?.id ?? ''}:${movies.length}`;
    if (requestedRef.current.has(reqKey)) return;
    requestedRef.current.add(reqKey);

    const controller = new AbortController();

    const run = async () => {
      setEnrichFailed(false);
      try {
        const response = await fetch('/api/metadata/hot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entities: movies.slice(0, POSTER_COUNT + 1).map((movie) => ({
              key: movie.id,
              title: movie.title,
              type: contentType,
            })),
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          if (!controller.signal.aborted) setEnrichFailed(true);
          return;
        }
        const data: { results?: HotEnrichment[] } = await response.json();
        if (controller.signal.aborted) return;
        const next: Record<string, HotEnrichment> = {};
        for (const item of data.results ?? []) next[item.key] = item;
        setEnrichment(next);
      } catch {
        if (!controller.signal.aborted) setEnrichFailed(true);
      }
    };

    run();

    return () => {
      controller.abort();
      requestedRef.current.delete(reqKey);
    };
  }, [movies, contentType]);

  const enrich = lead ? enrichment[lead.id] : undefined;
  const backdrop = enrich?.backdrop ?? null;
  const posterSrc =
    lead && contentType === 'movie' && enrich?.confidence === 'high' && enrich.poster
      ? enrich.poster
      : lead?.cover;

  const tmdbBackdropUsable = Boolean(backdrop) && !imgErrorMap[backdrop!];
  const blurPosterUsable = Boolean(posterSrc) && !imgErrorMap[posterSrc!];
  const backdropState: 'pending' | 'ok' | 'none' | 'bg' =
    !enrich && !enrichFailed
      ? 'pending'
      : tmdbBackdropUsable
        ? 'ok'
        : blurPosterUsable
          ? 'none'
          : 'bg';
  const backdropSrc: string | null =
    backdropState === 'ok'
      ? backdrop
      : backdropState === 'none'
        ? (posterSrc ?? null)
        : null;
  const isFallback = backdropState === 'none';

  const isSameAsSettled = Boolean(
    settledBackdrop &&
      backdropSrc === settledBackdrop.src &&
      isFallback === settledBackdrop.isFallback
  );
  const incomingReady = Boolean(backdropSrc && loadedMap[backdropSrc]);
  const isTransitioning = Boolean(lead && backdropSrc && !isSameAsSettled && incomingReady);

  if (!initialLoading && !lead) return null;

  const overview = enrich?.overview?.trim() || '';
  const favoriteId = lead ? `douban:${lead.id}` : '';
  const faved = favoriteId ? isFavorite(favoriteId) : false;

  const doubanRate = lead ? parseFloat(lead.rate) : NaN;
  const hasDouban = Number.isFinite(doubanRate) && doubanRate > 0;
  const tmdbRate =
    typeof enrich?.voteAverage === 'number' && enrich.voteAverage > 0
      ? enrich.voteAverage
      : null;

  const mainRateText = hasDouban
    ? tmdbRate !== null
      ? ((doubanRate + tmdbRate) / 2).toFixed(1)
      : doubanRate.toFixed(1)
    : '';

  const handleFavorite = () => {
    if (!lead) return;
    toggleFavorite({
      id: `douban:${lead.id}`,
      type: contentType,
      title: lead.title,
      poster: posterSrc ?? lead.cover,
      backdrop,
      rate: lead.rate,
      overview,
      tmdbId: enrich?.tmdbId,
    });
  };

  return (
    <section className="kv-hot" aria-label="热门焦点">
      <div
        className="kv-hot-media"
        style={{ '--hot-dir': selection.dir } as CSSProperties}
        aria-hidden="true"
      >
        {!settledBackdrop && backdropState !== 'bg' && (
          <div className="kv-skeleton kv-hot-backdrop" />
        )}

        {settledBackdrop && (
          <div
            key={`settled-${settledBackdrop.src}-${settledBackdrop.isFallback ? 'fb' : 'hd'}`}
            className={`kv-hot-layer kv-hot-layer--settled${
              isTransitioning ? ' kv-hot-layer--receding' : ''
            }`}
          >
            <Image
              src={settledBackdrop.src}
              alt=""
              fill
              unoptimized
              decoding="async"
              referrerPolicy="no-referrer"
              className={`kv-hot-backdrop${
                settledBackdrop.isFallback ? ' kv-hot-backdrop--fallback' : ''
              }`}
              sizes="100vw"
            />
          </div>
        )}

        {lead && backdropSrc && !isSameAsSettled && (
          <div
            key={`incoming-${backdropSrc}-${isFallback ? 'fb' : 'hd'}`}
            className={`kv-hot-layer kv-hot-layer--incoming${
              incomingReady ? ' kv-hot-layer--in' : ' kv-hot-layer--hidden'
            }`}
            onAnimationEnd={(e) => {
              if (e.target !== e.currentTarget) return;
              setSettledBackdrop({ src: backdropSrc, isFallback });
            }}
          >
            <Image
              src={backdropSrc}
              alt=""
              fill
              unoptimized
              decoding="async"
              priority
              referrerPolicy="no-referrer"
              className={`kv-hot-backdrop${isFallback ? ' kv-hot-backdrop--fallback' : ''}`}
              sizes="100vw"
              onLoad={() =>
                setLoadedMap((prev) =>
                  prev[backdropSrc] ? prev : { ...prev, [backdropSrc]: true }
                )
              }
              onError={() =>
                setImgErrorMap((prev) =>
                  prev[backdropSrc] ? prev : { ...prev, [backdropSrc]: true }
                )
              }
            />
          </div>
        )}

        <div className="kv-hot-scrim" />
      </div>

      <div className="kv-hot-hero">
        <div className="kv-hot-copy">
          {lead ? (
            <>
              <div key={lead.id} className="kv-hot-text">
                <h1 className="kv-hot-title">{lead.title}</h1>

                {overview && (
                  <p key={overview} className="kv-hot-intro">
                    {overview}
                  </p>
                )}
              </div>

              <div className="kv-hot-actions">
                <button
                  type="button"
                  className="kv-hot-primary"
                  onClick={() => onMovieClick(lead)}
                >
                  <Icons.Play size={15} />
                  播放
                </button>
                <button
                  type="button"
                  className="kv-hot-fav"
                  onClick={handleFavorite}
                  aria-pressed={faved}
                  aria-label={faved ? '取消收藏' : '收藏'}
                  title={faved ? '已收藏' : '收藏'}
                >
                  {faved ? <Icons.HeartFilled size={18} /> : <Icons.Heart size={18} />}
                </button>

                {mainRateText && (
                  <div
                    className="kv-hot-rating"
                    tabIndex={0}
                    aria-label={`综合评分 ${mainRateText}`}
                  >
                    <span className="kv-hot-rating-main">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2.5l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.4l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2.5z" />
                      </svg>
                      <ScrambleRating value={mainRateText} />
                    </span>

                    <span className="kv-hot-rating-drawer" aria-hidden="true">
                      <span className="kv-hot-rating-drawer-inner">
                        <span className="kv-hot-rating-sep" />
                        <span className="kv-hot-rating-item">
                          <span className="kv-hot-rating-tag">豆瓣</span>
                          <span className="kv-hot-rating-num">{doubanRate.toFixed(1)}</span>
                        </span>
                        <span className="kv-hot-rating-item">
                          <span className="kv-hot-rating-tag">TMDB</span>
                          <span className="kv-hot-rating-num">
                            {tmdbRate !== null ? tmdbRate.toFixed(1) : '—'}
                          </span>
                        </span>
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="kv-hot-loading" aria-busy="true">
              <span className="kv-skeleton kv-skeleton-line h-11 w-64" />
              <span className="kv-skeleton kv-skeleton-line mt-4 h-4 w-72" />
            </div>
          )}
        </div>
      </div>

      <div className="kv-hot-posters-wrap">
        <div
          ref={postersRef}
          className="kv-hot-posters"
          role="list"
          aria-label="热门海报"
          onScroll={updateScrollEdges}
        >
          {initialLoading
            ? Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="kv-hot-card"
                  style={{ '--i': Math.min(index, 5) } as CSSProperties}
                >
                  <MovieCardSkeleton portrait />
                </div>
              ))
            : posters.map((movie, index) => {
                const active = movie.id === lead?.id;
                const movieEnrich = enrichment[movie.id];
                const cover =
                  contentType === 'movie' && movieEnrich?.confidence === 'high' && movieEnrich.poster
                    ? movieEnrich.poster
                    : movie.cover;
                return (
                  <div
                    key={movie.id}
                    ref={(node) => {
                      cardRefs.current[movie.id] = node;
                    }}
                    role="listitem"
                    className={`kv-hot-card${active ? ' kv-hot-card--active' : ''}`}
                    style={{ '--i': Math.min(index, 5) } as CSSProperties}
                    onFocusCapture={(e) => handlePosterFocus(movie, e)}
                  >
                    <MovieCard
                      movie={{ ...movie, cover }}
                      onMovieClick={() => handlePosterClick(movie, active)}
                      portrait
                      showMeta={false}
                      eager={index < 3}
                      highPriority={index === 0}
                    />
                  </div>
                );
              })}
        </div>

        <button
          type="button"
          tabIndex={-1}
          className="kv-arrow kv-arrow-prev kv-hot-arrow"
          aria-label="向左滚动"
          disabled={!canScrollPrev}
          onClick={() => scrollPosters(-1)}
        >
          <Icons.ChevronLeft size={18} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="kv-arrow kv-arrow-next kv-hot-arrow"
          aria-label="向右滚动"
          disabled={!canScrollNext}
          onClick={() => scrollPosters(1)}
        >
          <Icons.ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}