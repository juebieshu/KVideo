/**
 * 设置面板共享 UI：行布局与输入框样式
 * 行布局与「隐私与数据」一致：左标题+描述、右控件。
 */

/** 设置项输入框统一样式（玻璃底、圆角、聚焦强调色） */
export const settingsInputClassName =
  'rounded-(--radius-2xl) border border-(--glass-border) bg-(--glass-bg) px-3 py-2 text-sm text-(--text-color) placeholder:text-(--text-color-secondary) focus:border-(--accent-color) focus:outline-none sm:h-8 sm:py-1';

/** 与「隐私与数据」一致的行：左标题+描述，右控件 */
export function SettingRow({
  title,
  description,
  children,
  className = '',
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${className}`}>
      <div className="min-w-0">
        <p className="text-[14px] leading-5 font-medium text-(--text-color)">{title}</p>
        {description && (
          <p className="mt-1 text-[12px] leading-4 text-(--text-color-secondary)">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
