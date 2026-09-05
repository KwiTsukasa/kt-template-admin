# KT Template Admin

基于 Vben 和 antdv-next 的 KT 管理端，应用入口为 `apps/web-antdv-next`，后端使用 `kt-template-online-api`。

## 本地启动

当前工具链为 Node.js 22.22.0、pnpm 10.28.2；兼容约束以仓库 `package.json` 为准。

```powershell
pnpm install
pnpm dev
```

先按 [API 启动说明](../../Node/kt-template-online-api/README.md) 启动后端，Vite 将 `/api` 代理到本机 `48085`。旧 API `start:local` 脚本依赖 Bash/setsid，不作为常规 Windows 联调前提。

## 配置与检查

主要公开配置为 `VITE_GLOB_API_URL`、`VITE_BASE`、`VITE_ROUTER_HISTORY`、`VITE_COMPRESS` 和博客预览地址 `VITE_KT_BLOG_WEB_BASE_URL`。已跟踪的前端公开环境配置保持版本管理，真实凭据不进入客户端配置。

```powershell
pnpm test:type
pnpm test:unit
```

按变更范围选择类型检查、已有单测和实际页面验证。生产静态构建入口为 `pnpm build:antdv-next`，执行发布仍需相应授权和在线验证。

## 文档

[中央项目文档](../../docs/projects/admin/index.md) 汇总功能、包职责和历史设计验收；详细流程不在 README 重复维护。

## 来源与许可证


| 一级来源 | 使用方式 | License |
| --- | --- | --- |
| [Vben Admin](https://github.com/vbenjs/vue-vben-admin) | Admin 基础工程、Vben 工作区结构和后台运行时约定 | MIT |
