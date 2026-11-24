/**
 * MovieLane - 单行横向轮播
 *
 * - 左右按钮每次移动一张卡片；卡片像车流一样依次启动（沿运动方向最前面的先动，后面的跟上）
 * - 左右边缘大面积渐隐，卡片经过边缘时柔和地淡入淡出
 * - animKey 变化（电影 ⇄ 电视剧）时：旧卡片整排向左滑出（共滚过 可视张数 + 2 的距离，
 *   滑出层左缘多带 1 张、右缘多带 2 张，边缘卡片不会突然消失），
 *   滑出过半新卡片就从右侧接力滑入。两个方向都一样，统一从右向左运动
 * - 动画可打断：切换发生在动画中途时，捕获卡片当前的位移 / 透明度作为滑出起点，
 *   从原位继续运动，不闪回、不跳变
 * - 触屏左右滑动、键盘聚焦到屏外卡片时自动移动
 *
 * DOM 结构与职责（每层只做一件事，方便单独调整）：
 *   .kv-lane              定位上下文，承载左右箭头
 *   └─ .kv-lane-viewport  只负责裁切（overflow: clip），不再挂 mask
 *      ├─ .kv-lane-fade    独立的左右渐隐覆盖层，pointer-events: none
 *      ├─ .kv-track        卡片轨道（flex 布局 + 留白 + 整体位移）
 *      │  └─ .kv-slot × N  每张卡片的宽度与位移
 *      │     └─ .kv-slot-inner  入场/出场动画 + 边缘 blur
 *      │        └─ MovieCard
 *      └─ .kv-lane-ghost × N  切换分类时的滑出层
 *
 * 渐隐之所以从 viewport 剥离成 fade 层：mask 会作用于视口内全部内容，
 * 卡片 hover 放大（scale 1.05）伸进渐隐区时会被淡出、圆角被削平。
 * 独立覆盖层 + hover 卡片 z-index 提升，让放大后的卡片完整显示。
 */

'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
  type TouchEvent,
  type MouseEvent,
} from 'react';
import { MovieCard, MovieCardSkeleton, type DoubanMovie } from './MovieCard';

interface MovieLaneProps {
  /** 变化时播放「滑出 → 滑入」，例如 contentType */
  animKey: string;
  /** 同一分类下数据源变化（标签加载完成、重新排序等）时回到第一页 */
  dataKey: string;
  movies: DoubanMovie[];
  initialLoading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error?: boolean;
  onRetry?: () => void;
  onLoadMore: () => void;
  onMovieClick: (movie: DoubanMovie) => void;
  label?: string;
  /** 行与行之间的切换错峰（ms），让分组像波浪一样依次换片 */
  switchDelay?: number;
  /** 这一行是否在视口内。屏幕外的行会冻结所有动画，不占用 CPU */
  active?: boolean;
  /** 首屏第一行：窗口内的海报立即加载（它就是 LCP 元素，不能等懒加载判断） */
  aboveFold?: boolean;
}

// ── 动画常量（时长 / 错峰必须与 home.css 里 kv-out / kv-in 保持一致）──────────
const STAGGER_MS = 26;
const EXIT_MS = 440;
const EXIT_STAGGER_MS = 18;
const ENTER_MS = 520;
const ENTER_STAGGER_MS = 26;
// 旧卡片几乎完全滑出视口后，新卡片才开始接力滑入（0.9 ≈ 只留最后一点重叠，
// 视觉上是「先滑出、再滑入」，而不是两层同时动的叠化）
const ENTER_START_RATIO = 0.9;
/** 滑出层最多同时保留的层数，连续快速切换时丢弃最旧的一层 */
const MAX_GHOST_LAYERS = 2;
/** 触屏滑动判定：横向位移超过这个距离，且明显大于纵向位移才算一次翻页 */
const SWIPE_THRESHOLD_PX = 40;
const SWIPE_DIRECTION_RATIO = 1.2;
/** 到头时的橡皮筋回弹幅度与时长 */
const NUDGE_DISTANCE_PX = 14;
const NUDGE_DURATION_MS = 360;

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function perViewFor(width: number) {
  if (width < 520) return 2;
  if (width < 860) return 2;
  if (width < 1240) return 3;
  return 4;
}

