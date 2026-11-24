/**
 * Reusable modal header component
 */
import { MIcon, materialIconMap } from '@/components/ui/Icon';

interface ModalHeaderProps {
    title: string;
    onClose: () => void;
}

export function ModalHeader({ title, onClose }: ModalHeaderProps) {
    return (
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-[var(--text-color)]">
                {title}
            </h3>
            <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-full)] bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-color)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-all duration-200 cursor-pointer"
                aria-label="关闭"
            >
                <MIcon icon={materialIconMap.X} className="w-5 h-5" />
            </button>
        </div>
    );
}
