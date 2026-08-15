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

- Blog 左栏“管理”入口按 Admin 运行时基址进入 SSO bootstrap：旧 Host 使用 `/#/auth/login?...`，统一网关使用 `/admin/#/auth/login?...`。Admin 只在自身域内调用 `/api/auth/refresh` 恢复 HttpOnly refresh Cookie；成功后进入文章管理，失败则移除 `sso` 并显示登录表单，且只保留固定内部回跳 `/blog/article`。该链路不接受外部 return URL，也不把 access token 放进地址栏。
- 系统管理 / 菜单管理维护后端 `admin_menu.sort` 排序字段；`/menu/all` caller 会把后端 `sort` 映射到 Vben 菜单生成器读取的 `meta.order`，保证侧边栏菜单展示以后端返回顺序为准。默认首页入口收敛到环境总览 `/analytics`，不再保留假工作台 `/workspace` 页面。
- 系统管理 / 站内信是日志级通知列表，只展示 API 错误、QQBot 下线、NapCat 离线等后端自动捕获事件；页面提供筛选、处理/重新打开、置顶和删除，不提供人工新增或编辑。
- 系统管理 / 网络管理使用 TSX、KtTable 与统一 Vben 表单维护 API 持久化的逻辑端口转发组；每组只配置一对内外端口，支持 TCP、UDP、TCP+UDP，并在同一行分别展示 TCP 静态转发与 NATMap、UDP 静态转发与 Keeper 的期望/实际状态，缺失通道显示 `—`。两个协议通道可独立重试、启停机制、复制公网端点和查看按协议区分的端点历史；结构字段在任一机制启用或协调中时锁定，名称与备注仍可编辑。DDNS 页签可将 A 记录绑定到 TCP NATMap 或 UDP Keeper 通道，分别展示原始公网端点、DNS 地址和派生的 `FQDN:端口`，AAAA 仍使用 Agent 全局 IPv6。首屏读取一次 HTTP 快照，后续只按唯一 API SSE 的语义资源来源刷新当前活动页签；心跳、相同端点续租和其他页签事件不刷新，不使用定时轮询。网络页显式保留两个直显行操作，其余收进更多操作。`Page autoContentHeight` 中的 Tabs 与 KtTable 必须由满高纵向 flex 外壳承接，活动面板保持 `flex-1 min-h-0`，否则 KtTable 的百分比高度链会塌陷。Admin 不接触路由器、MQTT 或腾讯云凭据。
- 顶级“媒体治理”页面使用 KtTable 展示阶段、当前动作、量化进度、来源健康、元数据和阻塞状态，并提供“作品身份→来源→文件选择→字幕矩阵→来源健康与下载→治理就绪”六步向导。顶部运行健康区展示阻塞、失联 Run、闭环证据漂移、同季混合字幕与按 Task 去重的需要关注数；心跳按执行器真实观测时间显示，未知的 NAS 暂存残留不再伪装成 0。磁链和种子走媒体专用接口；文件选择以中文编辑每个所选清单项的治理角色、目标 Unit、季集和字幕语言，`S00` 无法可靠推断的集号保持未选中等待人工填写，字体压缩包只作为本地资产。无字幕媒体必须逐季绑定单一发布组字幕合同，映射和覆盖不完整时不得开始完整下载。列表和详情通过可续接 SSE 接收语义事件，游标缺口时重载权威快照。任务详情提供来源、映射、字幕、元数据、CodexAgent、运行和证据页签；映射页在下载前允许用当前 revision 修正必填资料库编号与可选年份，并用中文提示错填会造成身份错位，执行开始后只读锁定。详情页以中文按钮串联下载取消/续传、精确清理换源、元数据复采、最多两次有界修复、重新核验和独立验收；取消下载只停止密封 Run，待其返回终态后才能精确清理对应来源，避免残留下载 owner 或 staging。Agent 队列只显示确定性修复后仍需人工治理的任务。Agent 异常回合显示红色 `failed` 和“安全重试 CodexAgent”，只有 `needs-operator` 才显示候选选择表单。后端 `admin_menu` 的 3 个路由节点和 9 个按钮权限必须全部进入前端动态菜单白名单，任一层遗漏都会让线上菜单或操作权限静默消失。正式环境由数据库 Outbox 和 NAS 执行器承接下载、治理与验收，开发环境仍保留零正式媒体写入的进程内模拟模式。
- 媒体治理任务列表以共享 Tabs 切换表格/看板，两种视图都保持满高并使用 antdv-next 标准 Empty；支持真实新建、详情查看、下载前身份编辑，以及带 revision 门的任务删除。删除资格由 API `semanticProjection` 唯一投影：尚未产生载荷/计划的 intake `draft/blocked` 任务即使已有来源或绑定本地账本也可删除，确认文案明确账本编号，执行阶段及已有成果/验收证据的任务继续失败关闭。磁链清单检查失败时，详情统一显示“重新填写种子 / 磁链、重新编辑任务信息、删除任务”；已有清单的来源另提供重新编辑文件清单。检查期间每 5 秒显示中文进度，最长 120 秒终结。表格行与作品标题不隐式打开详情，统一“查看/编辑/删除任务”行操作承接 CRUD；操作触发器必须阻止冒泡，不能误触行事件。列表详情与隐藏详情路由复用同一任务操作 Drawer，由阶段契约投影唯一下一步，并在一个入口完成磁链或种子上传、逐文件映射、死种/死链探测、下载暂停/继续/取消、本地治理、元数据修复/核验、CodexAgent 候选放行和独立验收；业务表单只使用 Vben 与 antdv-next 封装组件。
- “Agent 治理队列”复用满高 KtTable、Vben 搜索表单和共享任务详情 Drawer，只查询 `requires-agent` 任务。列表用中文展示当前治理单元、Agent 状态、当前单元的精确元数据缺口、确定性修复/身份刷新次数、当前动作与心跳；表格行不触发详情，仅“查看”行操作打开 Drawer 的 CodexAgent 页签，空列表沿用 KtTable 标准 Empty。
- Vue i18n 文案中的普通 `@` 必须写成字面量插值 `{'@'}`，否则生产消息编译器会把它识别为 linked message 语法。网络管理语言包由 `network-locale.spec.ts` 逐条通过实际 i18n runtime 校验，不能只依赖 JSON 解析或组件测试里的 `$t` mock。
- QQBot / 账号连接页拆分 OneBot 连接、QQ 登录、NapCat 运行和运行说明列；更新登录通过 SSE 展示 quick / password / captcha / new-device / qrcode 每步中文进度，密码登录触发 QQ 安全验证时在弹窗内完成腾讯验证码并回交 API，新设备验证二维码和腾讯验证码分开展示；行操作“运行态”打开只读抽屉，展示 NapCat runtime/protocol/session behavior profile、风险模式和登录事件证据。
- QQBot / 消息订阅与消息模板是两个平级菜单；新建订阅和新建模板均不默认选择消息源。订阅选择来源后才按该来源的 `subscriptionFields` 动态生成字段并加载候选项，不把通用订阅表单绑定到 STUN；模板选择来源后才加载变量详情，输入 `$` 后通过 Mentions 候选精确插入 `${{变量}}`。账号配置第四页签用于为当前 QQBot 选择订阅、模板以及群聊/私聊目标，不提供跨账号选择，两个目标选择框固定填满横向表单宽度；上述消息推送表单的标签使用统一单行宽度，必填、格式和长度校验提示统一使用中文。三个入口只在首次进入、显式刷新或成功写操作后更新列表，不使用后台轮询；表格操作栏沿用 KtTable 全局“一个内联操作，其余收进更多操作”规则，菜单、按钮与账号页签分别受 `QqBot:MessageSubscription:*`、`QqBot:MessageTemplate:*` 和 `QqBot:Account:MessagePush:*` 权限控制。

