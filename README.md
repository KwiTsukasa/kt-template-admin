# KT Template Admin

`kt-template-admin` 是 KT 后台管理端项目，基于 Vben 5.6.0 精简后只保留 `antdv-next` 应用，接口统一接入 `kt-template-online-api`，生产发布走 Jenkins 静态构建和 Nginx 反向代理。

## 项目结构

```text
apps/web-antdv-next       后台管理端入口
internal                  构建、Vite、Lint 等内部配置包
packages                  Vben 运行时依赖的核心包和组件包
test                      全仓库单元测试，按 api/views/packages/internal 等领域集中管理
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
pnpm run test:unit
pnpm run test:type
pnpm run verify:commit
pnpm run build:antdv-next
```

本地联调无需再手改 API 的 MySQL/Redis 端口：先在 API 仓库运行 `pnpm start:local`，再在本仓库运行 `pnpm dev`；Vite 会把 `/api` 直接代理到 `http://localhost:48085`。需要一次命令验证后端真实链路时，在 API 仓库运行 `pnpm verify:local`，它会自动准备并清理专用本地库、API 和本轮启动的 Redis。

## 环境变量

本地开发和 Jenkins 构建主要使用：

- `VITE_GLOB_API_URL`：后端 API 前缀，本地和生产默认使用 `/api`
- `VITE_BASE`：Vite base，默认 `/`
- `VITE_ROUTER_HISTORY`：路由模式，可选 `hash` 或 `html5`
- `VITE_COMPRESS`：构建压缩方式，可选 `none`、`gzip`、`brotli`
- `VITE_KT_BLOG_WEB_BASE_URL`：博客文章预览 iframe 打开的 KT Blog Web 公共地址，本地默认 `http://127.0.0.1:5173/`，生产必须指向部署后的 KT Blog Web，而不是 WordPress 后台或 WordPress 基准站点。

真实环境变量不提交，示例配置以 `.env.example` 为准。

## 统一 TLS 网关

同一生产构建同时支持旧正式域名根挂载和 `https://nas4.kwitsukasa.top:{动态端口}/admin/` 子路径挂载。开发环境 `VITE_BASE=/`，生产构建使用 `VITE_BASE=./` 保持静态资源相对路径；运行时根据当前 pathname 在根路径和 `/admin/` 之间选择 Router base。浏览器 API 始终走同 Origin 根相对 `/api/`。NapCat WebUI 和 K8s Dashboard 的公开路径分别为 `/admin/napcat-webui/` 与 `/admin/kt-k8s-dashboard/`，Traefik 去掉 `/admin` 后再交给既有 Admin Nginx 规则。

Admin 登录、刷新、退出和用户密码写入只允许可信 HTTPS Origin。登录请求直接发送 `username/password`，不再请求或返回 RSA 公钥；认证 Cookie 为 `HttpOnly`、`SameSite=Lax`、根 Path，生产固定 `Secure`。Blog 文章与主题管理只调用本地 Blog API，不提供 WordPress 导入按钮或运行时登录联动。完整路由、Canary、DNS/Caddy 和回滚步骤见根仓库 `docs/unified-natmap-tls-gateway-operations.md`。

## 业务页面

