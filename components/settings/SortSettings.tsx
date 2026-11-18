import { type SortOption } from '@/lib/store/settings-store';
import { sortOptions } from '@/lib/store/settings-helpers';

interface SortSettingsProps {
    sortBy: SortOption;
    onSortChange: (sort: SortOption) => void;
}

export function SortSettings({ sortBy, onSortChange }: SortSettingsProps) {
    return (
        <div className="mx-auto w-full max-w-2xl">
            <header className="mb-4 border-b border-(--sv2-border) pb-3">
                <h2 className="text-[18px] font-semibold text-(--text-color)">搜索结果排序</h2>
                <p className="mt-1.5 text-[13px] leading-5 text-(--text-color-secondary)">
                    选择搜索结果的默认排序方式。
                </p>
            </header>

            <section aria-label="搜索结果排序方式">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(Object.keys(sortOptions) as SortOption[]).map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => onSortChange(option)}
                            aria-pressed={sortBy === option}
                            className={`cursor-pointer rounded-(--radius-2xl) border px-3 py-2 text-left transition-colors ${
                                sortBy === option
                                    ? 'settings-choice-selected'
                                    : 'border-(--glass-border) text-(--text-color-secondary) hover:border-(--accent-color) hover:text-(--text-color)'
                            }`}>
                            <span className="text-[13px] font-medium">{sortOptions[option]}</span>
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}