源码目录禁止同级存放单元测试或 `__tests__`；全部单元测试统一放在根目录单数 `test/`，应用测试直接使用 `test/api`、`test/components`、`test/router`、`test/store`、`test/views`，共享包与内部工具分别使用 `test/packages`、`test/internal`，结构门禁位于 `test/governance`。

- QQBot / 插件平台页保留在线命令能力表，并提供 manifest 校验、本地插件安装、安装记录、运行事件和账号绑定抽屉，接口走 `/qqbot/plugin-platform/*`。
- 博客管理 / 文章管理提供“预览”行操作，打开隐藏二级路由 `/blog/article/:articleId/preview`；预览页按 NapCat WebUI 的微服务嵌入形态实现，iframe 独占容器，文章标题、状态、预览 Host 和返回/刷新/新窗口操作放在右下角悬浮卡片，不占用 iframe 布局空间。新增隐藏路由和按钮权限需要同步 API `blog-menu.sql` / `vben-admin-init.sql` 中的 `BlogArticlePreview` 与 `BlogArticlePreviewButton`。
- 博客管理 / 文章表单支持 Markdown、富文本 HTML、源码 HTML 三种编辑模式：Markdown 继续使用 Milkdown/Crepe 并保存 `contentFormat=markdown`；富文本 HTML 使用 Tiptap 并保存 `contentFormat=html`；源码 HTML 用于保留 WordPress/Argon 运行时 DOM，同样保存 `contentFormat=html`。Milkdown/Crepe 必须先引入 `@milkdown/crepe/theme/common/style.css`，再引入具体主题 CSS，否则生产包只有主题变量没有工具栏/菜单布局样式；组件 SCSS 还必须把 `--crepe-color-*` 映射到 Admin `hsl(var(--...))` 主题 token，并用固定高度外壳、隐藏溢出的 root 和正文 flex 滚动区覆盖 common 默认大 padding/高度模型，避免暗色模式脱节和首次空编辑器出现内部滚动条。

## 部署说明

Jenkins 使用 `Jenkinsfile` 执行：

1. 安装依赖
2. `pnpm run verify:commit`
3. `pnpm run build:antdv-next`
4. 将 `apps/web-antdv-next/dist` 原子发布到 Nginx 挂载的 Admin 静态目录

生产发布必须显式传入当前 release commit 的 `EXPECTED_SOURCE_COMMIT`，且 checkout HEAD、远端 `main`、远端 `dev` 必须同时等于该 40 位小写 SHA。发布参数固定为 `VITE_BASE=./`、 `VITE_GLOB_API_URL=/api`、`VITE_KT_BLOG_WEB_BASE_URL=/blog/` 和 `VITE_ROUTER_HISTORY=hash`；任一参数带前后空白或发生漂移都会在安装依赖前失败。远端分支校验由 Jenkins SSH Agent 使用现有 SCM 凭据 `github-ssh-kt-template`，不能依赖 Agent 容器自身的 Gitea 私钥。首次引入参数后，Jenkins 旧任务若以空 SHA 启动，会按设计先刷新参数并停止，随后再用当前 commit 显式触发。生产写入只允许非 PR 的 `main`，可配置的发布分支正则不授予生产写权限。Nginx 配置发布使用排他备份与同目录原子替换；相同构建号残留的 backup、candidate 或 restore 会直接阻断重入，禁止覆盖原备份。

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