- Blog 左栏“管理”入口按 Admin 运行时基址进入 SSO bootstrap：旧 Host 使用 `/#/auth/login?...`，统一网关使用 `/admin/#/auth/login?...`。Admin 只在自身域内调用 `/api/auth/refresh` 恢复 HttpOnly refresh Cookie；成功后进入文章管理，失败则移除 `sso` 并显示登录表单。普通 SSO 只保留固定内部回跳 `/blog/article`；Voice Archive 是唯一外部例外，仅接受 `https://voice.nas4.kwitsukasa.top:{显式动态端口}/auth/callback` 与 `/auth/ios-callback`，拒绝 HTTP、缺失/越界端口、凭据、查询、fragment 和邻接 Host/路径。Admin 传回的 access token 必须由 Voice 立刻调用 `/user/info` 验证并清理 callback URL，不能扩展为任意 return URL。
- 系统管理 / 菜单管理维护后端 `admin_menu.sort` 排序字段；`/menu/all` caller 会把后端 `sort` 映射到 Vben 菜单生成器读取的 `meta.order`，保证侧边栏菜单展示以后端返回顺序为准。默认首页入口收敛到环境总览 `/analytics`，不再保留假工作台 `/workspace` 页面。
- 顶级“大模型 / 大模型配置”只使用卡片看板；卡片底部操作栏只显示带 tooltip 的语义图标，不提供表格切换，也不在卡片中选择模型。新增与编辑抽屉只保存名称、供应商、端点、凭据及启停/默认状态，不出现“可用模型”手填项。本地 Codex 固定使用部署声明的私有 gateway 且不接收 API Key。进入统一流式对话页时调用 `/llm/configs/:id/models` 按供应商协议实时加载模型及其推理强度/速度能力，已有会话模型仍可用时保留，否则选择当前首项；只显示当前模型实际支持的能力控件，未声明的推理强度或速度档位保持隐藏。路由 Tag 跟随当前模型名称，内容区不重复显示固定“流式对话”标题；配置卡、媒体治理入口与会话内路由替换都使用 `llm-chat-<configId>` 作为同一稳定 `pageKey`，因此 `conversationId` 变化只更新当前 Tag，不会新增第二个对话 Tag，Tab Store 同时清理旧版遗留的同 name/path fullPath 页签且不触发导航。`LlmChat` 路由保持 `keepAlive`，普通页面切换不卸载或取消当前生成；`/api/llm/` 代理显式关闭缓冲和缓存。共享 Composer 为 2–8 行自动增长，IME 合成态与 Shift+Enter 不触发发送，计数、提示和发送/停止语义图标位于独立工具栏，生成中只把同一操作位切换为停止。收到的 SSE 文本先写入响应式消息，再以可排空的自适应字符队列持续呈现打字机效果，完成态必须等待已收内容全部显示；Assistant 卡片、Card body、Markdown、Milkdown 与 ProseMirror 使用同一背景变量，不能在气泡内部形成底色断层。发现失败或空目录时禁止发送。普通对话与媒体治理复用同一对话工作区和 POST SSE，停止生成只中断当前流，不存在非流式回退。
- 共享对话页把路由 `conversationId` 作为持续状态输入，同一 config 的稳定 Tag 在普通/媒体 conversation 间切换时以 latest-wins 重新载入，URL 与 DOM 不得错配；媒体单会话隐藏冗余会话栏，页头分离 Task 标题与模型能力，消息正文使用居中阅读宽度，历史阅读停止自动抢滚动并提供“回到最新”，Composer 初始 1 行、最多 6 行。媒体业务标题固定为“Task 名 · 媒体治理”，首条自由文本不得覆盖。失败或中断的空回复显示明确状态，不再保留“正在等待输出”的空卡片。
- 原“系统管理 / 站内信”路由作为消息中心保留但不再显示在菜单中；具备 `System:Notice:List` 的用户通过右上角铃铛进入。铃铛以 small Badge 显示未读数并以 `99+` 封顶，共享 Bearer 鉴权 SSE 长连接实时校准未读数和列表；页面支持筛选、勾选未读消息批量已读、单条已读/未读、置顶和删除，不提供人工新增或编辑。
- 系统管理 / 网络管理使用 TSX、KtTable 与统一 Vben 表单维护 API 持久化的逻辑端口转发组；每组只配置一对内外端口，支持 TCP、UDP、TCP+UDP，并在同一行分别展示 TCP 静态转发与 NATMap、UDP 静态转发与 Keeper 的期望/实际状态，缺失通道显示 `—`。两个协议通道可独立重试、启停机制、复制公网端点和查看按协议区分的端点历史；结构字段在任一机制启用或协调中时锁定，名称与备注仍可编辑。DDNS 页签可将 A 记录绑定到 TCP NATMap 或 UDP Keeper 通道，分别展示原始公网端点、DNS 地址和派生的 `FQDN:端口`，AAAA 仍使用 Agent 全局 IPv6。首屏读取一次 HTTP 快照，后续只按唯一 API SSE 的语义资源来源刷新当前活动页签；心跳、相同端点续租和其他页签事件不刷新，不使用定时轮询。网络页显式保留两个直显行操作，其余收进更多操作。`Page autoContentHeight` 中的 Tabs 与 KtTable 必须由满高纵向 flex 外壳承接，活动面板保持 `flex-1 min-h-0`，否则 KtTable 的百分比高度链会塌陷。Admin 不接触路由器、MQTT 或腾讯云凭据。
- 顶级“媒体治理”以“系列资料库”为默认入口，`Series → Season → Episode` 是唯一层级事实，Task 只作为执行历史挂到集范围。系列列表固定使用 KtTable 筛选/分页和卡片 footer，不提供表格/看板切换；卡片操作栏只显示带 Tooltip 与 `aria-label` 的语义图标。系列详情按季展示集数和 Task 覆盖，分页显示 Episode 状态，并分别提供 RSS 订阅与执行历史 Tab。Bangumi 分篇编号显示为资料证据，不再决定 fnOS/TMDB 季号。
- 系列详情的批量磁链弹窗从起始集开始逐行映射 1–16 条磁链，并创建同一个多来源 Task；RSS 弹窗保存地址、发布组、内容类型、轮询周期、标题过滤和可选集号捕获正则，订阅卡片支持图标式立即轮询、暂停和启用。执行任务列表也固定为满高卡片看板，保留真实新建、详情、下载前身份编辑、Agent 和 revision 删除合同；不再显示无意义的表格/看板切换。逐文件映射继续对大来源使用 KtTable 原生虚拟表格，数值滚动轴由 KtTable 统一保证。任务详情仍提供来源、映射、字幕、元数据、CodexAgent、运行和证据页签，正式下载、治理与验收由数据库 Outbox 和 NAS 执行器承接。
- 媒体任务的身份与进度摘要以当前动作证据为准：唯一 provider 被元数据证据确认后展示已验证的 provider/年份；新 Run（同一下载续传除外）从 0% 开始，不沿用上一阶段完成进度。
- “Agent 治理队列”复用满高 KtTable、Vben 搜索表单和共享任务详情 Drawer，只查询 `requires-agent` 任务。列表用中文展示当前治理单元、Agent 状态、当前单元的精确元数据缺口、确定性修复/身份刷新次数、当前动作与心跳；表格行不触发详情，仅“查看”行操作打开 Drawer 的 CodexAgent 页签，空列表沿用 KtTable 标准 Empty。
- 媒体治理普通进度事件携带 `runId/runSequence` 与紧凑 Task patch，列表、看板和详情只按字段原位合并，不重新请求整页数据，也不为每个 SSE tick 展示 Spin。仅在序号缺口或 `snapshot-required` 时静默读取权威快照。qBittorrent 下载进度每 1 秒更新；磁链清单检查仍保持每 5 秒、最长 120 秒的独立反馈合同。
- “CodexAgent 治理”操作进入独立会话页：首屏展示当前 Task 身份、五层边界和可选治理建议，随后按 sequence 展示官方 App Server 同一 thread 的可见历史；用户可发送任意文本继续对话。conversation SSE 只增量合并消息，不刷新业务 Task，不显示整页 Spin；详情 Drawer 的 Agent 区域保留摘要和进入会话入口。
- 媒体治理完整生产面由递归 AST 维护性门禁覆盖：禁止条件三元表达式和六叶及以上复合 `if`；符合规则的具名函数必须具备有意义的中文 JSDoc。门禁动态发现文件，新增生产文件不能绕过。
- Vue i18n 文案中的普通 `@` 必须写成字面量插值 `{'@'}`，否则生产消息编译器会把它识别为 linked message 语法。网络管理语言包由 `network-locale.spec.ts` 逐条通过实际 i18n runtime 校验，不能只依赖 JSON 解析或组件测试里的 `$t` mock。
- 顶级“Bot 管理”只承载 Bot 业务页面：`NapCat 连接` 独立管理 OneBot、QQ 登录、运行态、WebUI 和账号能力；`Tencent 连接` 独立管理 QQ 官方 WebSocket/Webhook、AppID/AppSecret、插件绑定、菜单同步与 Webhook 回调。模型与 transport 不在同一账号表单混用，NapCat 页面不出现官方字段，Tencent 页面不出现扫码或 WebUI 操作。
- 顶级“插件平台”与 Bot 菜单平级，源码位于 `views/plugin-platform`，接口位于 `api/plugin-platform`。插件管理只展示 manifest、安装、运行事件和协议能力，定时任务位于 `/plugin-platform/tasks`；平台不显示或保存 `selfId`/AppID 绑定。NapCat 与 Tencent 在各自页面绑定插件并自行适配回调协议。
- 独立“消息管理”使用 `subscriberKey=bot` 与 `/message-management/subscribers/bot/accounts/:selfId/*` 配置 Bot 投递，权限为 `Bot:Account:MessagePush:*`；不保留 `/qqbot` 路由或 `QqBot:*` 权限兼容。

