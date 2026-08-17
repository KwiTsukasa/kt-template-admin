import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';

import { resetStaticRoutes } from '@vben/utils';

import { createRouterGuard } from './guard';
import { routes } from './routes';
import { resolveAdminRuntimeBase } from './runtime-base';

const runtimeBase = resolveAdminRuntimeBase(window.location.pathname);
const router = createRouter({
  history: (() => {
    if (import.meta.env.VITE_ROUTER_HISTORY === 'hash') {
      return createWebHashHistory(runtimeBase);
    }
    return createWebHistory(runtimeBase);
  })(),
  // 应该添加到路由的初始路由列表。
  routes,
  scrollBehavior: (to, _from, savedPosition) => {
    if (savedPosition) {
      return savedPosition;
    }
    if (to.hash) {
      return { behavior: 'smooth', el: to.hash };
    }
    return { left: 0, top: 0 };
  },
  // 是否应该禁止尾部斜杠。
  // strict: true,
});

const resetRoutes = () => resetStaticRoutes(router, routes);

// 创建路由守卫
createRouterGuard(router);

export { resetRoutes, router };
