# KT Template Admin

`kt-template-admin` 是 KT 后台管理端项目，基于 Vben 5.6.0 精简后只保留 `antdv-next` 应用，接口统一接入 `kt-template-online-api`，生产发布走 Jenkins 静态构建和 Nginx 反向代理。

## 项目结构

```text
apps/web-antdv-next       后台管理端入口
internal                  构建、Vite、Lint 等内部配置包
packages                  Vben 运行时依赖的核心包和组件包
deploy/nginx-admin.conf   Admin 静态站点和后端 /api 反向代理配置
Jenkinsfile               Jenkins 静态发布流水线
```

## 环境要求

- Node.js `22.22.0`
- pnpm `10.28.2`

建议通过 Corepack 固定 pnpm 版本：

```bash
corepack enable
corepack prepare pnpm@10.28.2 --activate
```

## 常用命令

```bash
pnpm install
pnpm run dev
pnpm run verify:commit
pnpm run build:antdv-next
```

## 环境变量

本地开发和 Jenkins 构建主要使用：

- `VITE_GLOB_API_URL`：后端 API 前缀，本地和生产默认使用 `/api`
- `VITE_BASE`：Vite base，默认 `/`
- `VITE_ROUTER_HISTORY`：路由模式，可选 `hash` 或 `html5`
- `VITE_COMPRESS`：构建压缩方式，可选 `none`、`gzip`、`brotli`

真实环境变量不提交，示例配置以 `.env.example` 为准。

## 业务页面

- 系统管理 / 菜单管理维护后端 `admin_menu.sort` 排序字段；`/menu/all` caller 会把后端 `sort` 映射到 Vben 菜单生成器读取的 `meta.order`，保证侧边栏菜单展示以后端返回顺序为准。默认首页入口收敛到环境总览 `/analytics`，不再保留假工作台 `/workspace` 页面。
- 系统管理 / 站内信是日志级通知列表，只展示 API 错误、QQBot 下线、NapCat 离线等后端自动捕获事件；页面提供筛选、处理/重新打开、置顶和删除，不提供人工新增或编辑。
- QQBot / 账号连接页拆分 OneBot 连接、QQ 登录、NapCat 运行和运行说明列；更新登录通过 SSE 展示 quick / password / captcha / new-device / qrcode 每步中文进度，密码登录触发 QQ 安全验证时在弹窗内完成腾讯验证码并回交 API，新设备验证二维码和腾讯验证码分开展示；行操作“运行态”打开只读抽屉，展示 NapCat runtime/protocol/session behavior profile、风险模式和登录事件证据。
- QQBot / 插件平台页保留在线命令能力表，并提供 manifest 校验、本地插件安装、安装记录、运行事件和账号绑定抽屉，接口走 `/qqbot/plugin-platform/*`。

## 部署说明

Jenkins 使用 `Jenkinsfile` 执行：

1. 安装依赖
2. `pnpm run verify:commit`
3. `pnpm run build:antdv-next`
4. 将 `apps/web-antdv-next/dist` 原子发布到 Nginx 挂载的 Admin 静态目录

Nginx 配置见 `deploy/nginx-admin.conf`，默认监听 `5999`，静态根目录为 `/usr/share/nginx/html/admin`，并将浏览器侧 `/api/*` 转发到后端 `192.168.31.224:48085`，将 `/napcat-webui/*` 转发到 NapCat WebUI Gateway `192.168.31.224:48086`。配置保留 gzip、静态资源长缓存、入口 HTML 不缓存、WebUI WebSocket 转发和 SPA 回退。

## 提交规范

Husky 会在提交前执行 lint 和类型校验，并在 `commit-msg` 阶段校验提交信息格式：

```text
feat(admin): 增加后台菜单配置
fix(api): 修复登录态刷新
```

要求使用英文类型前缀，描述部分包含中文。

## 来源与许可证

| 一级来源 | 使用方式 | License |
| --- | --- | --- |
| [Vben Admin](https://github.com/vbenjs/vue-vben-admin) | Admin 基础工程、Vben 工作区结构和后台运行时约定 | MIT |
