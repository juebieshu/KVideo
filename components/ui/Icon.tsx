'use client';

// 统一图标出口：所有图标都来自本地注册的 Material Symbols Rounded 子集。
import { MediaIcons } from './icons/media-icons';
import { NavigationIcons } from './icons/navigation-icons';
import { UtilityIcons } from './icons/utility-icons';
import { DanmakuIcons } from './icons/danmaku-icons';

import './icons/registry';

export { MIcon } from './icons/base';
export type { MIconProps } from './icons/base';
export { materialIconMap, brandIconMap } from './icons/icon-map';
export type { IconProps } from './icons/types';

export const Icons = {
  ...MediaIcons,
  ...NavigationIcons,
  ...UtilityIcons,
  ...DanmakuIcons,
};
