"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  dangerous?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "确认",
  cancelText = "取消",
  variant = "warning",
  dangerous = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  const titleId = useId();
  const descriptionId = useId();

  const finalVariant = dangerous ? "danger" : variant;

  const confirmColor = {
    danger: "danger",
    warning: "warning",
    info: "primary",
  } as const;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (isOpen) {
      setIsClosing(false);

      if (!dialog.open) {
        dialog.showModal();
      }

      // 默认聚焦取消按钮，避免误触确认操作。
      cancelButtonRef.current?.focus();
      return;
    }

    // isOpen → false：先播关闭动画（125ms），结束后再真正 close。
    if (dialog.open) {
      setIsClosing(true);

      const timer = window.setTimeout(() => {
        dialog.close();
        setIsClosing(false);
      }, 125);

      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      role={finalVariant === "danger" ? "alertdialog" : "dialog"}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        // 由父组件的 isOpen 控制关闭。
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }}
      onKeyDown={(event) => {
        // 避免 Escape 同时触发外层设置窗口的关闭逻辑。
        if (event.key === "Escape") {
          event.stopPropagation();
        }
      }}
      onClick={(event) => {
        // 原生 backdrop 的点击目标也是 dialog。
        // 只有点击弹窗边界以外时才视为点击遮罩。
        if (event.target !== event.currentTarget) return;

        const rect = event.currentTarget.getBoundingClientRect();

        const clickedOutside =
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom;

        if (clickedOutside) {
          onCancel();
        }
      }}
      className={`
        fixed inset-0 m-auto
        max-h-[calc(100dvh-2rem)]
        w-[calc(100%-2rem)] max-w-100
        overflow-y-auto
        rounded-xl border border-(--kv-color-border)
        bg-(--kv-color-bg-surface)
        p-0 text-(--kv-color-text)
        shadow-[0_16px_48px_rgba(0,0,0,0.22)]
        backdrop:bg-black/50
        ${isOpen ? "kv-anim-panel-in" : isClosing ? "kv-anim-panel-out" : ""}
      `}>
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        {/* 标题与说明 */}
        <div>
          <h2
            id={titleId}
            className="
              text-base leading-6 font-semibold
              tracking-tight text-(--kv-color-text)
            ">
            {title}
          </h2>

          <p
            id={descriptionId}
            className="
              mt-2 whitespace-pre-wrap warp-break-words
              text-sm leading-6
              text-(--kv-color-text-muted)
            ">
            {message}
          </p>
        </div>

        {/* 操作 */}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="normal"
            color="neutral"
            onClick={onCancel}>
            {cancelText}
          </Button>

          <Button
            type="button"
            variant="solid"
            color={confirmColor[finalVariant]}
            onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
