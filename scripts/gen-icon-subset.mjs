/**
 * 生成 Material Symbols 图标子集（Outline 空心风格）。
 *
 * 用法：node scripts/gen-icon-subset.mjs
 *
 * `@iconify/react` 默认会去 api.iconify.design 在线取图标；这里把项目用到的图标
 * 从 @iconify-json/material-symbols 抽出来，落成 JSON 后用 addCollection() 注册，
 * 运行时不依赖外网。新增图标时在 ICONS 里加一行再重跑本脚本即可。
 *
 * 图标风格：优先取 `-outline-rounded`（空心圆角）；没有空心变体的图标（箭头、
 * search、close、public 等本身即线条造型）回退到 `-rounded` / 原名。语义键以
 * `Filled` 结尾的（HeartFilled/StarFilled）表示激活态，保留实心 rounded 变体。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const materialSource = require('@iconify-json/material-symbols/icons.json');
const brandSource = require('@iconify-json/simple-icons/icons.json');

/** 语义键 → material-symbols 图标名（不带 -rounded 后缀，脚本自动补） */
const ICONS = {
  // 媒体
  Film: 'movie',
  Play: 'play-arrow',
  Pause: 'pause',
  TV: 'tv',
  Volume2: 'volume-up',
  Volume1: 'volume-down',
  VolumeX: 'volume-off',
  Maximize: 'fullscreen',
  Minimize: 'fullscreen-exit',
  WebFullscreen: 'open-in-full',
  WebFullscreenExit: 'close-fullscreen',
  SkipForward: 'skip-next',
  FastForward: 'fast-forward',
  Rewind: 'fast-rewind',
  SkipBack: 'skip-previous',
  PictureInPicture: 'picture-in-picture-alt',
  Airplay: 'airplay',
  Cast: 'cast',
  // 导航
  Search: 'search',
  ChevronLeft: 'chevron-left',
  ChevronRight: 'chevron-right',
  ChevronDown: 'keyboard-arrow-down',
  ChevronUp: 'keyboard-arrow-up',
  List: 'list',
  ArrowUpDown: 'swap-vert',
  Layers: 'layers',
  // 通用
  Zap: 'bolt',
  Target: 'target',
  ShieldAlert: 'gpp-bad',
  Shield: 'shield',
  Sparkles: 'auto-awesome',
  Calendar: 'calendar-month',
  Globe: 'public',
  Inbox: 'inbox',
  AlertTriangle: 'warning',
  RefreshCw: 'refresh',
  Check: 'check',
  Tag: 'label',
  X: 'close',
  Star: 'star',
  Clock: 'schedule',
  History: 'history',
  Trash: 'delete',
  Download: 'download',
  Link: 'link',
  Cloud: 'cloud',
  Heart: 'favorite',
  HeartFilled: 'favorite',
  Bookmark: 'bookmark',
  MoreHorizontal: 'more-horiz',
  MoreVertical: 'more-vert',
  Languages: 'translate',
  Settings: 'settings',
  ExternalLink: 'open-in-new',
  Plus: 'add',
  Copy: 'content-copy',
  Edit: 'edit',
  Users: 'group',
  User: 'person',
  Lock: 'lock',
  LogOut: 'logout',
  Info: 'info',
  Danmaku: 'chat',
  Sun: 'light-mode',
  Moon: 'dark-mode',
  Monitor: 'monitor',
  Database: 'database',
  UserPlus: 'person-add',
  Rss: 'rss-feed',
  Sliders: 'tune',
  PlayCircle: 'play-circle',
  Error: 'error',
  Timer: 'timer',
  Speed: 'speed',
  Subtitles: 'subtitles',
  CheckCircle: 'check-circle',
  RadioChecked: 'radio-button-checked',
  Menu: 'menu',
  ArrowLeft: 'arrow-back',
  ArrowRight: 'arrow-forward',
  DragHandle: 'drag-handle',
  Add: 'add',
  Remove: 'remove',
  StarFilled: 'star',
  Filter: 'filter-list',
  Sort: 'sort',
  Eye: 'visibility',
  EyeOff: 'visibility-off',
  Upload: 'upload',
  Save: 'save',
  Warning: 'warning',
  Pause2: 'pause',
  Fullscreen: 'fullscreen',
};

/** 品牌图标 material-symbols 没有，走 simple-icons */
const BRAND_ICONS = {
  Github: 'github',
  Google: 'google',
};

/** 语义键是否表示实心/激活态（如 HeartFilled、StarFilled） */
function isFilledKey(key) {
  return key.endsWith('Filled');
}

/**
 * 选择一个图标变体：
 * - 激活态（Filled）：实心圆角 rounded
 * - 其余：优先空心圆角 outline-rounded，缺失则回退 rounded，再回退原名
 */
function pickVariant(collection, name, key) {
  if (isFilledKey(key)) {
    const rounded = `${name}-rounded`;
    return collection.icons[rounded] ? rounded : name;
  }
  const outline = `${name}-outline-rounded`;
  if (collection.icons[outline]) return outline;
  const rounded = `${name}-rounded`;
  return collection.icons[rounded] ? rounded : name;
}

function buildSubset(collection, names) {
  const icons = {};
  for (const name of names) {
    const icon = collection.icons[name];
    if (!icon) {
      console.warn(`[icon-subset] 缺失图标：${name}`);
      continue;
    }
    icons[name] = icon;
  }

  const subset = {
    prefix: collection.prefix,
    icons,
    width: collection.width,
    height: collection.height,
  };
  if (collection.info) subset.info = collection.info;
  return subset;
}

const materialNames = new Set();
for (const [key, base] of Object.entries(ICONS)) {
  materialNames.add(pickVariant(materialSource, base, key));
}

const materialSubset = buildSubset(materialSource, [...materialNames].sort());
const brandSubset = buildSubset(brandSource, [...new Set(Object.values(BRAND_ICONS))].sort());

const outDir = resolve(root, 'components/ui/icons');
writeFileSync(resolve(outDir, 'material-subset.json'), JSON.stringify(materialSubset));
writeFileSync(resolve(outDir, 'brand-subset.json'), JSON.stringify(brandSubset));

console.log(
  `material-symbols: ${Object.keys(materialSubset.icons).length} 个图标 → components/ui/icons/material-subset.json`
);
console.log(
  `brand: ${Object.keys(brandSubset.icons).length} 个图标 → components/ui/icons/brand-subset.json`
);

// 同步导出「语义键 → 完整图标名」的映射，供组件直接消费
const mapEntries = Object.entries(ICONS).map(([key, base]) => {
  const resolved = pickVariant(materialSource, base, key);
  return `  ${key}: 'material-symbols:${resolved}',`;
});
const brandEntries = Object.entries(BRAND_ICONS).map(
  ([key, name]) => `  ${key}: 'simple-icons:${name}',`
);
writeFileSync(
  resolve(outDir, 'icon-map.ts'),
  `// 由 scripts/gen-icon-subset.mjs 生成，请勿手改\n` +
    `export const materialIconMap = {\n${mapEntries.join('\n')}\n} as const;\n\n` +
    `export const brandIconMap = {\n${brandEntries.join('\n')}\n} as const;\n`
);

console.log('映射已写入 components/ui/icons/icon-map.ts');
