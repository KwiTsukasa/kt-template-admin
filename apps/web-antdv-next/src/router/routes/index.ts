import type { RouteRecordRaw } from 'vue-router';

import { mergeRouteModules, traverseTreeValues } from '@vben/utils';

import { coreRoutes, fallbackNotFoundRoute } from './core';

const dynamicRouteFiles = import.meta.glob(
  ['./modules/**/*.ts', '!./modules/**/*.spec.ts'],
  {
    eager: true,
  },
);

// 有需要可以自行打开注释，并创建文件夹
// const externalRouteFiles = import.meta.glob('./external/**/*.ts', { eager: true });
// const staticRouteFiles = import.meta.glob('./static/**/*.ts', { eager: true });

const dynamicRoutes: RouteRecordRaw[] = mergeRouteModules(dynamicRouteFiles);

// const externalRoutes: RouteRecordRaw[] = mergeRouteModules(externalRouteFiles);
// const staticRoutes: RouteRecordRaw[] = mergeRouteModules(staticRouteFiles);
const staticRoutes: RouteRecordRaw[] = [];
const externalRoutes: RouteRecordRaw[] = [];

const routes: RouteRecordRaw[] = [
  ...coreRoutes,
  ...externalRoutes,
  fallbackNotFoundRoute,
];

const coreRouteNames = traverseTreeValues(coreRoutes, (route) => route.name);

const accessRoutes = [...dynamicRoutes, ...staticRoutes];

const componentKeys: string[] = Object.keys({
  ...import.meta.glob(['../../views/**/*.tsx', '!../../views/**/*.spec.tsx']),
  ...import.meta.glob('../../views/**/*.vue'),
})
  .filter((item) => !item.includes('/modules/'))
  .map((v) => {
    const path = v.replace('../../views/', '/');
    return path.replace(/\.(tsx|vue)$/, '');
  })
  .filter(
    (path) =>
      path.startsWith('/blog/') ||
      path.startsWith('/llm/') ||
      path.startsWith('/qqbot/') ||
      path.startsWith('/system/'),
  );

export { accessRoutes, componentKeys, coreRouteNames, routes };