interface Snapshot {
  movies: DoubanMovie[];
  skeletons: number;
  start: number;
  perView: number;
}

interface Ghost extends Snapshot {
  id: number;
  /** 打断时捕获的每张可见卡片的当前位移 / 透明度，作为滑出动画的起点 */
  from?: { tx: number; o: number }[];
  /** 是否已经开始滑出：false 时静止在原位等着 */
  running: boolean;
}

type LaneStyle = CSSProperties & Record<`--${string}`, string | number>;

// ── 容器列数：随容器宽度变化 ───────────────────────────────────────────
function usePerView(ref: RefObject<HTMLDivElement | null>) {
  const [perView, setPerView] = useState(4);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setPerView(perViewFor(el.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return perView;
}

// ── 触屏手势：左右滑动翻页，滑动结束后吞掉随之而来的误触点击 ──────────────
function useLaneSwipe(onSwipe: (dir: 1 | -1) => void) {
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);

  const onTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
    swipedRef.current = false;
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const startPoint = touchRef.current;
      touchRef.current = null;
      if (!startPoint) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startPoint.x;
      const dy = t.clientY - startPoint.y;
      if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_DIRECTION_RATIO) {
        swipedRef.current = true;
        onSwipe(dx < 0 ? 1 : -1);
      }
    },
    [onSwipe]
  );

  const onClickCapture = useCallback((e: MouseEvent<HTMLDivElement>) => {
    // 滑动结束时不要误触卡片
    if (swipedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      swipedRef.current = false;
    }
  }, []);

  return { onTouchStart, onTouchEnd, onClickCapture };
}

/**
 * 入场动画挂在每张卡片自己身上，播完（animationend）才摘掉 class：
 * 容器级的定时清理只负责「不再给新卡片发动画」，不会截断任何正在播的动画。
 * 拿到过的动画 class 会被锁住，窗口期结束也不会中途剥掉。
 */
