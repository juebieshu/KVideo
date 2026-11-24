[![Upstream Sync](https://github.com/sky06walker/KVideo/actions/workflows/Github_Upstream_Sync.yml/badge.svg)](https://github.com/sky06walker/KVideo/actions/workflows/Github_Upstream_Sync.yml)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/KuekHaoYang/KVideo)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

# KVideo · 视频聚合播放平台

![KVideo Banner](public/icon.png)

> 基于 Next.js 16 的多源视频聚合播放应用，采用 Liquid Glass 液态玻璃设计语言。

**在线体验：<https://kvideo.pages.dev/>** · [项目文档](docs/README.md) · [Buy Me A Coffee](https://www.buymeacoffee.com/kuekhaoyang)

> 仓库默认不内置任何视频源或高级源，使用方需自行接入已获授权且支持浏览器直连的内容来源。所有部署均采用强制合规模式，仅提供直连播放，不含媒体代理与 IPTV 中继（详见[部署合规说明](#部署合规说明)）。

---

## 目录

- [快速开始](#快速开始)
- [功能概览](#功能概览)
- [认证与账户](#认证与账户)
- [环境变量](#环境变量)
- [部署与更新](#部署与更新)
- [常见问题](#常见问题)
- [文档索引](#文档索引)
- [贡献与许可](#贡献与许可)

---

## 快速开始

本地开发需 Node.js 20+：

```bash
git clone https://github.com/KuekHaoYang/KVideo.git
cd KVideo
npm install
npm run dev        # http://localhost:3000
```

生产构建使用 `npm run build && npm start`。更多命令参见 [09 开发工作流](docs/09-development-workflow.md)。

使用 Docker 快速启动：

```bash
docker run -d -p 3000:3000 --name kvideo kuekhaoyang/kvideo:latest
# 打开 http://localhost:3000
```

首次启动不包含任何视频源，需在「设置 → 视频源管理」中添加，或在部署时通过环境变量预设（见[环境变量](#环境变量)）。

---

## 功能概览

- **多源并行搜索**。多个视频源同时检索，结果通过 SSE 实时返回；支持自定义源、订阅源批量导入、同名源合并、繁体转简体、清晰度标签与实测分辨率标签。
- **HLS 直连播放**。基于 hls.js 与原生 HLS，支持进度控制、倍速、音量、断点续播、自动切源、跳过片头尾、画中画、全屏、投屏、弹幕与广告过滤。快捷键，`空格/K` 播放暂停、`F` 全屏、`M` 静音、`P` 画中画、`J/L/←/→` 快进快退、`↑/↓` 音量。
- **豆瓣数据与推荐**。提供影视详情、评分、演职员及相关推荐；基于观看历史自动生成「为你推荐」。
- **收藏与观看历史**。数据存储在本地，支持断点续播与容量限制，可导出为 JSON 备份。
- **账户与数据隔离**。提供公开访问、环境变量密码、托管账户三种模式；登录后历史、收藏、个人源等数据按账户隔离（见[认证与账户](#认证与账户)）。
- **跨设备同步**。配置 Upstash Redis 后，配置、历史、收藏可在设备间同步，并解决 iOS「添加到主屏幕」后 localStorage 不共享的问题；未配置时仅使用本地存储，不影响其他功能。
- **PWA 与响应式**。支持安装为独立应用；适配桌面、平板、手机与 TV 机顶盒，支持键盘导航与遥控器方向键导航。
- **高级模式**。访问 `/premium` 进入独立专区，内容、设置、推荐与普通模式完全隔离，可设置独立密码。

完整功能清单参见 [02 功能与路由](docs/02-features-and-routes.md)。

---

## 认证与账户

登录模式共三种，由服务端按优先级自动判定，通常无需手动指定。仅 `MANAGED_AUTH_ENABLED` 需要显式配置。

| 模式 | 触发条件 | 登录方式 | 适用场景 |
| --- | --- | --- | --- |
| **公开访问** | 未配置任何密码 / 账户 | 无需登录 | 自用、可信内网 |
| **环境变量密码** | 配置了 `ADMIN_PASSWORD` / `ACCESS_PASSWORD` / `ACCOUNTS`，但未启用托管账户 | 仅密码，或用户名 + 密码 | 简单自托管、兼容旧部署 |
| **托管账户** | 配置了 `AUTH_SECRET` + Upstash Redis，且 Redis 中已有账户；或 `MANAGED_AUTH_ENABLED=true` | 用户名 + 密码 | 多用户、需要在设置页管理账户 |

判定顺序为 **托管账户 > 环境变量密码 > 公开访问**。需注意，仅设置 `MANAGED_AUTH_ENABLED=true` 而缺少 `AUTH_SECRET` 或 Redis 时，托管模式不会启用，将退回环境变量密码模式。

### 环境变量密码模式

以下三种方式任选其一：

| 变量 | 写法 | 效果 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 单个密码 | 登录后为超级管理员 |
| `ACCESS_PASSWORD` | 单个密码 | 向后兼容，等同 `ADMIN_PASSWORD`；两者都在时以 `ADMIN_PASSWORD` 为准 |
| `ACCOUNTS` | 多个账户，逗号分隔 | 每个账户独立数据空间 |

`ACCOUNTS` 支持两种格式：

```text
密码:名称[:角色[:权限1|权限2]]
用户名:密码:名称[:角色[:权限1|权限2]]
```

解析规则如下：

- 2 段 = `密码:名称`；3 段且第 3 段是角色 = `密码:名称:角色`，否则按 `用户名:密码:名称` 解析；4 段 = `密码:名称:角色:权限`；5 段 = `用户名:密码:名称:角色:权限`。
- 角色有 `super_admin`（超管）、`admin`（管理员）、`viewer`（观众，默认）。
- 权限用 `|` 分隔，在角色默认权限之上追加；用户名自动转小写并去重。

```bash
# 单管理员
ADMIN_PASSWORD="your_password"

# 多账户，旧格式，仅使用密码登录
ACCOUNTS="pass1:张三:admin,pass2:李四:viewer,pass3:王五"

# 多账户，新格式，用户名 + 密码，并为观众追加源管理权限
ACCOUNTS="user1:pass1:张三:admin,user2:pass2:李四:viewer:source_management"
```

> 此模式下账户信息仅保存在环境变量中，不写入 Redis。`profileId` 由密码哈希生成，因此**修改密码等同于切换账户**，原有数据不会保留。支持以用户名与密码同时登录。

### 托管账户模式

启用条件（缺一不可）：

- 配置 `AUTH_SECRET`（会话签名密钥）；
- 配置 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`；
- Redis 中已有账户，或设置 `MANAGED_AUTH_ENABLED=true` 强制启用。

启用后：

- 主登录页改为**用户名 + 密码**，服务端以 HTTP-only 签名 Cookie 作为认证凭据；
- 超级管理员可在设置页创建、修改、重置、删除账户并分配权限；
- 配置同步、历史、收藏等跨设备数据按登录账户自动隔离；
- 首次启用时若 Redis 中无账户，将以 `ADMIN_PASSWORD` 创建 `admin` 超级管理员，并依据 `ACCOUNTS` 创建其余账户作为引导种子。账户密码采用 PBKDF2-SHA256 加盐存储，不可逆向推导。

### 角色与权限

| 权限 | 控制内容 | super_admin | admin | viewer |
| --- | --- | :---: | :---: | :---: |
| `source_management` | 全局视频源管理 | ✓ | — | — |
| `account_management` | 账户管理入口 | ✓ | — | — |
| `danmaku_api` | 全局弹幕 API 设置 | ✓ | — | — |
| `data_management` | 导入 / 导出 / 清除数据 | ✓ | — | — |
| `player_settings` | 播放器设置区 | ✓ | ✓ | — |
| `danmaku_appearance` | 弹幕外观 | ✓ | ✓ | — |
| `view_settings` | 显示设置 | ✓ | ✓ | ✓ |

自定义权限与角色默认权限取并集，可通过 `ACCOUNTS` 的第 4 或第 5 字段追加。请注意，客户端权限仅用于控制界面显示；服务端数据接口独立校验，账户管理接口仅限 `super_admin` 访问。

### 独立配置项（非登录模式）

| 变量 | 作用 | 默认值 |
| --- | --- | --- |
| `PREMIUM_PASSWORD` | `/premium` 高级内容的独立密码。未设置时无额外保护；管理员密码及 admin/super_admin 账户亦可解锁。仅在当前浏览器会话内有效。 | — |
| `PERSIST_SESSION` | 是否持久化登录状态（`true`/`false`，会话有效期 30 天）。仅在配置登录密码或账户时生效。 | `true` |

### 数据隔离范围

登录用户的**观看历史、收藏、搜索历史、个人视频源、个人弹幕 API** 按账户（`profileId`）隔离，切换账户后自动加载对应数据。以下数据**不按账户隔离**，同一浏览器内所有账户共享：全局设置、高级模式设置、搜索缓存、播放器音量与倍速等。若登录或退出后个人数据未同步切换，刷新页面即可。

详见 [06 认证、存储与同步](docs/06-auth-storage-sync.md)。

---

## 环境变量

### 配置原则

1. **`NEXT_PUBLIC_*` 为构建时内联变量**。在 `next build` 阶段写入前端代码，运行时修改（包括 `docker run -e`）不会生效。如需调整品牌文案等配置，必须重新构建，或覆盖仓库文件后自行构建镜像。
2. **其余变量为服务端运行时变量**。可在启动容器或进程时通过环境变量注入，无需重新构建。部分变量同时提供 `NEXT_PUBLIC_*` 别名以兼容旧部署，**建议优先使用不带前缀的版本**。
3. **托管账户与跨设备同步依赖 Upstash Redis**。未配置 Redis 时应用正常运行，仅账户管理与云同步功能不可用。

### 变量总表

下表列出常用变量。开发及内部变量未收录，完整清单参见 [08 部署与运维](docs/08-deployment-and-ops.md)。

**认证与账户**

| 变量 | 说明 | 生效时机 | 默认值 |
| --- | --- | --- | --- |
| `AUTH_SECRET` | 托管账户会话签名密钥，托管模式必填 | 运行时 | — |
| `MANAGED_AUTH_ENABLED` | `true` 强制优先托管账户模式（仍需 `AUTH_SECRET` + Redis） | 运行时 | — |
| `ADMIN_PASSWORD` | 管理员密码 / 托管模式超级管理员引导种子 | 运行时 | — |
| `ACCESS_PASSWORD` | 兼容旧部署，等同 `ADMIN_PASSWORD` | 运行时 | — |
| `ACCOUNTS` | 多账户配置，逗号分隔 | 运行时 | — |
| `PREMIUM_PASSWORD` | 高级内容独立密码 | 运行时 | — |
| `PERSIST_SESSION` | 是否持久化登录（`true`/`false`） | 运行时 | `true` |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL（账户存储与云同步） | 运行时 | — |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token | 运行时 | — |

**服务与网络**

| 变量 | 说明 | 生效时机 | 默认值 |
| --- | --- | --- | --- |
| `PORT` | 应用端口 | 运行时 | `3000` |
| `ALLOW_LAN_ACCESS` / `NEXT_PUBLIC_ALLOW_LAN_ACCESS` | `true`/`1`/`yes`/`on` 时监听 `0.0.0.0` 并放行开发来源 | 运行时 / 构建时 | `false` |
| `LAN_ALLOWED_DEV_ORIGINS` / `NEXT_PUBLIC_LAN_ALLOWED_DEV_ORIGINS` | 追加允许访问 dev 资源的主机名或通配符，逗号/空格/换行分隔 | 运行时 / 构建时 | — |

**站点品牌**

| 变量 | 说明 | 生效时机 | 默认值 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_TITLE` | 浏览器标签页标题 | 构建时 | `KVideo - 视频聚合平台` |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | 站点描述 | 构建时 | `视频聚合平台` |
| `NEXT_PUBLIC_SITE_NAME` | 站点头部名称 | 构建时 | `KVideo` |
| `SITE_ICON_FILE` | Docker 运行时从容器文件路径读取图标，优先于 URL | 运行时 | — |
| `SITE_ICON_URL` / `NEXT_PUBLIC_SITE_ICON_URL` | 图标 URL 或站内路径 | 运行时 / 构建时 | — |

> 图标查找顺序为 `SITE_ICON_URL`、`SITE_ICON_FILE`、`/icon.png`。该配置作用于顶部 Logo 与 favicon；安装后的 PWA 图标不受影响，如需同步替换，需覆盖 `public/icon.png` 后重新构建镜像。

**内容源与功能**

| 变量 | 说明 | 生效时机 | 默认值 |
| --- | --- | --- | --- |
| `SUBSCRIPTION_SOURCES` / `NEXT_PUBLIC_SUBSCRIPTION_SOURCES` | 自动订阅源，JSON 数组或逗号分隔的 URL | 运行时 / 构建时 | — |
| `MERGE_SOURCES` / `NEXT_PUBLIC_MERGE_SOURCES` | `true`/`1` 启动时强制开启合并同名源 | 运行时 / 构建时 | — |
| `AD_KEYWORDS` / `NEXT_PUBLIC_AD_KEYWORDS` | 广告过滤关键词，逗号或换行分隔 | 运行时 / 构建时 | — |
| `AD_KEYWORDS_FILE` | 广告关键词文件路径（Docker 挂载） | 运行时 | — |
| `DANMAKU_API_URL` / `NEXT_PUBLIC_DANMAKU_API_URL` | 弹幕聚合 API 地址预设 | 运行时 / 构建时 | — |
| `VIDEOTOGETHER_ENABLED` | `false` 时彻底禁用「一起看」集成 | 运行时 | `true` |
| `VIDEOTOGETHER_SCRIPT_URL` | 一起看脚本地址（自托管时可替换） | 运行时 | jsDelivr 官方地址 |
| `VIDEOTOGETHER_SETTING_URL` | 一起看设置页地址 | 运行时 | — |

### 配置示例

本地开发需在项目根目录创建 `.env.local`：

```env
# 认证（可选，不配置即公开访问）
ADMIN_PASSWORD=your_password
# AUTH_SECRET=replace-with-a-long-random-string
# UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
# UPSTASH_REDIS_REST_TOKEN=xxx

# 站点品牌（构建时生效，改后需重启 dev 或重新构建）
NEXT_PUBLIC_SITE_NAME=我的视频平台
NEXT_PUBLIC_SITE_TITLE=我的视频 - 聚合播放平台
NEXT_PUBLIC_SITE_DESCRIPTION=专属视频聚合播放平台

# 预设功能（可选）
NEXT_PUBLIC_DANMAKU_API_URL=https://danmaku.example.com
SUBSCRIPTION_SOURCES='[{"name":"默认源","url":"https://example.com/sources.json"}]'
```

Docker 部署通过运行时变量配置：

```bash
docker run -d -p 3000:3000 \
  -e ADMIN_PASSWORD="your_password" \
  -e PREMIUM_PASSWORD="premium_password" \
  -e ACCOUNTS="user1:用户一:admin,user2:用户二:viewer:source_management" \
  -e SITE_ICON_URL="https://example.com/icon.png" \
  -e SUBSCRIPTION_SOURCES='[{"name":"默认源","url":"https://example.com/sources.json"}]' \
  -e MERGE_SOURCES=true \
  --name kvideo kuekhaoyang/kvideo:latest
```

**订阅源格式**。`SUBSCRIPTION_SOURCES` 接受 JSON 数组（包含 `name` 与 `url` 字段），或直接提供订阅 URL，多个 URL 以逗号分隔。需区分两个概念，**订阅源**是返回视频源列表的 JSON 文件链接，**视频源**是单个 CMS/API 接口地址，后者需通过「设置 → 视频源管理」添加。源 JSON 的字段格式参见 [03 搜索与视频源](docs/03-search-and-sources.md)。

---

## 部署与更新

### 部署合规说明

自 [Issue #127](https://github.com/KuekHaoYang/KVideo/issues/127) 起，公开部署策略调整如下：

- 不再推荐 GitHub 直连导入流程，包括 `Deploy with Vercel`、`Connect GitHub`、Fork 后授权第三方读取仓库等。
- 所有部署统一采用强制合规模式，仅保留直连播放路径，不提供媒体代理、热链转发、IPTV 中继及 IPTV 页面。
- 仅可接入有权使用且允许当前部署环境访问的内容来源。依赖代理或 IPTV 的场景不再支持。
- 相关规则参见 [GitHub ToS](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)、[GitHub AUP](https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies)、[Vercel 关于 CDN/代理的说明](https://vercel.com/guides/why-running-another-cdn-on-top-of-vercel-is-not-recommended)。

### Docker（推荐）

```bash
# 拉取预构建镜像，支持 linux/amd64 与 linux/arm64
docker pull kuekhaoyang/kvideo:latest
docker run -d -p 3000:3000 --name kvideo kuekhaoyang/kvideo:latest

# 或使用 docker-compose
docker-compose up -d

# 自行构建
git clone https://github.com/KuekHaoYang/KVideo.git && cd KVideo
docker build -t kvideo . && docker run -d -p 3000:3000 --name kvideo kvideo
```

### 传统 Node.js

```bash
git clone https://github.com/KuekHaoYang/KVideo.git && cd KVideo
npm install
npm run build
npm start
```

如需局域网设备通过本机 IP 访问，使用 `ALLOW_LAN_ACCESS=true npm run start`，并确认防火墙已放行对应端口。Docker 镜像在容器内监听 `0.0.0.0`，能否从局域网访问取决于 `-p` 端口映射与宿主机网络策略。

### Vercel

仅从**本地工作副本**部署，使用 Vercel CLI，不使用 GitHub 一键导入或 Connect GitHub 流程。适用于仅需搜索、账户、设置与直连播放的场景。详见 [Vercel 导入文档](https://vercel.com/docs/getting-started-with-vercel/import)。

### 更新

```bash
# Docker
docker stop kvideo && docker rm kvideo
docker pull kuekhaoyang/kvideo:latest
docker run -d -p 3000:3000 --name kvideo kuekhaoyang/kvideo:latest

# Node.js
cd KVideo && git pull origin main
npm install && npm run build && npm start
```

Vercel 部署需在本地工作副本通过 CLI 重新发布，不依赖仓库自动导入。仓库在代码推送至 main 分支后，由 GitHub Actions 自动构建并推送多架构镜像至 Docker Hub。

---

## 常见问题

**浏览器版本要求？** Chrome / Edge 130+、Safari 17.5+、Firefox 121+、iOS/iPadOS 17.5+。低于基线版本时，应用将显示静态提示页且不加载主程序。Chromium 基线设为 130 是为了原生支持 `light-dark()` 主题色。

**部分视频源无法播放？** 合规模式仅支持浏览器直连，不提供代理兜底。依赖特殊请求头、防盗链或受 CORS 限制的源可能无法播放，属预期限制，建议更换允许直连的源。部分内置浏览器的 WebView 对 MSE/HLS.js 支持不完整，建议使用上述基线浏览器。

**IPv6 环境下 HTTPS 视频无法播放？** 请检查反向代理（Caddy / Nginx）是否正确监听 IPv6、路由器 IPv6 端口映射规则，以及非标准端口的防火墙放行情况。此问题属于网络配置范畴，与 KVideo 代码无关。

**移动端与 TV 体验如何？** 移动端提供专用组件，支持双击快进、滑动调节音量；TV 模式支持方向键空间导航、10 英尺 UI 与焦点高亮。

---

## 文档索引

README 为快速入口，深入开发与维护请参阅 [项目文档](docs/README.md)：

| 主题 | 文档 |
| --- | --- |
| 技术栈、目录结构、运行时拓扑 | [01 架构总览](docs/01-architecture.md) |
| 页面路由、功能地图、模式差异 | [02 功能与路由](docs/02-features-and-routes.md) |
| 视频源模型、SSE 搜索、分辨率探测 | [03 搜索与视频源](docs/03-search-and-sources.md) |
| API 路由、请求/响应、SSE 协议 | [04 API 参考](docs/04-api-reference.md) |
| 播放器组件树、HLS、弹幕、广告过滤 | [05 播放器](docs/05-player.md) |
| 三种认证、角色权限、profile 隔离、云同步 | [06 认证、存储与同步](docs/06-auth-storage-sync.md) |
| 高级模式密码门与独立设置 | [07 高级模式](docs/07-premium.md) |
| Docker/Node/Vercel、环境变量、运维排查 | [08 部署与运维](docs/08-deployment-and-ops.md) |
| 本地启动、常用命令、改造配方 | [09 开发工作流](docs/09-development-workflow.md) |
| 单元测试、严格验证套件 | [10 测试与验证](docs/10-testing-and-verification.md) |
| 已知陷阱、复杂度热点、安全事项 | [11 陷阱与热点](docs/11-pitfalls-and-hotspots.md) |
| 精简与架构升级计划（含 Phase 进度） | [12 重构计划](docs/12-refactor-plan.md) |
| 主题色定义与改色清单 | [13 主题与配色](docs/13-theme-and-color.md) |
| UI 基础组件清单与改造待办 | [14 UI 基础组件](docs/14-ui-components.md) |

---

## 贡献与许可

欢迎报告 Bug、提出建议、改进文档或提交代码，详见 [贡献指南](CONTRIBUTING.md)。

- 报告 Bug：[GitHub Issues](https://github.com/KuekHaoYang/KVideo/issues)
- 代码贡献：Fork → Branch → PR

本项目基于 [MIT 许可证](LICENSE) 开源，感谢 Next.js、Tailwind CSS、Zustand、React、hls.js、@iconify/react、dnd-kit 等开源项目。

**作者**：[KuekHaoYang](https://github.com/KuekHaoYang) · [项目主页](https://github.com/KuekHaoYang/KVideo)

---

[![Star History Chart](https://api.star-history.com/svg?repos=KuekHaoYang/KVideo&type=date&legend=top-left)](https://www.star-history.com/#KuekHaoYang/KVideo&type=date&legend=top-left)

<div align="center">
  Made with ❤️ by <a href="https://github.com/KuekHaoYang">KuekHaoYang</a>
  <br>
  如果这个项目对你有帮助，请考虑给一个 ⭐️
</div>
