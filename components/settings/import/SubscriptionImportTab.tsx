'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Menu } from '@/components/ui/Menu';
import type { SourceSubscription } from '@/lib/types';
import { createSubscription } from '@/lib/utils/source-import-utils';

interface SubscriptionImportTabProps {
    subscriptions: SourceSubscription[];
    onAdd: (subscription: SourceSubscription) => Promise<boolean> | boolean;
    onRemove: (id: string) => void;
    onRefresh: (subscription: SourceSubscription) => Promise<void>;
}

export function SubscriptionImportTab({
    subscriptions,
    onAdd,
    onRemove,
    onRefresh
}: SubscriptionImportTabProps) {
    const [url, setUrl] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState('');
    const [pendingRemove, setPendingRemove] = useState<SourceSubscription | null>(null);

    const handleAdd = async () => {
        if (!url.trim() || !name.trim()) {
            setError('请输入订阅名称和订阅链接');
            return;
        }

        try {
            new URL(url);
        } catch {
            setError('请输入有效的 URL');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const newSub = createSubscription(name, url);
            // Immediately try to fetch (test connection)
            // The parent handler should assume responsibility for fetching content
            // but here we just pass the object
            await onAdd(newSub);
            setUrl('');
            setName('');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '添加订阅失败');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async (sub: SourceSubscription) => {
        setRefreshingIds(prev => new Set(prev).add(sub.id));
        try {
            await onRefresh(sub);
        } finally {
            setRefreshingIds(prev => {
                const next = new Set(prev);
                next.delete(sub.id);
                return next;
            });
        }
    };

    const inputClassName =
        'rounded-[var(--radius-2xl)] border border-(--glass-border) bg-(--glass-bg) px-3 py-2 text-sm text-(--text-color) placeholder:text-(--text-color-secondary) focus:border-(--accent-color) focus:outline-none sm:h-8 sm:py-1';

    return (
        <div className="mx-auto w-full max-w-2xl">
            <header className="mb-4 border-b border-(--sv2-border) pb-3">
                <h2 className="text-[18px] font-semibold text-(--text-color)">订阅源</h2>
                <p className="mt-1.5 text-[13px] leading-5 text-(--text-color-secondary)">
                    添加订阅链接后，源列表会自动同步；刷新会立即拉取最新内容。
                </p>
            </header>

            <section aria-label="添加订阅" className="border-b border-(--sv2-border) pb-5">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleAdd();
                    }}
                    className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="订阅名称"
                            aria-label="订阅名称"
                            className={`w-full sm:w-44 ${inputClassName}`}
                        />
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="订阅链接"
                            aria-label="订阅链接"
                            className={`min-w-0 flex-1 ${inputClassName}`}
                        />
                        <Button type="submit" disabled={loading} className="shrink-0">
                            {loading ? '添加中' : '添加订阅'}
                        </Button>
                    </div>
                    {error && (
                        <p role="alert" className="text-[12px] leading-4 text-(--sv2-danger)">
                            {error}
                        </p>
                    )}
                </form>
            </section>

            <section aria-label="订阅列表">
                {subscriptions.length === 0 && (
                    <p className="py-8 text-center text-[13px] text-(--text-color-secondary)">
                        暂无订阅
                    </p>
                )}

                {subscriptions.map((sub) => (
                    <div
                        key={sub.id}
                        className="flex items-center justify-between gap-4 border-b border-(--sv2-border) py-4 last:border-b-0">
                        <div className="min-w-0">
                            <p className="text-[14px] leading-5 font-medium text-(--text-color)">
                                {sub.name}
                            </p>
                            <p
                                className="mt-1 truncate text-[12px] leading-4 text-(--text-color-secondary)"
                                title={`${sub.url} · 上次更新 ${new Date(sub.lastUpdated).toLocaleString()}`}>
                                {sub.url} · 上次更新 {new Date(sub.lastUpdated).toLocaleString()}
                            </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                            <button
                                type="button"
                                onClick={() => handleRefresh(sub)}
                                disabled={refreshingIds.has(sub.id)}
                                className="cursor-pointer rounded-[var(--radius-full)] p-2 text-(--text-color-secondary) transition-colors hover:bg-[color-mix(in_srgb,var(--text-color)_10%,transparent)] hover:text-(--text-color) disabled:cursor-not-allowed disabled:opacity-50"
                                title="立即更新"
                                aria-label={`更新 ${sub.name}`}>
                                <svg
                                    className={`h-4 w-4 ${refreshingIds.has(sub.id) ? 'animate-spin text-(--accent-color)' : ''}`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    aria-hidden="true">
                                    <path d="M23 4v6h-6" />
                                    <path d="M1 20v-6h6" />
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                </svg>
                            </button>

                            <Menu
                                ariaLabel={`${sub.name} 操作`}
                                items={[
                                    {
                                        label: '删除',
                                        danger: true,
                                        onSelect: () => setPendingRemove(sub),
                                    },
                                ]}
                            />
                        </div>
                    </div>
                ))}
            </section>

            <ConfirmDialog
                isOpen={pendingRemove !== null}
                title="删除订阅"
                message={`确定要删除订阅「${pendingRemove?.name ?? ''}」吗？删除后该订阅将不再自动同步源列表。是否继续？`}
                confirmText="删除"
                cancelText="取消"
                variant="danger"
                dangerous
                onConfirm={() => {
                    if (pendingRemove) onRemove(pendingRemove.id);
                    setPendingRemove(null);
                }}
                onCancel={() => setPendingRemove(null)}
            />
        </div>
    );
}
