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

## 部署说明

Jenkins 使用 `Jenkinsfile` 执行：

1. 安装依赖
2. `pnpm run verify:commit`
3. `pnpm run build:antdv-next`
4. 将 `apps/web-antdv-next/dist` 原子发布到 Nginx 挂载的 Admin 静态目录

Nginx 配置见 `deploy/nginx-admin.conf`，默认监听 `5999`，静态根目录为 `/usr/share/nginx/html/admin`，并将浏览器侧 `/api/*` 转发到后端 `192.168.31.224:48085`。配置保留 gzip、静态资源长缓存、入口 HTML 不缓存和 SPA 回退。

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
