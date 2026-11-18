'use client';

/**
 * DisplaySettings - 显示与搜索：按「显示 / 搜索」两个类目组织
 * 类目即 h2（样式与关于页一致），行布局与「隐私与数据」一致：左标题+描述、右控件
 */

import { useState } from 'react';
import type { SearchDisplayMode, LocaleOption, SortOption } from '@/lib/store/settings-store';
import { sortOptions } from '@/lib/store/settings-helpers';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';
import { SettingRow, settingsInputClassName } from '@/components/settings/SettingRow';
import { useTheme, type Theme } from '@/components/ThemeProvider';

interface DisplaySettingsProps {
    realtimeLatency: boolean;
    searchDisplayMode: SearchDisplayMode;
    rememberScrollPosition: boolean;
    locale: LocaleOption;
    blockedCategories: string[];
    /** 搜索排序：不传时隐藏该项（独立模式设置页无排序配置） */
    sortBy?: SortOption;
    onRealtimeLatencyChange: (enabled: boolean) => void;
    onSearchDisplayModeChange: (mode: SearchDisplayMode) => void;
    onRememberScrollPositionChange: (enabled: boolean) => void;
    onLocaleChange: (locale: LocaleOption) => void;
    onBlockedCategoriesChange: (categories: string[]) => void;
    onSortChange?: (sort: SortOption) => void;
}

export function DisplaySettings({
    realtimeLatency,
    searchDisplayMode,
    rememberScrollPosition,
    locale,
    blockedCategories,
    sortBy,
    onRealtimeLatencyChange,
    onSearchDisplayModeChange,
    onRememberScrollPositionChange,
    onLocaleChange,
    onBlockedCategoriesChange,
    onSortChange,
}: DisplaySettingsProps) {
    const [newCategory, setNewCategory] = useState('');
    const { theme, setTheme } = useTheme();

    const addCategory = () => {
        const trimmed = newCategory.trim();
        if (!trimmed) return;
        if (blockedCategories.includes(trimmed)) {
            setNewCategory('');
            return;
        }
        onBlockedCategoriesChange([...blockedCategories, trimmed]);
        setNewCategory('');
    };

    const removeCategory = (cat: string) => {
        onBlockedCategoriesChange(blockedCategories.filter((c) => c !== cat));
    };

    const selectClassName = 'w-42';

    return (
        <div className="mx-auto w-full max-w-2xl">
            {/* 显示 */}
            <section aria-label="显示">
                <h2 className="border-b border-(--sv2-border) pb-3 text-[18px] font-semibold text-(--text-color)">显示</h2>
                <div className="mt-3">
                    <SettingRow title="界面语言" description="切换界面显示的中文字体（简体/繁体）">
                        <Select
                            className={selectClassName}
                            value={locale}
                            options={[
                                { value: 'zh-CN' as LocaleOption, label: '简体中文' },
                                { value: 'zh-TW' as LocaleOption, label: '繁體中文' },
                            ]}
                            onChange={onLocaleChange}
                            ariaLabel="界面语言"
                        />
                    </SettingRow>

                    <SettingRow title="外观" description="选择深色、浅色外观，或跟随系统">
                        <Select
                            className={selectClassName}
                            value={theme}
                            options={[
                                { value: 'light' as Theme, label: '浅色' },
                                { value: 'dark' as Theme, label: '深色' },
                                { value: 'system' as Theme, label: '跟随系统' },
                            ]}
                            onChange={setTheme}
                            ariaLabel="外观主题"
                        />
                    </SettingRow>

                    <SettingRow title="记住滚动位置" description="退出或刷新页面后，自动恢复到之前的滚动位置">
                        <Switch
                            checked={rememberScrollPosition}
                            onChange={onRememberScrollPositionChange}
                            ariaLabel="记住滚动位置开关"
                        />
                    </SettingRow>
                </div>
            </section>

            {/* 搜索 */}
            <section aria-label="搜索" className="mt-6">
                <h2 className="border-b border-(--sv2-border) pb-3 text-[18px] font-semibold text-(--text-color)">搜索</h2>
                <div className="mt-3">
                    <SettingRow title="搜索结果显示方式" description="选择搜索结果的展示模式">
                        <Select
                            className={selectClassName}
                            value={searchDisplayMode}
                            options={[
                                { value: 'normal' as SearchDisplayMode, label: '单独显示源' },
                                { value: 'grouped' as SearchDisplayMode, label: '合并同名源' },
                            ]}
                            onChange={onSearchDisplayModeChange}
                            ariaLabel="搜索结果显示方式"
                        />
                    </SettingRow>

                    {sortBy && onSortChange && (
                        <SettingRow title="搜索结果排序" description="选择搜索结果的默认排序方式">
                            <Select
                                className={selectClassName}
                                value={sortBy}
                                options={(Object.keys(sortOptions) as SortOption[]).map((option) => ({
                                    value: option,
                                    label: sortOptions[option],
                                }))}
                                onChange={onSortChange}
                                ariaLabel="搜索结果排序"
                            />
                        </SettingRow>
                    )}

                    <SettingRow title="实时延迟显示" description="开启后，搜索结果中的延迟数值会每 5 秒更新一次">
                        <Switch
                            checked={realtimeLatency}
                            onChange={onRealtimeLatencyChange}
                            ariaLabel="实时延迟显示开关"
                        />
                    </SettingRow>

                    {/* 内容类目过滤：控件较重，左侧标题+描述，右侧输入+添加，标签另起一行 */}
                    <div className="py-3">
                        <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-[14px] leading-5 font-medium text-(--text-color)">内容类目过滤</p>
                                <p className="mt-1 text-[12px] leading-4 text-(--text-color-secondary)">
                                    添加要从搜索结果中隐藏的类目关键词，匹配的视频将不会显示
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <input
                                    type="text"
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                                    placeholder="类目关键词"
                                    aria-label="内容类目关键词"
                                    className={`w-40 ${settingsInputClassName}`}
                                />
                                <Button type="button" onClick={addCategory} disabled={!newCategory.trim()} className="shrink-0">
                                    添加
                                </Button>
                            </div>
                        </div>
                        {blockedCategories.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {blockedCategories.map((cat) => (
                                    <span
                                        key={cat}
                                        className="inline-flex items-center gap-1.5 rounded-(--radius-full) border border-[color-mix(in_srgb,var(--danger-color)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger-color)_10%,transparent)] px-2.5 py-0.5 text-[12px] text-(--danger-color)">
                                        {cat}
                                        <button
                                            type="button"
                                            onClick={() => removeCategory(cat)}
                                            aria-label={`移除 ${cat}`}
                                            className="cursor-pointer transition-opacity hover:opacity-70">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
