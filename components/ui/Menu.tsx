"use client";

import { useEffect, useRef, useState } from "react";
import { MIcon, materialIconMap } from '@/components/ui/Icon';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  /** 危险操作：红色文案 + 危险色 hover 底 */
  danger?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  items: MenuItem[];
  /** 触发按钮的无障碍名称，例如「某某源 操作」 */
  ariaLabel: string;
}

/** 与 .kv-anim-menu-out 的 100ms 时长保持一致 */
const EXIT_MS = 100;

/**
 * 轻量行内「更多操作」菜单（⋮）。
 * 展开/收回均有动画：收回时先播退出动画再卸载。
 * 点击外部 / Esc 关闭；Esc 关闭后焦点回到触发按钮。
 * 高频主操作应外显在菜单外，本组件只收纳低频或危险操作。
 */
export function Menu({ items, ariaLabel }: MenuProps) {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openMenu = () => {
    clearCloseTimer();
    setClosing(false);
    setMounted(true);
  };

  const closeMenu = (options?: { after?: () => void; restoreFocus?: boolean }) => {
    if (closing) return;

    clearCloseTimer();
    setClosing(true);

    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setMounted(false);
      setClosing(false);

      if (options?.restoreFocus) {
        triggerRef.current?.focus();
      }

      options?.after?.();
    }, EXIT_MS);
  };

  useEffect(() => () => clearCloseTimer(), []);

  useEffect(() => {
    if (!mounted) return;

    // 键盘用户展开后直接落在第一个可用选项上（收回阶段不再抢焦点）。
    if (!closing) {
      menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    }

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        // 点外部关闭：不把焦点抢回触发按钮。
        closeMenu();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // 阻止冒泡，避免连带关闭外层设置弹窗。
        event.stopPropagation();
        closeMenu({ restoreFocus: true });
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mounted, closing]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={mounted && !closing}
        onClick={() => {
          if (mounted) {
            closeMenu({ restoreFocus: true });
          } else {
            openMenu();
          }
        }}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-full)] text-(--text-color-secondary) transition-colors hover:bg-[color-mix(in_srgb,var(--text-color)_10%,transparent)] hover:text-(--text-color)">
        <MIcon icon={materialIconMap.MoreVertical} className="h-4 w-4" />
      </button>

      {mounted && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={ariaLabel}
          className={`absolute right-0 top-full z-50 mt-1 w-32 rounded-[var(--radius-md)] border border-(--glass-border) bg-(--glass-bg) p-1 shadow-(--shadow-md) ${
            closing ? "kv-anim-menu-out pointer-events-none" : "kv-anim-menu-in"
          }`}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                // 先播完收回动画再执行动作，避免列表变化时菜单位置跳变。
                closeMenu({ after: item.onSelect });
              }}
              className={`flex w-full cursor-pointer items-center rounded-[6px] px-2.5 py-1.5 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                item.danger
                  ? "text-(--danger-color) hover:bg-[color-mix(in_srgb,var(--danger-color)_12%,transparent)]"
                  : "text-(--text-color) hover:bg-[color-mix(in_srgb,var(--text-color)_8%,transparent)]"
              }`}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
