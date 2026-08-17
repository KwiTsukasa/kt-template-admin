import type { RouteRecordRaw } from 'vue-router';

import type { RouteMeta } from '@vben-core/typings';

import { filterTree, mapTree } from '@vben-core/shared/utils';

/**
 * 根据用户角色过滤前端静态路由，并转换为可访问路由与菜单。
 *
 * @param routes - 要按用户角色过滤并应用无权限页面替换的静态路由树。
 * @param roles - 当前用户拥有的角色标识集合。
 * @param forbiddenComponent - 无权限路由需要替换成的页面组件。
 * @returns 按角色过滤并解析组件后的前端路由数组。
 */
async function generateRoutesByFrontend(
  routes: RouteRecordRaw[],
  roles: string[],
  forbiddenComponent?: RouteRecordRaw['component'],
): Promise<RouteRecordRaw[]> {
  // 根据角色标识过滤路由表,判断当前用户是否拥有指定权限
  const finalRoutes = filterTree(routes, (route) => {
    return hasAuthority(route, roles);
  });

  if (!forbiddenComponent) {
    return finalRoutes;
  }

  // 如果有禁止访问的页面，将禁止访问的页面替换为403页面
  return mapTree(finalRoutes, (route) => {
    if (menuHasVisibleWithForbidden(route)) {
      route.component = forbiddenComponent;
    }
    return route;
  });
}

/**
 * 根据路由 authority 与用户角色交集判断访问权限。
 *
 * @param route - 提供 authority 与无权限可见标记的候选路由。
 * @param access - 允许访问路由的角色或权限标识集合。
 * @returns 路由未限制角色或当前角色命中限制时为 true。
 */
function hasAuthority(route: RouteRecordRaw, access: string[]) {
  const meta = route.meta as Partial<RouteMeta> | undefined;
  const authority = meta?.authority;
  if (!authority) {
    return true;
  }
  const canAccess = access.some((value) => authority.includes(value));

  return canAccess || (!canAccess && menuHasVisibleWithForbidden(route));
}

/**
 * 仅当路由应显示在菜单但内容会跳转 403 时返回 true。
 *
 * @param route - 要检查 authority 与 menuVisibleWithForbidden 元信息的路由。
 * @returns 路由应显示菜单但访问需重定向 403 时为 true。
 */
function menuHasVisibleWithForbidden(route: RouteRecordRaw) {
  const meta = route.meta as Partial<RouteMeta> | undefined;

  return (
    !!meta?.authority &&
    Reflect.has(meta || {}, 'menuVisibleWithForbidden') &&
    !!meta?.menuVisibleWithForbidden
  );
}

export { generateRoutesByFrontend, hasAuthority };
