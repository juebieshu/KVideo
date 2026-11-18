'use client';

/**
 * PlayerSettings - 按「播放 / 弹幕」两个类目组织
 * 类目即 h2（样式与关于页一致），行布局与「隐私与数据」一致：左标题+描述、右控件
 * 弹幕管理（系统 API 地址 + 自定义 API 列表）由外层通过 danmakuApiManager 注入；
 * 未注入时（独立模式设置页）回退显示系统 API 地址行，保证功能不丢失。
 */

import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';
import { SettingRow, settingsInputClassName } from '@/components/settings/SettingRow';
import {
    DEFAULT_SEEK_STEP_SECONDS,
    MIN_SEEK_STEP_SECONDS,
    MAX_SEEK_STEP_SECONDS,
} from '@/lib/store/settings-store';

interface PlayerSettingsProps {
    fullscreenType: 'auto' | 'native' | 'window';
    onFullscreenTypeChange: (type: 'auto' | 'native' | 'window') => void;
    seekStepSeconds: number;
    onSeekStepSecondsChange: (value: number) => void;
    videoTogetherEnabled?: boolean;
    onVideoTogetherEnabledChange?: (enabled: boolean) => void;
    /** 以下三项为「未注入弹幕管理」时的回退配置（独立模式设置页使用） */
    danmakuApiUrl?: string;
    onDanmakuApiUrlChange?: (url: string) => void;
    showDanmakuApi?: boolean;
    danmakuOpacity: number;
    onDanmakuOpacityChange: (value: number) => void;
    danmakuFontSize: number;
    onDanmakuFontSizeChange: (value: number) => void;
    danmakuDisplayArea: number;
    onDanmakuDisplayAreaChange: (value: number) => void;
    /** 弹幕管理区，注入到「弹幕」类目末尾 */
    danmakuApiManager?: React.ReactNode;
}

const DANMAKU_FONT_SIZES = [14, 18, 20, 24, 28];
const DANMAKU_DISPLAY_AREAS = [
    { value: 0.25, label: '1/4屏' },
    { value: 0.5, label: '半屏' },
    { value: 0.75, label: '3/4屏' },
    { value: 1.0, label: '全屏' },
];
const SEEK_STEP_PRESETS = [5, 10, 15, 30, 60];

const selectClassName = 'w-52';

