'use client';

/**
 * Select - 统一单选下拉框
 * 基于原生 <select>，保留键盘 / 读屏 / 移动端原生选择体验；
 * 外观与设置项输入框一致，右侧自绘箭头。
 */

interface SelectOption<T extends string | number> {
    value: T;
    label: string;
}

interface SelectProps<T extends string | number> {
    value: T;
    options: readonly SelectOption<T>[];
    onChange: (value: T) => void;
    ariaLabel: string;
    className?: string;
    disabled?: boolean;
}

export function Select<T extends string | number>({
    value,
    options,
    onChange,
    ariaLabel,
    className = '',
    disabled = false,
}: SelectProps<T>) {
    return (
        <div className={`relative ${className}`}>
            <select
                value={String(value)}
                onChange={(event) => {
                    const matched = options.find((option) => String(option.value) === event.target.value);
                    if (matched) onChange(matched.value);
                }}
                aria-label={ariaLabel}
                disabled={disabled}
                className="w-full cursor-pointer appearance-none rounded-2xl border border-(--glass-border) bg-(--glass-bg) py-2 pl-3 pr-9 text-sm text-(--text-color) focus:border-(--accent-color) focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:h-8 sm:py-1">
                {options.map((option) => (
                    <option key={String(option.value)} value={String(option.value)}>
                        {option.label}
                    </option>
                ))}
            </select>
            <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-(--text-color-secondary)">
                <path d="m6 9 6 6 6-6" />
            </svg>
        </div>
    );
}
