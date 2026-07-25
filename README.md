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
- `VITE_KT_BLOG_WEB_BASE_URL`：博客文章预览 iframe 打开的 KT Blog Web 公共地址，本地默认 `http://127.0.0.1:5173/`，生产必须指向部署后的 KT Blog Web，而不是 WordPress 后台或 WordPress 基准站点。

真实环境变量不提交，示例配置以 `.env.example` 为准。

## 业务页面

- Blog 左栏“管理”入口通过 `/#/auth/login?sso=1&redirect=%2Fblog%2Farticle` 进入 Admin SSO bootstrap。Admin 只在自身域内调用 `/api/auth/refresh` 恢复 HttpOnly refresh Cookie；成功后进入文章管理，失败则移除 `sso` 并显示登录表单，且只保留固定内部回跳 `/blog/article`。该链路不接受外部 return URL，也不把 access token 放进地址栏。
- 系统管理 / 菜单管理维护后端 `admin_menu.sort` 排序字段；`/menu/all` caller 会把后端 `sort` 映射到 Vben 菜单生成器读取的 `meta.order`，保证侧边栏菜单展示以后端返回顺序为准。默认首页入口收敛到环境总览 `/analytics`，不再保留假工作台 `/workspace` 页面。
- 系统管理 / 站内信是日志级通知列表，只展示 API 错误、QQBot 下线、NapCat 离线等后端自动捕获事件；页面提供筛选、处理/重新打开、置顶和删除，不提供人工新增或编辑。
- 系统管理 / 网络管理使用 TSX、KtTable 与统一 Vben 表单维护 API 持久化的 TCP/UDP 单端口转发期望状态，并通过独立页签管理腾讯云云解析 DNS 的 A/AAAA 自动更新绑定。页面展示 Agent、路由同步、UDP Keeper、公网端点租约和 DDNS 同步状态，支持异步 CRUD、重试、Keeper 启停、立即 STUN 刷新及端点历史；A 只使用合格 UDP Keeper 的公网 IPv4，AAAA 只使用 Agent 全局 IPv6，DNS 值不包含端口。首屏读取一次 HTTP 快照，后续只按 API SSE 的资源来源刷新当前活动页签；心跳和其他页签事件不刷新，不使用定时轮询。`Page autoContentHeight` 中的 Tabs 与 KtTable 必须由满高纵向 flex 外壳承接，活动面板保持 `flex-1 min-h-0`，否则 KtTable 的百分比高度链会塌陷。Admin 不接触路由器、MQTT 或腾讯云凭据；当前已验证切片只执行 UDP 路由器写入，TCP 可保存 CRUD 期望但 Agent 会显示设备协议门禁失败，STUN 操作保持可见且禁用。
- Vue i18n 文案中的普通 `@` 必须写成字面量插值 `{'@'}`，否则生产消息编译器会把它识别为 linked message 语法。网络管理语言包由 `network-locale.spec.ts` 逐条通过实际 i18n runtime 校验，不能只依赖 JSON 解析或组件测试里的 `$t` mock。
- QQBot / 账号连接页拆分 OneBot 连接、QQ 登录、NapCat 运行和运行说明列；更新登录通过 SSE 展示 quick / password / captcha / new-device / qrcode 每步中文进度，密码登录触发 QQ 安全验证时在弹窗内完成腾讯验证码并回交 API，新设备验证二维码和腾讯验证码分开展示；行操作“运行态”打开只读抽屉，展示 NapCat runtime/protocol/session behavior profile、风险模式和登录事件证据。
- QQBot / 消息订阅与消息模板是两个平级菜单；账号配置第四页签用于为当前 QQBot 选择订阅、模板以及群聊/私聊目标，不提供跨账号选择。模板编辑器输入 `$` 后通过 Mentions 候选精确插入 `${{变量}}`。三个入口只在首次进入、显式刷新或成功写操作后更新列表，不使用后台轮询；菜单、按钮与账号页签分别受 `QqBot:MessageSubscription:*`、`QqBot:MessageTemplate:*` 和 `QqBot:Account:MessagePush:*` 权限控制。
- QQBot / 插件平台页保留在线命令能力表，并提供 manifest 校验、本地插件安装、安装记录、运行事件和账号绑定抽屉，接口走 `/qqbot/plugin-platform/*`。
- 博客管理 / 文章管理提供“预览”行操作，打开隐藏二级路由 `/blog/article/:articleId/preview`；预览页按 NapCat WebUI 的微服务嵌入形态实现，iframe 独占容器，文章标题、状态、预览 Host 和返回/刷新/新窗口操作放在右下角悬浮卡片，不占用 iframe 布局空间。新增隐藏路由和按钮权限需要同步 API `blog-menu.sql` / `vben-admin-init.sql` 中的 `BlogArticlePreview` 与 `BlogArticlePreviewButton`。
- 博客管理 / 文章表单支持 Markdown、富文本 HTML、源码 HTML 三种编辑模式：Markdown 继续使用 Milkdown/Crepe 并保存 `contentFormat=markdown`；富文本 HTML 使用 Tiptap 并保存 `contentFormat=html`；源码 HTML 用于保留 WordPress/Argon 运行时 DOM，同样保存 `contentFormat=html`。Milkdown/Crepe 必须先引入 `@milkdown/crepe/theme/common/style.css`，再引入具体主题 CSS，否则生产包只有主题变量没有工具栏/菜单布局样式；组件 SCSS 还必须把 `--crepe-color-*` 映射到 Admin `hsl(var(--...))` 主题 token，并用固定高度外壳、隐藏溢出的 root 和正文 flex 滚动区覆盖 common 默认大 padding/高度模型，避免暗色模式脱节和首次空编辑器出现内部滚动条。

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
