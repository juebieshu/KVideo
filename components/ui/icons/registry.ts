'use client';

import { addCollection } from '@iconify/react';

import materialSubset from './material-subset.json';
import brandSubset from './brand-subset.json';

/**
 * 把本地图标子集注册进 Iconify。
 *
 * 子集由 `scripts/gen-icon-subset.mjs` 从 @iconify-json/material-symbols 生成，
 * 注册后 `<Icon icon="material-symbols:xxx-rounded" />` 不再请求 api.iconify.design。
 */
type IconifyCollection = Parameters<typeof addCollection>[0];

addCollection(materialSubset as unknown as IconifyCollection);
addCollection(brandSubset as unknown as IconifyCollection);
