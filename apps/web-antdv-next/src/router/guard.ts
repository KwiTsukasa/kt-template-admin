import type { Router } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { startProgress, stopProgress } from '@vben/utils';

import { getAccessCodesApi } from '#/api';
import { accessRoutes, coreRouteNames } from '#/router/routes';
import { useAuthStore } from '#/store';

import { generateAccess } from './access';
import { refreshAccessCodes } from './access-codes';
import {
  isAdminMobileSsoCallback,
  isAdminSsoRequest,
  resolveAdminSsoRedirect,
} from './admin-sso';

/**
 * 对登录回跳参数执行 URI 解码；输入缺失时返回 null，编码非法时保留原值。
 *
 * @param redirect - 路由或地址栏中尚未解码的登录回跳地址；可省略。
 * @returns 解码后的回跳地址；输入为空时返回 null，编码非法时返回原字符串。
 */
function decodeRedirect(redirect?: string) {
  if (!redirect) return null;

  try {
    return decodeURIComponent(redirect);
  } catch {
    return redirect;
  }
}

/**
 * 仅将以 HTTP 或 HTTPS 协议开头的绝对地址判定为外部 URL。
 *
 * @param url - 要检查是否带 HTTP 或 HTTPS 协议的候选地址。
 * @returns 输入以 HTTP 或 HTTPS 协议开头时返回 true，否则返回 false。
 */
function isExternalUrl(url: string) {
  if (isAdminMobileSsoCallback(url)) {
    return true;
  }
  return /^https?:\/\//i.test(url);
}

/**
 * 依次读取显式参数、当前路由与 hash 中的 redirect 值，全部缺失时返回空字符串。
 *
 * @param queryRedirect - 路由 query 中尚未解码的回跳地址。
 * @returns 显式参数、当前路由或 hash 中首个可用回跳地址；全部缺失时为空字符串。
 */
function getRedirectQuery(queryRedirect?: string) {
  if (queryRedirect) return queryRedirect;

  // 兼容旧链接 /auth/login?redirect=... 在 hash 路由下被放到 location.search 的情况。
  const searchRedirect = new URLSearchParams(window.location.search).get(
    'redirect',
  );
  if (searchRedirect) return searchRedirect;

  // Web/Playground 生产配置会跳 /#/auth/login?redirect=...；
  // Admin 本地 history 模式下该 query 只存在于 location.hash。
  const hashQueryIndex = window.location.hash.indexOf('?');
  if (hashQueryIndex === -1) return '';

  return (
    new URLSearchParams(window.location.hash.slice(hashQueryIndex + 1)).get(
      'redirect',
    ) || ''
  );
}

/**
 * 通过路由守卫维护页面加载进度、动态标题与已加载状态。
 *
 * @param router - 要安装进度、标题与加载状态守卫的 Vue Router 实例。
 */
function setupCommonGuard(router: Router) {
  // 记录已经加载的页面
  const loadedPaths = new Set<string>();

  router.beforeEach((to) => {
    to.meta.loaded = loadedPaths.has(to.path);

    // 页面加载进度条
    if (!to.meta.loaded && preferences.transition.progress) {
      startProgress();
    }
    return true;
  });

  router.afterEach((to) => {
    // 记录页面是否加载,如果已经加载，后续的页面切换动画等效果不在重复执行
    loadedPaths.add(to.path);

    // 关闭页面加载进度条
    if (preferences.transition.progress) {
      stopProgress();
    }
  });
}

/**
 * 通过路由守卫执行登录检查、权限菜单生成与无权访问重定向。
 *
 * @param router - 要安装登录、权限路由与无权重定向守卫的 Vue Router 实例。
 */
function setupAccessGuard(router: Router) {
  router.beforeEach(async (to, from) => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    const authStore = useAuthStore();
    // 基本路由，这些路由不需要进入权限拦截
    if (coreRouteNames.includes(to.name as string)) {
      if (to.path === LOGIN_PATH && isAdminSsoRequest(to.query?.sso)) {
        const redirectPath = resolveAdminSsoRedirect(to.query?.redirect);

        if (await authStore.ensureValidSsoSession()) {
          if (isExternalUrl(redirectPath)) {
            authStore.redirectToExternalWithAuth(redirectPath);
            return false;
          }
          return redirectPath;
        }

        return {
          path: LOGIN_PATH,
          query: {
            redirect: encodeURIComponent(redirectPath),
          },
          replace: true,
        };
      }

      if (to.path === LOGIN_PATH && accessStore.accessToken) {
        const redirectPath =
          decodeRedirect(getRedirectQuery(to.query?.redirect as string)) ||
          userStore.userInfo?.homePath ||
          preferences.app.defaultHomePath;

        if (isExternalUrl(redirectPath)) {
          authStore.redirectToExternalWithAuth(redirectPath);
          return false;
        }

        return redirectPath;
      }
      return true;
    }

    // accessToken 检查
    if (!accessStore.accessToken) {
      // 明确声明忽略权限访问权限，则可以访问
      if (to.meta.ignoreAccess) {
        return true;
      }

      // 没有访问权限，跳转登录页面
      if (to.fullPath !== LOGIN_PATH) {
        return {
          path: LOGIN_PATH,
          // 如不需要，直接删除 query
          query: (() => {
            if (to.fullPath === preferences.app.defaultHomePath) {
              return {};
            }
            return { redirect: encodeURIComponent(to.fullPath) };
          })(),
          // 携带当前跳转的页面，登录后重新跳转该页面
          replace: true,
        };
      }
      return to;
    }

    // 是否已经生成过动态路由
    if (accessStore.isAccessChecked) {
      return true;
    }

    // 生成路由表
    // 当前登录用户拥有的角色标识列表
    const [userInfo] = await Promise.all([
      userStore.userInfo || authStore.fetchUserInfo(),
      refreshAccessCodes({
        loadAccessCodes: getAccessCodesApi,
        setAccessCodes: (codes) => accessStore.setAccessCodes(codes),
      }),
    ]);
    const userRoles = userInfo.roles ?? [];

    // 生成菜单和路由
    const { accessibleMenus, accessibleRoutes } = await generateAccess({
      roles: userRoles,
      router,
      // 则会在菜单中显示，但是访问会被重定向到403
      routes: accessRoutes,
    });

    // 保存菜单信息和路由信息
    accessStore.setAccessMenus(accessibleMenus);
    accessStore.setAccessRoutes(accessibleRoutes);
    accessStore.setIsAccessChecked(true);
    let redirectPath: string;
    const fromRedirect = getRedirectQuery(from.query.redirect as string);
    if (fromRedirect) {
      redirectPath =
        decodeRedirect(fromRedirect) || preferences.app.defaultHomePath;
    } else if (to.fullPath === preferences.app.defaultHomePath) {
      redirectPath = preferences.app.defaultHomePath;
    } else if (userInfo.homePath && to.fullPath === userInfo.homePath) {
      redirectPath = userInfo.homePath;
    } else {
      redirectPath = to.fullPath;
    }
    if (isExternalUrl(redirectPath)) {
      authStore.redirectToExternalWithAuth(redirectPath);
      return false;
    }

    return {
      ...router.resolve(redirectPath),
      replace: true,
    };
  });
}

/**
 * 依次把通用守卫和权限守卫安装到指定路由器。
 *
 * @param router - 要依次安装通用与权限守卫的 Vue Router 实例。
 */
function createRouterGuard(router: Router) {
  setupCommonGuard(router);
  setupAccessGuard(router);
}

export { createRouterGuard };
