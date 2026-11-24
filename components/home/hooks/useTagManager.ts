import { useState, useEffect } from 'react';
import { useContentTypeStore } from '@/lib/store/content-type-store';
import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { Tag } from '../SortableTag';

type ContentType = 'movie' | 'tv';

const DEFAULT_TAG = { id: 'popular', label: '热门', value: '热门' };

const STORAGE_KEY_PREFIX = 'kvideo_custom_tags_';

/** 豆瓣默认标签的内存缓存：电影 / 电视剧来回切换时不用重复请求 */
const doubanTagCache: Partial<Record<ContentType, Tag[]>> = {};

const ensureDefaultTag = (tags: Tag[]) => {
    if (tags.some((tag) => tag.id === DEFAULT_TAG.id || tag.value === DEFAULT_TAG.value)) {
        return tags.map((tag) =>
            tag.id === DEFAULT_TAG.id || tag.value === DEFAULT_TAG.value
                ? { ...DEFAULT_TAG, ...tag, id: DEFAULT_TAG.id, value: DEFAULT_TAG.value }
                : tag
        );
    }

    return [DEFAULT_TAG, ...tags];
};

const mapDoubanTags = (labels: string[]): Tag[] =>
    ensureDefaultTag(
        labels.map((label) => ({
            id: label === '热门' ? 'popular' : `tag_${label}`,
            label,
            value: label,
        }))
    );

/** 能同步拿到的标签（本地自定义 > 内存缓存），拿不到返回 null */
function readTagsSync(type: ContentType): Tag[] | null {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${type}`);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed) ? ensureDefaultTag(parsed) : [DEFAULT_TAG];
        } catch (e) {
            console.error('Failed to parse saved tags', e);
        }
    }
    return doubanTagCache[type] ?? null;
}

async function fetchDoubanTags(type: ContentType): Promise<Tag[]> {
    try {
        const response = await fetch(`/api/douban/tags?type=${type}`);
        const data = await response.json();
        if (data.tags && Array.isArray(data.tags)) {
            const tags = mapDoubanTags(data.tags);
            doubanTagCache[type] = tags;
            return tags;
        }
    } catch (error) {
        console.error('Fetch tags error:', error);
    }
    return [DEFAULT_TAG];
}

export function useTagManager() {
    const contentType = useContentTypeStore((state) => state.contentType) as ContentType;
    const [selectedTag, setSelectedTag] = useState(DEFAULT_TAG.id);
    // 标签跟分类绑定，避免「分类已切换、标签还是旧的」那一帧
    const [tagState, setTagState] = useState<{ type: ContentType; tags: Tag[] } | null>(null);
    const [isFetchingTags, setIsFetchingTags] = useState(false);
    const [newTagInput, setNewTagInput] = useState('');
    const [showTagManager, setShowTagManager] = useState(false);
    const [justAddedTag, setJustAddedTag] = useState(false);

    const storageKey = `${STORAGE_KEY_PREFIX}${contentType}`;

    // 切换分类时：能同步读到的标签直接在渲染阶段换上，标题可以无缝滚动
    if (tagState && tagState.type !== contentType) {
        const sync = readTagsSync(contentType);
        if (sync) {
            setTagState({ type: contentType, tags: sync });
            setSelectedTag(DEFAULT_TAG.id);
        }
    }

    const tagsReady = tagState?.type === contentType;
    const tags = tagsReady ? tagState.tags : [];

    // 首次加载 / 没有缓存时走网络
    useEffect(() => {
        if (tagsReady) return;
        let cancelled = false;

        /* eslint-disable react-hooks/set-state-in-effect */
        const sync = readTagsSync(contentType);
        if (sync) {
            setTagState({ type: contentType, tags: sync });
            setSelectedTag(DEFAULT_TAG.id);
            return;
        }

        setIsFetchingTags(true);
        /* eslint-enable react-hooks/set-state-in-effect */
        fetchDoubanTags(contentType).then((fetched) => {
            if (cancelled) return;
            setTagState({ type: contentType, tags: fetched });
            setSelectedTag(DEFAULT_TAG.id);
            setIsFetchingTags(false);
        });

        return () => {
            cancelled = true;
        };
    }, [contentType, tagsReady]);

    const saveTags = (newTags: Tag[]) => {
        setTagState({ type: contentType, tags: newTags });
        localStorage.setItem(storageKey, JSON.stringify(newTags));
    };

    const handleAddTag = () => {
        if (!newTagInput.trim()) return;
        const newTag = {
            id: `custom_${Date.now()}`,
            label: newTagInput.trim(),
            value: newTagInput.trim(),
        };
        saveTags([...tags, newTag]);
        setNewTagInput('');
        setJustAddedTag(true);
    };

    const handleDeleteTag = (tagId: string) => {
        if (tagId === DEFAULT_TAG.id) return;

        saveTags(tags.filter(t => t.id !== tagId));
        if (selectedTag === tagId) {
            setSelectedTag(DEFAULT_TAG.id);
        }
    };

    const handleRestoreDefaults = async () => {
        localStorage.removeItem(storageKey);
        delete doubanTagCache[contentType];
        const type = contentType;
        setIsFetchingTags(true);
        const fetched = await fetchDoubanTags(type);
        setTagState({ type, tags: fetched });
        setIsFetchingTags(false);
        setSelectedTag(DEFAULT_TAG.id);
        setShowTagManager(false);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = tags.findIndex((tag) => tag.id === active.id);
            const newIndex = tags.findIndex((tag) => tag.id === over.id);
            saveTags(arrayMove(tags, oldIndex, newIndex));
        }
    };

    return {
        tags,
        /** 当前分类的标签是否已就绪 */
        tagsReady,
        contentType,
        newTagInput,
        showTagManager,
        justAddedTag,
        isLoadingTags: !tagsReady || isFetchingTags,
        setNewTagInput,
        setShowTagManager,
        setJustAddedTag,
        handleAddTag,
        handleDeleteTag,
        handleRestoreDefaults,
        handleDragEnd,
    };
}
