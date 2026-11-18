interface SettingsSectionProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    headerAction?: React.ReactNode;
}

export function SettingsSection({
    title,
    description,
    children,
    headerAction,
}: SettingsSectionProps) {
    return (
        <div className="settings-panel bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="settings-panel-title text-xl font-semibold text-[var(--text-color)]">{title}</h2>
                {headerAction && <div className="flex gap-2 flex-wrap">{headerAction}</div>}
            </div>
            {description && (
                <p className="text-sm text-[var(--text-color-secondary)] mb-6 leading-[1.6]">
                    {description}
                </p>
            )}
            {children}
        </div>
    );
}
