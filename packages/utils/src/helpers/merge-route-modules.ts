import type { RouteRecordRaw } from 'vue-router';

// 定义模块类型
interface RouteModuleType {
  default: RouteRecordRaw[];
}

/**
 * 从动态导入模块中提取默认路由数组，并合并为单一列表。
 *
 * @param routeModules - 由文件路径映射到动态路由模块导出的对象。
 * @returns 所有动态路由模块默认导出的扁平路由数组。
 */
function mergeRouteModules(
  routeModules: Record<string, unknown>,
): RouteRecordRaw[] {
  const mergedRoutes: RouteRecordRaw[] = [];

  for (const routeModule of Object.values(routeModules)) {
    const moduleRoutes = (routeModule as RouteModuleType)?.default ?? [];
    mergedRoutes.push(...moduleRoutes);
  }

  return mergedRoutes;
}

export { mergeRouteModules };

export type { RouteModuleType };
