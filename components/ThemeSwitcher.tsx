'use client';

import { useTheme } from './ThemeProvider';
import { MIcon, materialIconMap } from '@/components/ui/Icon';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-flex bg-[var(--glass-bg)] backdrop-blur-xl [-webkit-backdrop-filter:blur(25px)] border border-[var(--glass-border)] rounded-[var(--radius-full)] p-1 shadow-[var(--shadow-sm)]">
      <button
        onClick={() => setTheme('light')}
        className={`
          flex items-center justify-center
          w-9 h-9
          rounded-[var(--radius-full)]
          transition-all duration-200
          cursor-pointer
          ${theme === 'light'
            ? 'bg-[var(--accent-color)] text-white scale-105'
            : 'text-[var(--text-color-secondary)] hover:bg-[color-mix(in_srgb,var(--text-color)_10%,transparent)]'
          }
        `}
        aria-label="设为浅色主题"
      >
        <MIcon icon={materialIconMap.Sun} className="w-5 h-5" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`
          flex items-center justify-center
          w-9 h-9
          rounded-[var(--radius-full)]
          transition-all duration-200
          cursor-pointer
          ${theme === 'dark'
            ? 'bg-[var(--accent-color)] text-white scale-105'
            : 'text-[var(--text-color-secondary)] hover:bg-[color-mix(in_srgb,var(--text-color)_10%,transparent)]'
          }
        `}
        aria-label="设为深色主题"
      >
        <MIcon icon={materialIconMap.Moon} className="w-5 h-5" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`
          flex items-center justify-center
          w-9 h-9
          rounded-[var(--radius-full)]
          transition-all duration-200
          cursor-pointer
          ${theme === 'system'
            ? 'bg-[var(--accent-color)] text-white scale-105'
            : 'text-[var(--text-color-secondary)] hover:bg-[color-mix(in_srgb,var(--text-color)_10%,transparent)]'
          }
        `}
        aria-label="设为系统主题"
      >
        <MIcon icon={materialIconMap.Monitor} className="w-5 h-5" width={20} height={20} />
      </button>
    </div>
  );
}

