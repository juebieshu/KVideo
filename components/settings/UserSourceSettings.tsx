'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Switch } from '@/components/ui/Switch';
import { Menu } from '@/components/ui/Menu';
import { userSourcesStore } from '@/lib/store/user-sources-store';
import type { VideoSource } from '@/lib/types';

export function UserSourceSettings() {
  const [sources, setSources] = useState<VideoSource[]>([]);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [error, setError] = useState('');
  const [pendingRemove, setPendingRemove] = useState<VideoSource | null>(null);

  useEffect(() => {
    setSources(userSourcesStore.getSources());
    const unsub = userSourcesStore.subscribe(() => {
      setSources(userSourcesStore.getSources());
    });
    return unsub;
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !baseUrl.trim()) {
      setError('请输入源名称和接口地址');
      return;
    }
    try {
      new URL(baseUrl);
    } catch {
      setError('请输入有效的 URL');
      return;
    }

    const id = `user-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;
    const source: VideoSource = {
      id,
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      searchPath: '/provide/vod',
      detailPath: '/provide/vod',
      enabled: true,
    };
    userSourcesStore.addSource(source);
    setName('');
    setBaseUrl('');
    setError('');
  };

  const inputClassName =
    'rounded-[var(--radius-2xl)] border border-(--glass-border) bg-(--glass-bg) px-3 py-2 text-sm text-(--text-color) placeholder:text-(--text-color-secondary) focus:border-(--accent-color) focus:outline-none sm:h-8 sm:py-1';

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-4 border-b border-(--sv2-border) pb-3">
        <h2 className="text-[18px] font-semibold text-(--text-color)">个人视频源</h2>
        <p className="mt-1.5 text-[13px] leading-5 text-(--text-color-secondary)">
          添加你自己的视频源，只对当前浏览器生效。
        </p>
      </header>

      <section aria-label="添加个人视频源" className="border-b border-(--sv2-border) pb-5">
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="源名称"
            aria-label="源名称"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            className={`w-full sm:w-44 ${inputClassName}`}
          />
          <input
            type="text"
            placeholder="接口地址"
            aria-label="接口地址"
            value={baseUrl}
            onChange={(e) => { setBaseUrl(e.target.value); setError(''); }}
            className={`min-w-0 flex-1 ${inputClassName}`}
          />
          <Button type="submit" variant="solid" color="primary" className="shrink-0">
            添加源
          </Button>
        </form>
        {error && (
          <p role="alert" className="mt-3 text-[12px] leading-4 text-(--sv2-danger)">
            {error}
          </p>
        )}
      </section>

      <section aria-label="个人视频源列表">
        {sources.length === 0 && (
          <p className="py-8 text-center text-[13px] text-(--text-color-secondary)">
            还没有个人视频源，添加一个试试吧。
          </p>
        )}

        {sources.map(source => (
          <div
            key={source.id}
            className="flex items-center justify-between gap-4 border-b border-(--sv2-border) py-4 last:border-b-0"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Switch
                checked={source.enabled !== false}
                onChange={() => userSourcesStore.toggleSource(source.id)}
                ariaLabel={`切换 ${source.name} 状态`}
              />
              <div className="min-w-0">
                <p className="truncate text-[14px] leading-5 font-medium text-(--text-color)">
                  {source.name}
                </p>
                <p className="mt-1 truncate text-[12px] leading-4 text-(--text-color-secondary)">
                  {source.baseUrl}
                </p>
              </div>
            </div>

            <Menu
              ariaLabel={`${source.name} 操作`}
              items={[
                {
                  label: '删除',
                  danger: true,
                  onSelect: () => setPendingRemove(source),
                },
              ]}
            />
          </div>
        ))}
      </section>

      <ConfirmDialog
        isOpen={pendingRemove !== null}
        title="删除个人视频源"
        message={`确定要删除「${pendingRemove?.name ?? ''}」吗？删除后需要重新添加才能恢复。是否继续？`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        dangerous
        onConfirm={() => {
          if (pendingRemove) userSourcesStore.removeSource(pendingRemove.id);
          setPendingRemove(null);
        }}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  );
}
