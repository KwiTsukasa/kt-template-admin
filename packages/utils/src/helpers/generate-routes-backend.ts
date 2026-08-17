import type { RouteRecordRaw } from 'vue-router';

import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
  RouteRecordStringComponent,
} from '@vben-core/typings';

import { mapTree } from '@vben-core/shared/utils';

/**
 * 判断路由是否在菜单中显示但访问时展示 403（让用户知悉功能并申请权限）
 *
 * @param route - 要检查 menuVisibleWithForbidden 元信息的后端路由。
 * @returns 路由应显示菜单但内容需替换为 403 页面时为 true。
 */
function menuHasVisibleWithForbidden(route: RouteRecordRaw): boolean {
  return !!route.meta?.menuVisibleWithForbidden;
}

/**
 * 获取后端菜单并解析布局与页面组件；需要展示但无权限的节点改用 403 页面，失败时保留日志并抛出原异常。
 *
 * @param options - 后端菜单加载器、页面组件映射与无权限组件等路由生成依赖。
 * @returns 解析组件并应用无权限可见规则后的后端路由数组。
 * @throws 后端菜单加载或路由组件转换失败时记录并重新抛出原异常。
 */
async function generateRoutesByBackend(
  options: GenerateMenuAndRoutesOptions,
): Promise<RouteRecordRaw[]> {
  const {
    fetchMenuListAsync,
    layoutMap = {},
    pageMap = {},
    forbiddenComponent,
  } = options;

  try {
    const menuRoutes = await fetchMenuListAsync?.();
    if (!menuRoutes) {
      return [];
    }

    const normalizePageMap: ComponentRecordType = {};

    for (const [key, value] of Object.entries(pageMap)) {
      normalizePageMap[normalizeViewPath(key)] = value;
    }

    let routes = convertRoutes(menuRoutes, layoutMap, normalizePageMap);

    if (forbiddenComponent) {
      routes = mapTree(routes, (route) => {
        if (menuHasVisibleWithForbidden(route)) {
          route.component = forbiddenComponent;
        }
        return route;
      });
    }

    return routes;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * 递归把后端路由记录映射为 Vue Router 配置，并解析布局与页面组件。
 *
 * @param routes - 要递归解析布局与页面组件的后端字符串路由树。
 * @param layoutMap - 路由或页面标识到布局组件的映射。
 * @param pageMap - 后端视图路径到前端页面组件的映射。
 * @returns 递归转换完成、可直接注册到 Vue Router 的路由数组。
 */
function convertRoutes(
  routes: RouteRecordStringComponent[],
  layoutMap: ComponentRecordType,
  pageMap: ComponentRecordType,
): RouteRecordRaw[] {
  return mapTree(routes, (node) => {
    const route = node as unknown as RouteRecordRaw;
    const { component, name } = node;

    if (!name) {
      console.error('route name is required', route);
    }

    // layout转换
    if (component && layoutMap[component]) {
      route.component = layoutMap[component];
      // 页面组件转换
    } else if (component) {
      const normalizePath = normalizeViewPath(component);
      const pageKeys = getPageKeys(normalizePath);
      const pageKey = pageKeys.find((key) => pageMap[key]);

      if (pageKey) {
        route.component = pageMap[pageKey];
      } else {
        console.error(`route component is invalid: ${pageKeys[0]}`, route);
        route.component = pageMap['/_core/fallback/not-found.vue'];
      }
    }

    return route;
  });
}

/**
 * 移除相对路径与 `/views` 前缀，并保证页面路径以斜杠开头。
 *
 * @param path - 要去除相对前缀与 `/views` 前缀的页面组件路径。
 * @returns 去除扩展名、`index` 后缀和多余分隔符后的页面组件路径。
 */
function normalizeViewPath(path: string): string {
  // 去除相对路径前缀
  const normalizedPath = path.replace(/^(\.\/|\.\.\/)+/, '');

  // 确保路径以 '/' 开头
  const viewPath = (() => {
    if (normalizedPath.startsWith('/')) {
      return normalizedPath;
    }
    return `/${normalizedPath}`;
  })();

  // 这里耦合了vben-admin的目录结构
  return viewPath.replace(/^\/views/, '');
}

/**
 * 收集页面组件映射中的全部后端视图键，供路由路径校验使用。
 *
 * @param path - 已规范化、需要补齐 `.tsx` 或 `.vue` 扩展名的页面路径。
 * @returns 后端路由可解析的页面组件键数组。
 */
function getPageKeys(path: string): string[] {
  if (/\.(tsx|vue)$/.test(path)) return [path];

  return [`${path}.tsx`, `${path}.vue`];
}

export { generateRoutesByBackend };