export function PlayerSettings({
    fullscreenType,
    onFullscreenTypeChange,
    seekStepSeconds,
    onSeekStepSecondsChange,
    videoTogetherEnabled,
    onVideoTogetherEnabledChange,
    danmakuApiUrl,
    onDanmakuApiUrlChange,
    showDanmakuApi = true,
    danmakuOpacity,
    onDanmakuOpacityChange,
    danmakuFontSize,
    onDanmakuFontSizeChange,
    danmakuDisplayArea,
    onDanmakuDisplayAreaChange,
    danmakuApiManager,
}: PlayerSettingsProps) {
    return (
        <div className="mx-auto w-full max-w-2xl">
            {/* 播放 */}
            <section aria-label="播放">
                <h2 className="border-b border-(--sv2-border) pb-3 text-[18px] font-semibold text-(--text-color)">播放</h2>
                <div className="mt-3">
                    <SettingRow
                        title="默认全屏方式"
                        description="选择在桌面端点击播放器全屏按钮时的行为">
                        <Select
                            className={selectClassName}
                            value={fullscreenType}
                            options={[
                                { value: 'auto' as const, label: '自动' },
                                { value: 'native' as const, label: '系统全屏' },
                                { value: 'window' as const, label: '网页全屏' },
                            ]}
                            onChange={onFullscreenTypeChange}
                            ariaLabel="默认全屏方式"
                        />
                    </SettingRow>

                    <SettingRow
                        title="快进 / 快退间隔"
                        description={`控制键盘 J / L、方向键和双击手势每次跳转的秒数（${MIN_SEEK_STEP_SECONDS}-${MAX_SEEK_STEP_SECONDS} 秒，默认 ${DEFAULT_SEEK_STEP_SECONDS} 秒）`}>
                        <div className="flex items-center gap-2">
                            <Select
                                className="w-32"
                                value={seekStepSeconds}
                                options={[
                                    ...(SEEK_STEP_PRESETS.includes(seekStepSeconds)
                                        ? []
                                        : [{ value: seekStepSeconds, label: `自定义 ${seekStepSeconds} 秒` }]),
                                    ...SEEK_STEP_PRESETS.map((seconds) => ({
                                        value: seconds,
                                        label: `${seconds} 秒`,
                                    })),
                                ]}
                                onChange={onSeekStepSecondsChange}
                                ariaLabel="快进间隔预设"
                            />
                            <input
                                type="number"
                                min={MIN_SEEK_STEP_SECONDS}
                                max={MAX_SEEK_STEP_SECONDS}
                                step="1"
                                inputMode="numeric"
                                aria-label="自定义快进秒数"
                                value={seekStepSeconds}
                                onChange={(e) => {
                                    if (e.target.value === '') return;
                                    const nextValue = Number(e.target.value);
                                    if (Number.isNaN(nextValue)) return;
                                    onSeekStepSecondsChange(nextValue);
                                }}
                                className={`w-20 ${settingsInputClassName}`}
                            />
                        </div>
                    </SettingRow>

                    {typeof videoTogetherEnabled === 'boolean' && onVideoTogetherEnabledChange && (
                        <SettingRow
                            title="一起看 (VideoTogether)"
                            description="关闭后不显示一起看悬浮入口；开启后仅在播放器页面显示，默认折叠为小图标。">
                            <Switch
                                checked={videoTogetherEnabled}
                                onChange={onVideoTogetherEnabledChange}
                                ariaLabel="一起看开关"
                            />
                        </SettingRow>
                    )}
                </div>
            </section>

            {/* 弹幕 */}
            <section aria-label="弹幕" className="mt-6">
                <h2 className="border-b border-(--sv2-border) pb-3 text-[18px] font-semibold text-(--text-color)">弹幕</h2>
                <div className="mt-3">
                    {/* 显示设置 */}
                    <SettingRow title="弹幕透明度" description="调整弹幕在画面上的不透明度">
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min="10"
                                max="100"
                                aria-label="弹幕透明度"
                                value={Math.round(danmakuOpacity * 100)}
                                onChange={(e) => onDanmakuOpacityChange(parseInt(e.target.value) / 100)}
                                className="h-2 w-36 accent-(--accent-color)"
                            />
                            <span className="w-10 shrink-0 text-right text-[12px] text-(--text-color-secondary)">
                                {Math.round(danmakuOpacity * 100)}%
                            </span>
                        </div>
                    </SettingRow>

                    <SettingRow title="弹幕字号" description="选择弹幕文字的大小">
                        <Select
                            className={selectClassName}
                            value={danmakuFontSize}
                            options={DANMAKU_FONT_SIZES.map((size) => ({
                                value: size,
                                label: `${size}px`,
                            }))}
                            onChange={onDanmakuFontSizeChange}
                            ariaLabel="弹幕字号"
                        />
                    </SettingRow>

                    <SettingRow title="弹幕显示区域" description="选择弹幕在画面中占据的垂直范围">
                        <Select
                            className={selectClassName}
                            value={danmakuDisplayArea}
                            options={DANMAKU_DISPLAY_AREAS.map(({ value, label }) => ({
                                value,
                                label,
                            }))}
                            onChange={onDanmakuDisplayAreaChange}
                            ariaLabel="弹幕显示区域"
                        />
                    </SettingRow>

                    {/* 弹幕管理：系统 API 地址 + 自定义 API 列表归在同一组 */}
                    <div className="mt-4">
                        {/* 未注入管理层时的回退：仅显示系统 API 地址 */}
                        {!danmakuApiManager && showDanmakuApi && onDanmakuApiUrlChange && (
                            <SettingRow title="弹幕 API 地址" description="配置系统弹幕聚合 API 地址">
                                <div className="w-72">
                                    <input
                                        type="text"
                                        placeholder="https://your-danmu-api.example.com"
                                        aria-label="弹幕 API 地址"
                                        value={danmakuApiUrl ?? ''}
                                        onChange={(e) => onDanmakuApiUrlChange(e.target.value)}
                                        className={settingsInputClassName}
                                    />
                                    <p className="mt-1.5 text-[12px] leading-4 text-(--text-color-secondary)">
                                        兼容{' '}
                                        <a
                                            href="https://github.com/huangxd-/danmu_api"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-(--accent-color) hover:underline">
                                            danmu_api
                                        </a>{' '}
                                        格式
                                    </p>
                                </div>
                            </SettingRow>
                        )}
                        {danmakuApiManager}
                    </div>
                </div>
            </section>
        </div>
    );
}
