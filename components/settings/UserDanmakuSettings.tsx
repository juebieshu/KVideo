'use client';

/**
 * UserDanmakuSettings - 弹幕管理（系统 API 地址 + 自定义 API 列表）
 * 作为「弹幕」类目内的一组嵌入，不再自带页头；行布局与「隐私与数据」一致。
 */

import { useMemo, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Menu } from '@/components/ui/Menu';
import { userSourcesStore, type DanmakuApiEntry } from '@/lib/store/user-sources-store';
import { hasPermission } from '@/lib/store/auth-store';
import { settingsInputClassName } from '@/components/settings/SettingRow';

interface UserDanmakuSettingsProps {
    /** 系统弹幕聚合 API 地址（由外层设置 store 提供，保持响应式） */
    systemApiUrl: string;
    onSystemApiUrlChange: (url: string) => void;
    /** 是否显示系统 API 地址配置（对应 danmaku_api 权限） */
    showSystemApi?: boolean;
}

interface DanmakuSettingsSnapshot {
    danmakuApis: DanmakuApiEntry[];
    activeDanmakuApiId: string | null;
}

const SERVER_DANMAKU_SETTINGS: DanmakuSettingsSnapshot = {
    danmakuApis: [],
    activeDanmakuApiId: null,
};

function subscribeToUserSources(listener: () => void): () => void {
    return userSourcesStore.subscribe(listener);
}

function getDanmakuSettingsSnapshot(): string {
    const state = userSourcesStore.getState();
    return JSON.stringify({
        danmakuApis: state.danmakuApis,
        activeDanmakuApiId: state.activeDanmakuApiId,
    });
}

function getServerDanmakuSettingsSnapshot(): string {
    return JSON.stringify(SERVER_DANMAKU_SETTINGS);
}

export function UserDanmakuSettings({
    systemApiUrl,
    onSystemApiUrlChange,
    showSystemApi = true,
}: UserDanmakuSettingsProps) {
    const settingsSnapshot = useSyncExternalStore(
        subscribeToUserSources,
        getDanmakuSettingsSnapshot,
        getServerDanmakuSettingsSnapshot,
    );
    const { danmakuApis: apis, activeDanmakuApiId: activeId } = useMemo(
        () => JSON.parse(settingsSnapshot) as DanmakuSettingsSnapshot,
        [settingsSnapshot],
    );
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    const [pendingRemove, setPendingRemove] = useState<DanmakuApiEntry | null>(null);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !url.trim()) {
            setError('请输入名称和 API 地址');
            return;
        }
        try {
            new URL(url);
        } catch {
            setError('请输入有效的 URL');
            return;
        }
        const id = `danmaku-${Date.now().toString(36)}`;
        userSourcesStore.addDanmakuApi({ id, name: name.trim(), url: url.trim() });
        setName('');
        setUrl('');
        setError('');
    };

    const radioClassName = (active: boolean) =>
        `flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-(--accent-color)' : 'border-(--glass-border)'
        }`;

    return (
        <div>
            {/* 系统 API 地址 */}
            {showSystemApi && (
                <div className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                        <p className="text-[14px] leading-5 font-medium text-(--text-color)">弹幕 API 地址</p>
                        <p className="mt-1 text-[12px] leading-4 text-(--text-color-secondary)">
                            系统弹幕聚合 API，兼容 danmu_api 格式
                        </p>
                    </div>
                    <div className="w-72 shrink-0">
                        <input
                            type="text"
                            placeholder="https://your-danmu-api.example.com"
                            aria-label="弹幕 API 地址"
                            value={systemApiUrl}
                            onChange={(e) => onSystemApiUrlChange(e.target.value)}
                            className={settingsInputClassName}
                        />
                    </div>
                </div>
            )}

            {/* 自定义 API：添加 + 选择当前使用的接口 */}
            <div className="mt-4">
                <p className="text-[14px] leading-5 font-medium text-(--text-color)">自定义弹幕 API</p>
                <p className="mt-1 text-[12px] leading-4 text-(--text-color-secondary)">
                    添加自定义接口，并选择当前使用的 API
                </p>
                <form onSubmit={handleAdd} className="mt-3 flex flex-wrap gap-2">
                    <input
                        type="text"
                        placeholder="API 名称"
                        aria-label="API 名称"
                        value={name}
                        onChange={(e) => { setName(e.target.value); setError(''); }}
                        className={`w-full sm:w-44 ${settingsInputClassName}`}
                    />
                    <input
                        type="text"
                        placeholder="API 地址"
                        aria-label="API 地址"
                        value={url}
                        onChange={(e) => { setUrl(e.target.value); setError(''); }}
                        className={`min-w-0 flex-1 ${settingsInputClassName}`}
                    />
                    <Button type="submit" className="shrink-0">
                        添加
                    </Button>
                </form>
                {error && (
                    <p role="alert" className="mt-3 text-[12px] leading-4 text-(--sv2-danger)">
                        {error}
                    </p>
                )}
            </div>

            {/* API 列表：系统默认 + 自定义项，单选切换 */}
            <section aria-label="弹幕 API 列表" className="mt-3">
                <button
                    type="button"
                    onClick={() => userSourcesStore.setActiveDanmakuApi(null)}
                    aria-pressed={activeId === null}
                    className="flex w-full cursor-pointer items-center gap-3 border-b border-(--sv2-border) py-4 text-left">
                    <span className={radioClassName(activeId === null)}>
                        {activeId === null && <span className="h-2 w-2 rounded-full bg-(--accent-color)" />}
                    </span>
                    <span className="min-w-0">
                        <span className="block text-[14px] leading-5 font-medium text-(--text-color)">使用系统默认</span>
                        <span className="mt-1 block truncate text-[12px] leading-4 text-(--text-color-secondary)">
                            {systemApiUrl ? (hasPermission('danmaku_api') ? systemApiUrl : '内置 API') : '未配置系统弹幕 API'}
                        </span>
                    </span>
                </button>

                {apis.map(api => (
                    <div
                        key={api.id}
                        className="flex items-center justify-between gap-3 border-b border-(--sv2-border) py-4 last:border-b-0">
                        <button
                            type="button"
                            onClick={() => userSourcesStore.setActiveDanmakuApi(api.id)}
                            aria-pressed={activeId === api.id}
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
                            <span className={radioClassName(activeId === api.id)}>
                                {activeId === api.id && <span className="h-2 w-2 rounded-full bg-(--accent-color)" />}
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-[14px] leading-5 font-medium text-(--text-color)">
                                    {api.name}
                                </span>
                                <span className="mt-1 block truncate text-[12px] leading-4 text-(--text-color-secondary)">
                                    {api.url}
                                </span>
                            </span>
                        </button>

                        <Menu
                            ariaLabel={`${api.name} 操作`}
                            items={[
                                {
                                    label: '删除',
                                    danger: true,
                                    onSelect: () => setPendingRemove(api),
                                },
                            ]}
                        />
                    </div>
                ))}
            </section>

            <ConfirmDialog
                isOpen={pendingRemove !== null}
                title="删除弹幕 API"
                message={`确定要删除「${pendingRemove?.name ?? ''}」吗？删除后需要重新添加才能恢复。是否继续？`}
                confirmText="删除"
                cancelText="取消"
                variant="danger"
                dangerous
                onConfirm={() => {
                    if (pendingRemove) userSourcesStore.removeDanmakuApi(pendingRemove.id);
                    setPendingRemove(null);
                }}
                onCancel={() => setPendingRemove(null)}
            />
        </div>
    );
}
