'use client';

import { Icon } from '@iconify/react';

import { IconProps } from './types';
import './registry';

export interface MIconProps {
  icon: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  'aria-hidden'?: boolean;
}

/**
 * 统一的图标渲染组件。
 *
 * 传 `ssr` 让 Iconify 在服务端就直接输出 `<svg>`，避免水合前后闪一下空白，
 * 前提是图标已通过 `./registry` 注册进本地存储（本项目全部走本地子集）。
 */
export function MIcon({ icon, width, height, className, ...rest }: MIconProps) {
  return (
    <Icon
      icon={icon}
      width={width}
      height={height}
      className={className}
      ssr
      {...rest}
    />
  );
}

/** 用图标名创建一个固定图标组件，签名与旧的 Icons.* 保持一致 */
export function createIcon(icon: string) {
  function MaterialIcon({ className = '', size = 24 }: IconProps) {
    return <MIcon icon={icon} width={size} height={size} className={className} />;
  }

  MaterialIcon.displayName = `Icon(${icon})`;
  return MaterialIcon;
}
