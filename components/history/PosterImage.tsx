/**
 * PosterImage - Video poster with fallback handling
 */


import { Icons } from '@/components/ui/Icon';

interface PosterImageProps {
    poster?: string;
    title: string;
    progress: number;
}

export function PosterImage({ poster, title, progress }: PosterImageProps) {
    return (
        <div className="relative w-28 h-16 flex-shrink-0 bg-[var(--glass-bg)] rounded-[var(--radius-2xl)] overflow-hidden">
            {poster ? (
                <img
                    src={poster}
                    alt={title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'w-full h-full flex items-center justify-center';
                        fallback.innerHTML = `<svg class="text-[var(--text-color-secondary)] opacity-30" width="32" height="32" viewBox="0 -960 960 960" fill="currentColor"><path fill="currentColor" d="m4 4l1.625 3.25q.175.35.5.55t.7.2q.75 0 1.15-.638t.05-1.312L7 4h2l1.625 3.25q.175.35.5.55t.7.2q.75 0 1.15-.638t.05-1.312L12 4h2l1.625 3.25q.175.35.5.55t.7.2q.75 0 1.15-.638t.05-1.312L17 4h3q.825 0 1.413.587T22 6v12q0 .825-.587 1.413T20 20H4q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4"/></svg>`;
                            parent.appendChild(fallback);
                        }
                    }}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <Icons.Film size={32} className="text-[var(--text-color-secondary)] opacity-30" />
                </div>
            )}
            {/* Progress overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                <div
                    className="h-full bg-[var(--accent-color)]"
                    style={{ width: `${Math.min(100, progress)}%` }}
                />
            </div>
        </div>
    );
}
