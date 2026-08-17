import type { RouteRecordRaw } from 'vue-router';

import type { MenuRecordRaw } from '@vben-core/typings';

import { acceptHMRUpdate, defineStore } from 'pinia';

type AccessToken = null | string;

interface AccessState {
  accessCodes: string[];
  accessMenus: MenuRecordRaw[];
  accessRoutes: RouteRecordRaw[];
  accessToken: AccessToken;
  isAccessChecked: boolean;
  isLockScreen: boolean;
  lockScreenPassword?: string;
  loginExpired: boolean;
  refreshToken: AccessToken;
}

export const useAccessStore = defineStore('core-access', {
  actions: {
    /**
     * 按标准化路径从当前访问菜单树中查找菜单节点。
     *
     * @param path - 要在当前访问菜单树中精确匹配的标准化路径。
     * @returns 与标准化路径匹配的菜单节点；没有匹配项时返回 undefined。
     */
    getMenuByPath(path: string) {
      /**
       * 递归遍历访问菜单树并按路径查找节点，命中后立即停止继续搜索。
       *
       * @param menus - 当前递归层级中要查找的访问菜单节点。
       * @param path - 要与菜单节点 path 精确比较的标准化路径。
       * @returns 访问菜单树中与目标路径匹配的节点；没有匹配项时返回 undefined。
       */
      function findMenu(
        menus: MenuRecordRaw[],
        path: string,
      ): MenuRecordRaw | undefined {
        for (const menu of menus) {
          if (menu.path === path) {
            return menu;
          }
          if (menu.children) {
            const matched = findMenu(menu.children, path);
            if (matched) {
              return matched;
            }
          }
        }
      }
      return findMenu(this.accessMenus, path);
    },
    /**
     * 写入锁屏状态与可选密码，并持久化当前锁定会话。
     *
     * @param password - 锁屏后保存、供后续解锁校验使用的密码。
     */
    lockScreen(password: string) {
      this.isLockScreen = true;
      this.lockScreenPassword = password;
    },
    /**
     * 替换权限 store 中的当前访问码集合。
     *
     * @param codes - 用于权限判断的访问码集合。
     */
    setAccessCodes(codes: string[]) {
      this.accessCodes = codes;
    },
    /**
     * 替换权限 store 中的当前可访问菜单树。
     *
     * @param menus - 要替换权限 store 当前值的可访问菜单树。
     */
    setAccessMenus(menus: MenuRecordRaw[]) {
      this.accessMenus = menus;
    },
    /**
     * 替换当前可访问路由集合，并同步派生的路由名称与缓存状态。
     *
     * @param routes - 要替换权限 store 当前值的可访问路由集合。
     */
    setAccessRoutes(routes: RouteRecordRaw[]) {
      this.accessRoutes = routes;
    },
    /**
     * 将访问令牌写入权限 store；传入空值时清除现有令牌。
     *
     * @param token - 要写入权限状态的访问令牌；null 表示清除令牌。
     */
    setAccessToken(token: AccessToken) {
      this.accessToken = token;
    },
    /**
     * 记录当前路由访问权限是否已经完成首次校验。
     *
     * @param isAccessChecked - 路由访问权限是否已经完成首次校验。
     */
    setIsAccessChecked(isAccessChecked: boolean) {
      this.isAccessChecked = isAccessChecked;
    },
    /**
     * 更新登录过期标志，供认证失效弹窗与路由逻辑共享。
     *
     * @param loginExpired - 当前认证会话是否已被标记为过期。
     */
    setLoginExpired(loginExpired: boolean) {
      this.loginExpired = loginExpired;
    },
    /**
     * 将刷新令牌写入权限 store；传入空值时清除现有令牌。
     *
     * @param token - 要写入权限状态的刷新令牌；null 表示清除令牌。
     */
    setRefreshToken(token: AccessToken) {
      this.refreshToken = token;
    },
    /**
     * 校验锁屏密码并恢复页面交互，验证失败时保持锁定状态。
     */
    unlockScreen() {
      this.isLockScreen = false;
      this.lockScreenPassword = undefined;
    },
  },
  persist: {
    // 持久化
    pick: [
      'accessToken',
      'refreshToken',
      'accessCodes',
      'isLockScreen',
      'lockScreenPassword',
    ],
  },
  state: (): AccessState => ({
    accessCodes: [],
    accessMenus: [],
    accessRoutes: [],
    accessToken: null,
    isAccessChecked: false,
    isLockScreen: false,
    lockScreenPassword: undefined,
    loginExpired: false,
    refreshToken: null,
  }),
});

// 解决热更新问题
const hot = import.meta.hot;
if (hot) {
  hot.accept(acceptHMRUpdate(useAccessStore, hot));
}
