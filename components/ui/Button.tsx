import React, { forwardRef } from "react";

type ButtonVariant =
  | "normal"
  | "solid"
  | "soft"
  | "outline"
  | "ghost"
  | "link"
  | "secondary" | "primary";

type ButtonColor =
  | "primary"
  | "neutral"
  | "danger"
  | "success"
  | "warning";

interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  variant?: ButtonVariant;
  color?: ButtonColor;
  children: React.ReactNode;
}

type ButtonColorVariables = React.CSSProperties & {
  "--button-fg": string;
  "--button-solid-bg": string;
  "--button-solid-hover": string;
  "--button-solid-active": string;
  "--button-solid-fg": string;
};

/**
 * 组件变量只引用语义变量。
 * 具体色值与深浅模式由统一 CSS 管理。
 */
const colors: Record<ButtonColor, ButtonColorVariables> = {
  primary: {
    "--button-fg": "var(--kv-color-accent)",
    "--button-solid-bg": "var(--kv-color-accent-solid)",
    "--button-solid-hover": "var(--kv-color-accent-solid-hover)",
    "--button-solid-active": "var(--kv-color-accent-solid-active)",
    "--button-solid-fg": "var(--kv-color-on-accent-solid)",
  },

  neutral: {
    "--button-fg": "var(--kv-color-text)",
    "--button-solid-bg": "var(--kv-color-neutral-solid)",
    "--button-solid-hover": "var(--kv-color-neutral-solid-hover)",
    "--button-solid-active": "var(--kv-color-neutral-solid-active)",
    "--button-solid-fg": "var(--kv-color-on-neutral-solid)",
  },

  danger: {
    "--button-fg": "var(--kv-color-danger)",
    "--button-solid-bg": "var(--kv-color-danger-solid)",
    "--button-solid-hover": "var(--kv-color-danger-solid-hover)",
    "--button-solid-active": "var(--kv-color-danger-solid-active)",
    "--button-solid-fg": "var(--kv-color-on-danger-solid)",
  },

  success: {
    "--button-fg": "var(--kv-color-success)",
    "--button-solid-bg": "var(--kv-color-success-solid)",
    "--button-solid-hover": "var(--kv-color-success-solid-hover)",
    "--button-solid-active": "var(--kv-color-success-solid-active)",
    "--button-solid-fg": "var(--kv-color-on-success-solid)",
  },

  warning: {
    "--button-fg": "var(--kv-color-warning)",
    "--button-solid-bg": "var(--kv-color-warning-solid)",
    "--button-solid-hover": "var(--kv-color-warning-solid-hover)",
    "--button-solid-active": "var(--kv-color-warning-solid-active)",
    "--button-solid-fg": "var(--kv-color-on-warning-solid)",
  },
};

const variants: Record<ButtonVariant, string> = {
  // 低干扰的普通按钮：轻边框，不使用明显灰底。
  normal: `
    border-(--kv-color-control-border)
    bg-(--kv-color-bg-surface)
    text-(color:--button-fg)

    enabled:hover:border-(--kv-color-control-border-hover)
    enabled:hover:bg-(--kv-color-bg-hover)

    enabled:active:bg-(--kv-color-bg-active)
  `,

  // 实心按钮：用于当前区域的主要操作。
  solid: `
    border-transparent
    bg-(--button-solid-bg)
    text-(color:--button-solid-fg)

    enabled:hover:bg-(--button-solid-hover)
    enabled:active:bg-(--button-solid-active)
  `,

  // 柔和按钮：淡色背景 + 同色边框。
  soft: `
    border-[color-mix(in_srgb,var(--button-fg)_25%,transparent)]
    bg-[color-mix(in_srgb,var(--button-fg)_10%,transparent)]
    text-(color:--button-fg)

    enabled:hover:border-[color-mix(in_srgb,var(--button-fg)_40%,transparent)]
    enabled:hover:bg-[color-mix(in_srgb,var(--button-fg)_15%,transparent)]

    enabled:active:bg-[color-mix(in_srgb,var(--button-fg)_20%,transparent)]
  `,

  // 描边按钮。
  outline: `
    border-[color-mix(in_srgb,var(--button-fg)_45%,transparent)]
    bg-transparent
    text-(color:--button-fg)

    enabled:hover:bg-[color-mix(in_srgb,var(--button-fg)_8%,transparent)]
    enabled:active:bg-[color-mix(in_srgb,var(--button-fg)_14%,transparent)]
  `,

  // 低干扰操作。
  ghost: `
    border-transparent
    bg-transparent
    text-(color:--button-fg)

    enabled:hover:bg-[color-mix(in_srgb,var(--button-fg)_8%,transparent)]
    enabled:active:bg-[color-mix(in_srgb,var(--button-fg)_14%,transparent)]
  `,

  // 链接视觉，但仍然用于按钮操作，不用于页面跳转。
  link: `
    border-transparent
    bg-transparent
    text-(color:--button-fg)
    underline-offset-4

    enabled:hover:underline
  `,

  // 历史遗留
  secondary: ``,
  primary: ``,
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "normal",
      color = "neutral",
      type = "button",
      children,
      className = "",
      style,
      ...props
    },
    ref,
  ) => {
    const baseStyles = `
      inline-flex min-h-11 items-center justify-center gap-1.5
      rounded-md border px-4 py-1
      text-[13px] leading-5 font-medium whitespace-nowrap

      transition-[background-color,border-color,color]
      duration-150

      focus-visible:outline-2
      focus-visible:outline-offset-2
      focus-visible:outline-(--kv-color-focus)

      enabled:cursor-pointer
      disabled:cursor-not-allowed
      disabled:opacity-50

      motion-reduce:transition-none

      sm:min-h-8

      [&_svg]:shrink-0
    `;

    return (
      <button
        ref={ref}
        type={type}
        className={`${baseStyles} ${variants[variant]} ${className}`}
        style={{
          ...colors[color],
          ...style,
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";