源码目录禁止同级存放单元测试或 `__tests__`；全部单元测试统一放在根目录单数 `test/`，应用测试直接使用 `test/api`、`test/components`、`test/router`、`test/store`、`test/views`，共享包与内部工具分别使用 `test/packages`、`test/internal`，结构门禁位于 `test/governance`。

KT 自有组件目录统一使用 kebab-case：操作组、表格和富文本分别位于 `apps/web-antdv-next/src/components/kt-action-group`、`kt-table`、`rich-text`；Bot 发送日志页面为 `apps/web-antdv-next/src/views/bot/send-log/list.tsx`，路由和数据库菜单统一为 `/bot/send-log` 与 `/bot/send-log/list`。

- Plugin Platform 权限使用 `PluginPlatform:Plugin:*` 与 `PluginPlatform:Task:*`；Tencent 操作使用 `Bot:Tencent:*`。操作按钮与后端 guard 使用同一权限码，动态菜单白名单必须包含全部按钮节点。
- 博客管理 / 文章管理提供“预览”行操作，打开隐藏二级路由 `/blog/article/:articleId/preview`；预览页按 NapCat WebUI 的微服务嵌入形态实现，iframe 独占容器，文章标题、状态、预览 Host 和返回/刷新/新窗口操作放在右下角悬浮卡片，不占用 iframe 布局空间。新增隐藏路由和按钮权限需要同步 API `blog-menu.sql` / `vben-admin-init.sql` 中的 `BlogArticlePreview` 与 `BlogArticlePreviewButton`。
- 博客管理 / 文章表单支持 Markdown、富文本 HTML、源码 HTML 三种编辑模式：Markdown 继续使用 Milkdown/Crepe 并保存 `contentFormat=markdown`；富文本 HTML 使用 Tiptap 并保存 `contentFormat=html`；源码 HTML 用于保留 WordPress/Argon 运行时 DOM，同样保存 `contentFormat=html`。Milkdown/Crepe 必须先引入 `@milkdown/crepe/theme/common/style.css`，再引入具体主题 CSS，否则生产包只有主题变量没有工具栏/菜单布局样式；组件 SCSS 还必须把 `--crepe-color-*` 映射到 Admin `hsl(var(--...))` 主题 token，并用固定高度外壳、隐藏溢出的 root 和正文 flex 滚动区覆盖 common 默认大 padding/高度模型，避免暗色模式脱节和首次空编辑器出现内部滚动条。