function SlotInner({
  animClass,
  blurred = false,
  children,
}: {
  animClass: string;
  blurred?: boolean;
  children: ReactNode;
}) {
  const [held, setHeld] = useState(animClass);
  const [done, setDone] = useState(false);
  // 准备态 → 开跑 是两次不同的 class，两者的起始帧完全一致，所以替换时看不出跳变
  if (animClass !== '' && animClass !== held && !done) setHeld(animClass);
  const className = ['kv-slot-inner', held, blurred ? 'kv-blurred' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={className}
      onAnimationEnd={
        held !== ''
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              setHeld('');
              setDone(true);
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

/**
 * 滑出层的切片：除可见卡片外，左侧多带 1 张、右侧多带 2 张一起滑，
 * 整排移动时右缘始终有卡片补位，边缘卡片不会突然消失。
 */
function sliceGhost(ghost: Ghost) {
  const sliceStart = Math.max(0, ghost.start - 1);
  const sliceEnd = Math.min(
    ghost.movies.length + ghost.skeletons,
    ghost.start + ghost.perView + 2
  );
  const count = Math.max(0, sliceEnd - sliceStart);
  const ghostMovies = ghost.movies.slice(sliceStart, sliceEnd);
  const ghostSkeletons = Math.max(0, count - ghostMovies.length);
  // 轨道左移量：让第一张可见卡对齐窗口 0 号位（左侧多渲染的卡片停在窗口外）
  const shift = ghost.start - sliceStart;
  // from 捕获时按可见窗口对齐（0 = 第一张可见卡），左侧多出的插槽补空位
  const from = ghost.from
    ? [...Array.from({ length: shift }, () => undefined), ...ghost.from]
    : undefined;
  return { ghostMovies, ghostSkeletons, shift, from };
}

function LaneGhost({ ghost, children }: { ghost: Ghost; children: ReactNode }) {
  return (
    <div
      className={`kv-lane-ghost ${ghost.running ? 'kv-lane-exit' : 'kv-lane-exit-prep'}`}
      style={{ '--pv': ghost.perView } as LaneStyle}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

export function MovieLane({
  animKey,
  dataKey,
  movies,
  initialLoading,
  loadingMore,
  hasMore,
  error = false,
  onRetry,
  onLoadMore,
  onMovieClick,
  label,
  switchDelay = 0,
  active = true,
  aboveFold = false,
}: MovieLaneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const perView = usePerView(rootRef);

  // ── 当前位置：分类 / 数据源变化时在渲染阶段直接归零（不播放归位动画） ──
  const resetKey = `${animKey}::${dataKey}`;
  const [position, setPosition] = useState({ key: resetKey, start: 0 });
  let rawStart = position.start;
  if (position.key !== resetKey) {
    rawStart = 0;
    setPosition({ key: resetKey, start: 0 });
  }

  const skeletons = initialLoading && movies.length === 0 ? perView + 1 : loadingMore ? perView : 0;
  const total = movies.length + skeletons;
  const maxStart = Math.max(0, total - perView);
  const start = Math.min(rawStart, maxStart);

  // 车流动画的参照：上一次从哪里出发、往哪个方向
  const [motion, setMotion] = useState<{ from: number; dir: 1 | -1 }>({ from: 0, dir: 1 });

  const moveTo = useCallback(
    (next: number, dir: 1 | -1) => {
      setMotion({ from: start, dir });
      setPosition({ key: resetKey, start: next });
    },
    [start, resetKey]
  );

  const nudge = useCallback((dir: 1 | -1) => {
    // 尊重系统的减少动态效果设置
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // 到头了：橡皮筋轻轻回弹
    trackRef.current?.animate(
      [
        { transform: 'translate3d(0,0,0)' },
        { transform: `translate3d(${dir * -NUDGE_DISTANCE_PX}px,0,0)` },
        { transform: 'translate3d(0,0,0)' },
      ],
      { duration: NUDGE_DURATION_MS, easing: 'cubic-bezier(0.3, 1.08, 0.5, 1)' }
    );
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => {
      const next = dir === 1 ? Math.min(start + 1, maxStart) : Math.max(start - 1, 0);
      if (next === start) {
        if (dir === 1 && hasMore) onLoadMore();
        nudge(dir);
        return;
      }
      moveTo(next, dir);
    },
    [start, maxStart, hasMore, onLoadMore, nudge, moveTo]
  );

  const swipeHandlers = useLaneSwipe(go);

  // 快翻到末尾时提前加载下一页
  useEffect(() => {
    if (!hasMore || loadingMore || initialLoading || movies.length === 0) return;
    if (start + perView * 2 >= movies.length) onLoadMore();
  }, [start, perView, movies.length, hasMore, loadingMore, initialLoading, onLoadMore]);

  // ── 切换分类：保存旧画面做滑出层 ─────────────────────
  const lastRenderRef = useRef<Snapshot>({ movies, skeletons, start, perView });
  const prevAnimKeyRef = useRef(animKey);
  const ghostIdRef = useRef(0);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  // 轨道 remount 的钥匙：切换时先在 layout effect 里捕获旧画面，再 +1 触发 remount，
  // 保证捕获时旧 DOM 还在，且整个过程发生在绘制前
  const [trackVersion, setTrackVersion] = useState(0);
  const [enter, setEnter] = useState<{ key: string; className: string }>({
    key: animKey,
    className: 'kv-anim-appear',
  });

  // 新卡片在旧卡片滑出过半时入场：退出总时长 × 比例
  const enterDelay = Math.round((EXIT_MS + EXIT_STAGGER_MS * perView) * ENTER_START_RATIO);

  // 注意顺序：这个 effect 必须在更新 lastRenderRef 的 effect 之前声明
  useIsoLayoutEffect(() => {
    if (prevAnimKeyRef.current === animKey) return;
    prevAnimKeyRef.current = animKey;

    // 动画中途被切换打断时，读出每张可见卡片当前的位移 / 透明度，
    // 滑出层从这个状态接力，视觉上完全连续、不闪回
    let from: { tx: number; o: number }[] | undefined;
    if (trackRef.current) {
      const snap = lastRenderRef.current;
      const inners = trackRef.current.querySelectorAll<HTMLElement>('.kv-slot-inner');
      // 准备态里的卡片停在动画起点（右侧），拿它当接力起点会瞬移，直接放弃捕获
      const preparing = inners[0]?.classList.contains('kv-anim-prep') ?? false;
      if (!preparing) {
        from = [];
        for (let i = snap.start; i < snap.start + snap.perView; i++) {
          const el = inners[i];
          if (!el) break;
          const t = getComputedStyle(el).transform;
          const m = t && t !== 'none' ? t.match(/matrix\(([^)]+)\)/) : null;
          from.push({
            tx: m ? parseFloat(m[1].split(',')[4]) : 0,
            o: parseFloat(getComputedStyle(el).opacity),
          });
        }
      }
    }

    // 打断时旧的滑出层继续播完，最多同时保留两层；
    // 上一轮还停在准备态的层要立刻开跑，否则它会永远静止在原处挡住视线
    const ghostId = ++ghostIdRef.current;
    setGhosts((gs) =>
      [
        ...gs.map((g) => (g.running ? g : { ...g, running: true })),
        { ...lastRenderRef.current, from, id: ghostId, running: false },
      ].slice(-MAX_GHOST_LAYERS)
    );
    // 新卡片先进入准备态：摆到动画起点（右侧、不可见），并提前建好合成层。
    // 这一帧要重建整条轨道（卡片重新挂载），所以不能让动画同时开跑
    setEnter({ key: animKey, className: 'kv-anim-prep' });
    setTrackVersion((v) => v + 1);

    let cancelled = false;
    // 等浏览器把上面这些重活做完并绘制一帧，再统一开跑：
    // 此刻只剩 transform / opacity，动画起步就不会被 DOM 重建拖住
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        setGhosts((gs) => gs.map((g) => (g.id === ghostId ? { ...g, running: true } : g)));
        setEnter({ key: animKey, className: 'kv-anim-in' });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [animKey]);

  useIsoLayoutEffect(() => {
    lastRenderRef.current = { movies, skeletons, start, perView };
  });

  useEffect(() => {
    if (ghosts.length === 0) return;
    // 每层滑出的卡片同时挂载、时长确定，各自定时移除是安全的
    const timers = ghosts.map((g) => {
      const total = switchDelay + EXIT_MS + EXIT_STAGGER_MS * g.perView + 120;
      return window.setTimeout(
        () => setGhosts((gs) => gs.filter((x) => x.id !== g.id)),
        total
      );
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [ghosts, switchDelay]);

  // 入场窗口结束后不再给新追加的卡片发动画；已拿到动画的卡片各自播完才摘 class
  useEffect(() => {
    // 准备态不能被这个定时器清掉：那会让卡片突然回到原位，看起来就是跳变
    if (enter.className !== 'kv-anim-in') return;
    const total =
      switchDelay + enterDelay + ENTER_MS + ENTER_STAGGER_MS * (perView + 1) + 200;
    const timer = window.setTimeout(() => setEnter((e) => ({ ...e, className: '' })), total);
    return () => window.clearTimeout(timer);
  }, [enter, enterDelay, perView, switchDelay]);

  // ── 渲染辅助 ─────────────────────────────────────────
  const delayFor = (i: number) => {
    const { from, dir } = motion;
    // 沿运动方向最前面的那张先动，后面依次跟上
    const order = dir === 1 ? i - from : from + perView - 1 - i;
    return Math.max(0, Math.min(order, perView * 2)) * STAGGER_MS;
  };

  const visibleIndex = (i: number, s: number, pv: number) => Math.max(0, Math.min(i - s, pv));

  /**
   * 边缘景深：卡片滑出内容区（进入两侧留白）时按深入程度叠加模糊。
   *
   * 返回 -1 表示不需要滤镜；
   * 0 表示窗口两端的卡片（保留一个 0px 的 filter 作为过渡锚点，
   * 否则 filter 从 none 变成 blur() 无法插值，翻页时会突然糊一下）；
   * 1 起表示已经进入留白区，越往外越糊。
   */
  const edgeDepth = (i: number, s: number, pv: number) => {
    const rel = i - s;
    if (rel < 0) return Math.min(-rel, 3);
    if (rel >= pv) return Math.min(rel - pv + 1, 3);
    if (rel === 0 || rel === pv - 1) return 0;
    return -1;
  };

  const renderSlots = (
    list: DoubanMovie[],
    skeletonCount: number,
    s: number,
    pv: number,
    interactive: boolean,
    from?: ({ tx: number; o: number } | undefined)[]
  ) => {
    const count = list.length + skeletonCount;
    const animClass = interactive && enter.key === animKey ? enter.className : '';
    return Array.from({ length: count }, (_, i) => {
      const movie = list[i];
      const vi = visibleIndex(i, s, pv);
      const style: LaneStyle = { '--vi': vi };
      if (interactive) style['--delay'] = `${delayFor(i)}ms`;
      const depth = edgeDepth(i, s, pv);
      const blurred = depth >= 0;
      if (blurred) style['--blur'] = `${depth > 0 ? Math.min(depth, 3) * 1.6 : 0}px`;
      const f = from?.[i];
      if (f) {
        style['--from-x'] = `${f.tx}px`;
        style['--from-o'] = f.o;
      }
      return (
        <div
          key={i}
          className="kv-slot"
          style={style}
          aria-hidden={movie ? undefined : true}
          onFocusCapture={
            interactive
              ? () => {
                  if (i < s) moveTo(Math.max(0, i), -1);
                  else if (i >= s + pv) moveTo(Math.min(i - pv + 1, maxStart), 1);
                }
              : undefined
          }
        >
          <SlotInner animClass={animClass} blurred={blurred}>
            {movie ? (
              <MovieCard
                key={movie.id}
                movie={movie}
                onMovieClick={onMovieClick}
                eager={aboveFold && i >= s && i < s + pv}
                highPriority={aboveFold && i === s}
              />
            ) : (
              <MovieCardSkeleton />
            )}
          </SlotInner>
        </div>
      );
    });
  };

  const isEmpty = !initialLoading && movies.length === 0;
  const canPrev = start > 0;
  const canNext = start < maxStart || hasMore;

  return (
    <div
      ref={rootRef}
      className={`kv-lane${active ? '' : ' kv-lane-idle'}`}
      style={{ '--switch-delay': `${switchDelay}ms` } as LaneStyle}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      aria-busy={initialLoading || loadingMore}
    >
      <div
        className="kv-lane-viewport"
        style={{ '--pv': perView } as LaneStyle}
        onScroll={(e) => {
          if (e.currentTarget.scrollLeft !== 0) e.currentTarget.scrollLeft = 0;
        }}
        {...swipeHandlers}
      >
        {/* 左右渐隐：独立覆盖层，只盖住留白区；hover 放大的卡片 z-index 更高，
            不会被它裁掉边缘 */}
        <div className="kv-lane-fade" aria-hidden="true" />

        <div key={trackVersion} style={{ '--enter-delay': `${enterDelay}ms` } as LaneStyle}>
          {isEmpty ? (
            <div className="kv-track">
              <div className="kv-slot" style={{ transform: 'none' }}>
                <div className="kv-slot-inner flex aspect-video flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[var(--glass-border)] text-sm text-[var(--text-color-secondary)]">
                  {error ? (
                    <>
                      <span>加载失败</span>
                      {onRetry && (
                        <button
                          type="button"
                          onClick={onRetry}
                          className="cursor-pointer rounded-full bg-[var(--accent-color)] px-4 py-1 text-xs font-semibold text-white"
                        >
                          重试
                        </button>
                      )}
                    </>
                  ) : (
                    <span>暂无内容</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div ref={trackRef} className="kv-track" style={{ '--start': start } as LaneStyle}>
              {renderSlots(movies, skeletons, start, perView, true)}
            </div>
          )}
        </div>

        {/* 滑出层盖在卡片上方、渐隐层之下：旧卡片向左滑出过半，
            新卡片就从右侧接力滑入 */}
        {ghosts.map((ghost) => {
          const { ghostMovies, ghostSkeletons, shift, from } = sliceGhost(ghost);
          return (
            <LaneGhost key={ghost.id} ghost={ghost}>
              <div className="kv-track" style={{ '--start': shift } as LaneStyle}>
                {renderSlots(ghostMovies, ghostSkeletons, shift, ghost.perView, false, from)}
              </div>
            </LaneGhost>
          );
        })}
      </div>

      <button
        type="button"
        className="kv-arrow kv-arrow-prev"
        aria-label="向左移动一张"
        disabled={!canPrev}
        onClick={() => go(-1)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        className="kv-arrow kv-arrow-next"
        aria-label="向右移动一张"
        disabled={!canNext}
        onClick={() => go(1)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
