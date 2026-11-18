import type { ReactNode } from 'react';

interface SettingsCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function SettingsCard({ title, description, actions, children }: SettingsCardProps) {
  return (
    <section className="settings-panel settings-panel-framed rounded-[var(--radius-2xl)] border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--shadow-sm)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--glass-border)] px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-[var(--text-color)]">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-[var(--text-color-secondary)]">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
