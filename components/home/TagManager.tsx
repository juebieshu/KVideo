import { Icons } from '@/components/ui/Icon';
import { DragEndEvent } from '@dnd-kit/core';
import { TagInput } from './TagInput';
import { TagList } from './TagList';
import { Tag } from './SortableTag';

interface TagManagerProps {
  tags: Tag[];
  showTagManager: boolean;
  newTagInput: string;
  justAddedTag: boolean;
  onTagDelete: (tagId: string) => void;
  onToggleManager: () => void;
  onRestoreDefaults: () => void;
  onNewTagInputChange: (value: string) => void;
  onAddTag: () => void;
  onDragEnd: (event: DragEndEvent) => void;
  onJustAddedTagHandled: () => void;
  isLoadingTags?: boolean;
  /** 「高级」标签不作为一行展示，而是放在顶部作为入口 */
  onPremiumClick?: () => void;
}

const noop = () => {};

/**
 * 标签管理：平时只露出一个「管理标签」入口（标签已变成从上到下的一行行内容），
 * 进入管理模式后可以添加、删除、拖拽排序，顺序即首页各行的顺序。
 */
export function TagManager({
  tags,
  showTagManager,
  newTagInput,
  justAddedTag,
  onTagDelete,
  onToggleManager,
  onRestoreDefaults,
  onNewTagInputChange,
  onAddTag,
  onDragEnd,
  onJustAddedTagHandled,
  isLoadingTags,
  onPremiumClick,
}: TagManagerProps) {
  return (
    <>
      {/* Management Controls */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleManager}
            className="text-sm text-[var(--text-color-secondary)] hover:text-[var(--accent-color)] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Icons.Tag size={16} />
            {showTagManager ? '完成' : '管理标签'}
          </button>
          {!showTagManager && onPremiumClick && (
            <button
              onClick={onPremiumClick}
              className="text-sm text-[var(--text-color-secondary)] hover:text-[var(--accent-color)] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Icons.Sparkles size={14} />
              高级
            </button>
          )}
        </div>
        {showTagManager && (
          <button
            onClick={onRestoreDefaults}
            className="text-sm text-[var(--text-color-secondary)] hover:text-[var(--accent-color)] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Icons.RefreshCw size={16} />
            恢复默认
          </button>
        )}
      </div>

      {showTagManager && (
        <>
          <TagInput
            newTagInput={newTagInput}
            onNewTagInputChange={onNewTagInputChange}
            onAddTag={onAddTag}
          />
          <p className="mb-3 text-xs text-[var(--text-color-secondary)]">拖拽调整顺序，即首页各行从上到下的顺序</p>

          {isLoadingTags ? (
            <div className="mb-8 flex flex-wrap gap-3 pt-2" aria-busy="true">
              {[64, 88, 72, 96, 64, 80, 72].map((w, i) => (
                <span
                  key={i}
                  className="kv-skeleton h-10 rounded-full"
                  style={{ width: w, ['--vi' as string]: i }}
                />
              ))}
            </div>
          ) : (
            <TagList
              tags={tags}
              selectedTag=""
              showTagManager
              justAddedTag={justAddedTag}
              onTagSelect={noop}
              onTagDelete={onTagDelete}
              onDragEnd={onDragEnd}
              onJustAddedTagHandled={onJustAddedTagHandled}
            />
          )}
        </>
      )}
    </>
  );
}
