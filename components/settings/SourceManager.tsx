'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/Switch';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import type { VideoSource } from '@/lib/types';

interface SourceManagerProps {
  sources: VideoSource[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onEdit?: (source: VideoSource) => void;
  defaultIds: string[];
  /** 删除确认框的标题：普通源默认「删除视频源」，高级源传「删除高级源」 */
  deleteTitle?: string;
}

export function SourceManager({
  sources,
  onToggle,
  onDelete,
  onReorder,
  onEdit,
  defaultIds,
  deleteTitle = '删除视频源'
}: SourceManagerProps) {
  const [pendingDelete, setPendingDelete] = useState<VideoSource | null>(null);

  return (
    <div>
      {sources.map((source, index) => {
        const menuItems: MenuItem[] = [
          {
            label: '上移',
            disabled: index === 0,
            onSelect: () => onReorder(source.id, 'up'),
          },
          {
            label: '下移',
            disabled: index === sources.length - 1,
            onSelect: () => onReorder(source.id, 'down'),
          },
        ];

        if (onEdit && !defaultIds.includes(source.id)) {
          menuItems.push({ label: '编辑', onSelect: () => onEdit(source) });
        }

        menuItems.push({
          label: '删除',
          danger: true,
          onSelect: () => setPendingDelete(source),
        });

        return (
          <div
            key={source.id}
            className="flex items-center justify-between gap-4 border-b border-(--sv2-border) py-4 last:border-b-0"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Switch
                checked={source.enabled}
                onChange={() => onToggle(source.id)}
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

            <div className="flex shrink-0 items-center">
              <Menu ariaLabel={`${source.name} 操作`} items={menuItems} />
            </div>
          </div>
        );
      })}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={deleteTitle}
        message={`确定要删除「${pendingDelete?.name ?? ''}」吗？删除后需要重新添加才能恢复。是否继续？`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        dangerous
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