## 部署说明

Jenkins 使用 `Jenkinsfile` 执行：

1. 安装依赖
2. `pnpm run verify:commit`
3. `pnpm run build:antdv-next`
4. 将 `apps/web-antdv-next/dist` 原子发布到 Nginx 挂载的 Admin 静态目录

生产发布必须显式传入当前 release commit 的 `EXPECTED_SOURCE_COMMIT`，且 checkout HEAD、远端 `main`、远端 `dev` 必须同时等于该 40 位小写 SHA。发布参数固定为 `VITE_BASE=./`、 `VITE_GLOB_API_URL=/api`、`VITE_KT_BLOG_WEB_BASE_URL=/blog/` 和 `VITE_ROUTER_HISTORY=hash`；任一参数带前后空白或发生漂移都会在安装依赖前失败。远端分支校验由 Jenkins SSH Agent 使用现有 SCM 凭据 `github-ssh-kt-template`，不能依赖 Agent 容器自身的 Gitea 私钥。首次引入参数后，Jenkins 旧任务若以空 SHA 启动，会按设计先刷新参数并停止，随后再用当前 commit 显式触发。生产写入只允许非 PR 的 `main`，可配置的发布分支正则不授予生产写权限。Nginx 配置发布使用排他备份与同目录原子替换；相同构建号残留的 backup、candidate 或 restore 会直接阻断重入，禁止覆盖原备份。

Nginx 配置见 `deploy/nginx-admin.conf`，默认监听 `5999`，静态根目录为 `/usr/share/nginx/html/admin`，并将浏览器侧 `/api/*` 转发到后端 `192.168.31.224:48085`，将 `/napcat-webui/*` 转发到 NapCat WebUI Gateway `192.168.31.224:48086`。配置保留 gzip、静态资源长缓存、入口 HTML 不缓存、WebUI WebSocket 转发和 SPA 回退。 `/api/media-governance/events/stream` 使用优先于通用 `/api/` 的精确 location，固定关闭代理缓冲与缓存并延长读写超时；普通 API 仍沿用默认响应策略。

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
