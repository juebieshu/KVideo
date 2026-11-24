import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useSiteIcon } from '@/components/SiteIconProvider';
import { Icons, MIcon, materialIconMap } from '@/components/ui/Icon';
import { siteConfig } from '@/lib/config/site-config';
import { useSidebarStore } from '@/lib/store/sidebar-store';
import { useSettingsUiStore } from '@/lib/store/settings-ui-store';

export function PlayerNavbar({ isPremium }: { isPremium?: boolean }) {
    const router = useRouter();
    const openSettings = useSettingsUiStore((state) => state.open);
    const activePanel = useSidebarStore((state) => state.activePanel);
    const togglePanel = useSidebarStore((state) => state.togglePanel);
    const siteIconSrc = useSiteIcon();

    return (
        <nav className="sticky top-0 z-50 pt-4 pb-2 px-4" style={{ transform: 'translateZ(0)' }}>
            <div className="max-w-7xl mx-auto bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <button
                            onClick={() => router.push(isPremium ? '/premium' : '/')}
                            className="flex items-center justify-center hover:opacity-80 transition-opacity flex-shrink-0 cursor-pointer"
                            title={isPremium ? "返回高级主页" : "返回首页"}
                        >
                            <Image
                                src={siteIconSrc}
                                alt={siteConfig.name}
                                width={40}
                                height={40}
                                unoptimized
                                className="object-contain"
                            />
                        </button>
                        <Button
                            variant="secondary"
                            onClick={() => router.back()}
                            className="flex items-center gap-2"
                        >
                            <Icons.ChevronLeft size={20} />
                            <span className="hidden sm:inline">返回</span>
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => togglePanel('history')}
                            className={`h-10 px-3 flex items-center justify-center rounded-[var(--radius-full)] border text-sm font-medium transition-all duration-200 cursor-pointer ${
                                activePanel === 'history'
                                    ? 'bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)] border-[color-mix(in_srgb,var(--accent-color)_35%,transparent)] text-[var(--accent-color)]'
                                    : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]'
                            }`}
                            aria-pressed={activePanel === 'history'}
                        >
                            历史
                        </button>
                        <button
                            type="button"
                            onClick={() => togglePanel('favorites')}
                            className={`h-10 px-3 flex items-center justify-center rounded-[var(--radius-full)] border text-sm font-medium transition-all duration-200 cursor-pointer ${
                                activePanel === 'favorites'
                                    ? 'bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)] border-[color-mix(in_srgb,var(--accent-color)_35%,transparent)] text-[var(--accent-color)]'
                                    : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)]'
                            }`}
                            aria-pressed={activePanel === 'favorites'}
                        >
                            收藏
                        </button>
                        <Link
                            href={isPremium ? '/premium/settings' : '/settings'}
                            onClick={(event) => {
                                if (!isPremium) {
                                    event.preventDefault();
                                    openSettings('account');
                                }
                            }}
                            className="w-10 h-10 flex items-center justify-center rounded-[var(--radius-full)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-all duration-200 cursor-pointer"
                            aria-label="设置"
                        >
                            <MIcon icon={materialIconMap.Settings} className="w-5 h-5" />
                        </Link>
                        <ThemeSwitcher />
                    </div>
                </div>
            </div>
        </nav>
    );
}
