import packageJson from '@/package.json';

/**
 * APP_VERSION - 本地构建版本号
 * 单独成模块，供客户端组件直接引用，避免把完整的发布清单
 * （lib/app-release.ts 依赖 app-release.json）打进浏览器包。
 */
export const APP_VERSION: string = packageJson.version;
