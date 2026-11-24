'use client';

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSiteIcon } from '@/components/SiteIconProvider';
import { MIcon, materialIconMap } from '@/components/ui/Icon';
import { siteConfig } from '@/lib/config/site-config';
import { getSession, type AuthSession } from '@/lib/store/auth-store';
import { useContentTypeStore, type ContentType } from '@/lib/store/content-type-store';
import { useSidebarStore } from '@/lib/store/sidebar-store';
import { useSettingsUiStore } from '@/lib/store/settings-ui-store';

interface NavbarProps {
    onReset: () => void;
    isPremiumMode?: boolean;
}

type CategoryId = ContentType;

const useIsomorphicLayoutEffect =
    typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const focusRingClass =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--kv-color-text) focus-visible:ring-offset-2 focus-visible:ring-offset-transparent';

export function Navbar({ onReset, isPremiumMode = false }: NavbarProps) {
    const [session] = useState<AuthSession | null>(() => getSession());
    const [scrolled, setScrolled] = useState(false);
    const openSettings = useSettingsUiStore((state) => state.open);
    const contentType = useContentTypeStore((state) => state.contentType);
    const setContentType = useContentTypeStore((state) => state.setContentType);
    const activePanel = useSidebarStore((state) => state.activePanel);
    const togglePanel = useSidebarStore((state) => state.togglePanel);
    const siteIconSrc = useSiteIcon();
    const router = useRouter();

    const categoryTrackRef = useRef<HTMLDivElement>(null);
    const categoryRefs = useRef<Partial<Record<CategoryId, HTMLButtonElement | null>>>({});
    const [pillIndicator, setPillIndicator] = useState<{
        left: number;
        width: number;
        ready: boolean;
        animate: boolean;
    }>({
        left: 0,
        width: 0,
        ready: false,
        animate: false,
    });

    // 提前取好首页路由，保证点击后能立刻切页，滑动动画不会等 RSC 请求
    useEffect(() => {
        router.prefetch('/');
    }, [router]);

    // 监听滚动：微调胶囊玻璃浓度与阴影层级
    useEffect(() => {
        const updateScrolled = () => {
            setScrolled(window.scrollY > 24);
        };
        const rafId = window.requestAnimationFrame(updateScrolled);
        window.addEventListener('scroll', updateScrolled, { passive: true });
        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener('scroll', updateScrolled);
        };
    }, []);

    // 高级页不展示电影/电视剧分类高亮
    const activeCategory: CategoryId | null = isPremiumMode ? null : contentType;

    // 测量当前激活分类按钮的位置与宽度，驱动滑动胶囊动画
    const syncPillIndicator = useCallback(() => {
        if (!activeCategory) {
            setPillIndicator((prev) => (prev.ready ? { ...prev, ready: false } : prev));
            return;
        }
        const activeButton = categoryRefs.current[activeCategory];
        if (!activeButton) return;

        const nextLeft = activeButton.offsetLeft;
        const nextWidth = activeButton.offsetWidth;

        setPillIndicator((prev) => {
            if (prev.left === nextLeft && prev.width === nextWidth && prev.ready) {
                return prev;
            }
            return {
                left: nextLeft,
                width: nextWidth,
                ready: true,
                animate: prev.animate,
            };
        });
    }, [activeCategory]);

    useIsomorphicLayoutEffect(() => {
        syncPillIndicator();
        if (!pillIndicator.animate) {
            const rafId = window.requestAnimationFrame(() => {
                setPillIndicator((prev) => (prev.animate ? prev : { ...prev, animate: true }));
            });
            return () => window.cancelAnimationFrame(rafId);
        }
    }, [syncPillIndicator, pillIndicator.animate]);

    useEffect(() => {
        const trackEl = categoryTrackRef.current;
        if (!trackEl || typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver(() => {
            syncPillIndicator();
        });
        observer.observe(trackEl);
        Object.values(categoryRefs.current).forEach((btn) => {
            if (btn) observer.observe(btn);
        });
        return () => observer.disconnect();
    }, [syncPillIndicator]);

    const glassSurface = isPremiumMode
        ? 'color-mix(in srgb, #141418 78%, transparent)'
        : scrolled
            ? 'color-mix(in srgb, var(--kv-color-bg-page) 84%, transparent)'
            : 'color-mix(in srgb, var(--kv-color-bg-page) 66%, transparent)';

    const pillShadow = scrolled
        ? 'inset 0 1px 0 0 rgba(255, 255, 255, 0.14), 0 10px 28px -10px rgba(0, 0, 0, 0.45)'
        : 'inset 0 1px 0 0 rgba(255, 255, 255, 0.12), 0 8px 24px -12px rgba(0, 0, 0, 0.35)';

    const handleCategory = (category: CategoryId) => {
        setContentType(category);

        if (isPremiumMode) {
            router.push('/');
            return;
        }

        onReset();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const openAccountSettings = () => {
        if (isPremiumMode) {
            router.push('/premium/settings');
            return;
        }
        openSettings('account');
    };

    const categories: { id: CategoryId; label: string }[] = [
        { id: 'movie', label: '电影' },
        { id: 'tv', label: '电视剧' },
    ];

    const displayName = session?.name?.trim() || '账户';

    return (
        <nav
            className="pointer-events-none sticky top-0 z-[2000] px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3.5 md:px-6"
            style={{
                transform: 'translate3d(0, 0, 0)',
                willChange: 'transform',
            }}
        >
            <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3">
                {/* 左：Logo + 站点名胶囊 */}
                <div className="flex min-w-0 items-center justify-start">
                    <Link
                        href={isPremiumMode ? '/premium' : '/'}
                        className={`pointer-events-auto inline-flex h-10 min-w-0 items-center gap-2 rounded-full border border-(--kv-color-border)/65 p-1 backdrop-blur-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] sm:h-11 sm:pr-3.5 ${focusRingClass}`}
                        style={{
                            backgroundColor: glassSurface,
                            boxShadow: pillShadow,
                        }}
                        onClick={onReset}
                        data-focusable
                    >
                        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full sm:size-9">
                            <Image
                                src={siteIconSrc}
                                alt={siteConfig.name}
                                width={32}
                                height={32}
                                unoptimized
                                className="size-7 object-contain sm:size-8"
                            />
                        </span>
                        <span className="hidden truncate text-sm font-semibold tracking-tight text-(--kv-color-text) sm:inline sm:text-[15px]">
                            {siteConfig.name}
                        </span>
                    </Link>
                </div>

                {/* 中：悬浮磨砂导航胶囊（带滑动切换指示器） */}
                <div
                    className="pointer-events-auto flex h-10 items-center gap-0.5 rounded-full border border-(--kv-color-border)/65 p-1 backdrop-blur-2xl transition-all duration-300 sm:h-11 sm:gap-1"
                    style={{
                        backgroundColor: glassSurface,
                        boxShadow: pillShadow,
                    }}
                    aria-label="内容分类与个人入口"
                >
                    <div
                        ref={categoryTrackRef}
                        className="relative flex h-full items-center gap-0.5 sm:gap-1"
                    >
                        {/* 滑动高亮胶囊背景 */}
                        <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute inset-y-0 left-0 rounded-full bg-(--kv-color-text) shadow-sm motion-reduce:transition-none ${
                                pillIndicator.animate
                                    ? 'transition-[transform,width,opacity] duration-350 ease-[cubic-bezier(0.3,1.08,0.5,1)]'
                                    : 'transition-opacity duration-200'
                            } ${
                                pillIndicator.ready && activeCategory
                                    ? 'scale-100 opacity-100'
                                    : 'scale-95 opacity-0'
                            }`}
                            style={{
                                width: pillIndicator.width ? `${pillIndicator.width}px` : undefined,
                                transform: `translate3d(${pillIndicator.left}px, 0, 0)`,
                            }}
                        />

                        {categories.map((category) => {
                            const active = activeCategory === category.id;
                            return (
                                <button
                                    key={category.id}
                                    ref={(node) => {
                                        categoryRefs.current[category.id] = node;
                                    }}
                                    type="button"
                                    onClick={() => handleCategory(category.id)}
                                    aria-current={active ? 'page' : undefined}
                                    data-focusable
                                    className={`relative z-10 inline-flex h-full cursor-pointer items-center rounded-full px-3 text-xs font-semibold transition-colors duration-250 active:scale-95 sm:px-4 sm:text-sm ${focusRingClass} ${
                                        active
                                            ? 'text-(--kv-color-bg-page)'
                                            : 'text-(--kv-color-text-muted) hover:text-(--kv-color-text)'
                                    }`}
                                >
                                    {category.label}
                                </button>
                            );
                        })}
                    </div>

                    <span
                        className="mx-1 hidden h-4 w-px bg-(--kv-color-border)/80 sm:block"
                        aria-hidden="true"
                    />

                    <button
                        type="button"
                        onClick={() => togglePanel('history')}
                        aria-pressed={activePanel === 'history'}
                        data-focusable
                        className={`inline-flex h-full cursor-pointer items-center rounded-full px-2.5 text-xs font-medium transition-all duration-200 active:scale-95 sm:px-3.5 sm:text-sm ${focusRingClass} ${
                            activePanel === 'history'
                                ? 'bg-(--kv-color-text)/14 text-(--kv-color-text)'
                                : 'text-(--kv-color-text-muted) hover:bg-(--kv-color-bg-hover) hover:text-(--kv-color-text)'
                        }`}
                    >
                        历史
                    </button>

                    <button
                        type="button"
                        onClick={() => togglePanel('favorites')}
                        aria-pressed={activePanel === 'favorites'}
                        data-focusable
                        className={`inline-flex h-full cursor-pointer items-center rounded-full px-2.5 text-xs font-medium transition-all duration-200 active:scale-95 sm:px-3.5 sm:text-sm ${focusRingClass} ${
                            activePanel === 'favorites'
                                ? 'bg-(--kv-color-text)/14 text-(--kv-color-text)'
                                : 'text-(--kv-color-text-muted) hover:bg-(--kv-color-bg-hover) hover:text-(--kv-color-text)'
                        }`}
                    >
                        收藏
                    </button>
                </div>

                {/* 右：头像 + 名字 & 设置合并胶囊 */}
                <div className="flex items-center justify-end">
                    <div
                        className="pointer-events-auto flex h-10 shrink-0 items-center gap-0.5 rounded-full border border-(--kv-color-border)/65 p-1 backdrop-blur-2xl transition-all duration-300 sm:h-11 sm:gap-1"
                        style={{
                            backgroundColor: glassSurface,
                            boxShadow: pillShadow,
                        }}
                    >
                        <button
                            type="button"
                            onClick={openAccountSettings}
                            data-focusable
                            className={`inline-flex h-full cursor-pointer items-center gap-2 rounded-full pr-1.5 transition-all duration-200 hover:bg-(--kv-color-bg-hover) active:scale-95 sm:pr-3 ${focusRingClass}`}
                            aria-label={`账户：${displayName}`}
                            title={displayName}
                        >
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--kv-color-accent-soft) text-xs font-semibold text-(--kv-color-accent) sm:size-9">
                                {session?.name ? (
                                    session.name.charAt(0).toUpperCase()
                                ) : (
                                    <MIcon icon={materialIconMap.User} width={16} height={16} />
                                )}
                            </span>
                            <span className="hidden max-w-[96px] truncate text-xs font-medium text-(--kv-color-text) sm:inline sm:text-sm">
                                {displayName}
                            </span>
                        </button>

                        <span
                            className="mx-0.5 h-4 w-px shrink-0 bg-(--kv-color-border)/80"
                            aria-hidden="true"
                        />

                        <button
                            type="button"
                            onClick={openAccountSettings}
                            data-focusable
                            className={`flex size-8 cursor-pointer items-center justify-center rounded-full text-(--kv-color-text-muted) transition-all duration-200 hover:bg-(--kv-color-bg-hover) hover:text-(--kv-color-text) active:scale-90 sm:size-9 ${focusRingClass}`}
                            aria-label="设置"
                            title="设置"
                        >
                            <MIcon icon={materialIconMap.Settings} width={18} height={18} />
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}