import type { Recordable, UserInfo } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'antdv-next';
import { defineStore } from 'pinia';

import {
  getAccessCodesApi,
  getUserInfoApi,
  loginApi,
  logoutApi,
  refreshTokenApi,
} from '#/api';
import { baseRequestClient } from '#/api/request';
import { $t } from '#/locales';
import {
  buildAdminMobileSsoRedirect,
  isAdminMobileSsoCallback,
} from '#/router/admin-sso';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);

  interface AdminUserInfoResponse {
    data: {
      code: number;
      data?: UserInfo;
    };
    status: number;
  }

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
   * 依次读取路由 query、浏览器 search 与 hash 中的 redirect，全部缺失时返回 null。
   *
   * @returns 当前路由或 hash 中的回跳地址；全部缺失时返回 null。
   */
  function getRedirectQuery() {
    const routeRedirect = router.currentRoute.value.query?.redirect as
      | string
      | undefined;

    if (routeRedirect) return routeRedirect;

    // 兼容旧链接 /auth/login?redirect=... 在 hash 路由下被放到 location.search 的情况。
    const searchRedirect = new URLSearchParams(window.location.search).get(
      'redirect',
    );
    if (searchRedirect) return searchRedirect;

    // Web/Playground 生产配置会跳 /#/auth/login?redirect=...；
    // Admin 本地 history 模式下该 query 只存在于 location.hash。
    const hashQueryIndex = window.location.hash.indexOf('?');
    if (hashQueryIndex === -1) return null;

    return new URLSearchParams(
      window.location.hash.slice(hashQueryIndex + 1),
    ).get('redirect');
  }

  /**
   * 防止原生回跳泄露权限码与用户资料；固定 Android scheme 只携令牌，受信 Web 地址保留完整上下文。
   *
   * @param target - 尚未附加认证参数的外部目标地址。
   * @returns 按目标类型附加认证上下文后的地址；缺少令牌或地址非法时为原地址。
   */
  function buildExternalAuthRedirectUrl(target: string) {
    if (!accessStore.accessToken) return target;

    if (isAdminMobileSsoCallback(target)) {
      const callback = buildAdminMobileSsoRedirect(
        target,
        accessStore.accessToken,
      );
      if (callback) return callback;
      return target;
    }

    try {
      const url = new URL(target);
      url.searchParams.set('ktAccessToken', accessStore.accessToken);

      if (accessStore.accessCodes.length > 0) {
        url.searchParams.set(
          'ktAccessCodes',
          JSON.stringify(accessStore.accessCodes),
        );
      }

      if (userStore.userInfo) {
        url.searchParams.set('ktUserInfo', JSON.stringify(userStore.userInfo));
      }

      return url.toString();
    } catch {
      return target;
    }
  }

  /**
   * 把认证令牌附加到受信任外部地址后执行整页跳转。
   *
   * @param target - 需要附加认证上下文并执行整页跳转的外部地址。
   */
  function redirectToExternalWithAuth(target: string) {
    window.location.href = buildExternalAuthRedirectUrl(target);
  }

  /**
   * 仅把 HTTP(S) 与 KwiCore Android scheme 识别为整页回跳，其他值继续交给站内路由。
   *
   * @param target - 登录完成后已经解码的候选目标。
   * @returns 目标属于受支持的外部回跳协议时返回 true。
   */
  function isExternalAuthRedirect(target: string) {
    if (isAdminMobileSsoCallback(target)) {
      return true;
    }
    return /^https?:\/\//i.test(target);
  }

  /**
   * 通过解析登录后的回跳目标；外部地址追加认证信息，站内地址交给路由跳转。
   *
   * @param fallbackPath - 没有合法回跳地址时使用的站内兜底路径。
   */
  async function goToRedirect(fallbackPath: string) {
    const redirect = decodeRedirect(getRedirectQuery() || undefined);
    const target = redirect || fallbackPath;

    if (isExternalAuthRedirect(target)) {
      redirectToExternalWithAuth(target);
      return;
    }

    await router.push(target);
  }

  /**
   * 完成账号登录、用户资料与权限码装载，并在失败时清空残留会话状态。
   *
   * @param params - 登录接口要求的账号、密码及可选验证码等凭据。
   * @param onSuccess - 操作成功后执行的可选回调。
   * @returns 包含已加载用户资料的对象；接口未返回访问令牌时资料为 null。
   * @throws 登录、资料或权限码请求失败时清理本地会话并重新抛出原始异常。
   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    // 异步处理用户登录操作并获取 accessToken
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;
      const { accessToken } = await loginApi(params);

      // 如果成功获取到 accessToken
      if (accessToken) {
        accessStore.setAccessToken(accessToken);

        // 获取用户信息并存储到 accessStore 中
        const [fetchUserInfoResult, accessCodes] = await Promise.all([
          fetchUserInfo(),
          getAccessCodesApi(),
        ]);

        userInfo = fetchUserInfoResult;

        userStore.setUserInfo(userInfo);
        accessStore.setAccessCodes(accessCodes);

        if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
        } else {
          if (onSuccess) {
            await onSuccess?.();
          } else {
            await goToRedirect(
              userInfo.homePath || preferences.app.defaultHomePath,
            );
          }
        }

        if (userInfo?.realName) {
          notification.success({
            description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
            duration: 3,
            title: $t('authentication.loginSuccess'),
          });
        }
      }
    } catch (error) {
      accessStore.setAccessToken(null);
      accessStore.setAccessCodes([]);
      userStore.setUserInfo(null);

      try {
        await logoutApi();
      } catch {
        // 不做任何处理
      }

      throw error;
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  /**
   * 使用不带自动刷新拦截器的客户端校验访问令牌，并只在服务端确认后写入用户资料。
   *
   * @param accessToken - 待通过 `/user/info` 校验的 Admin 访问令牌。
   * @returns 服务端确认的用户资料；令牌失效、响应异常或合同不完整时返回 null。
   */
  async function validateSsoAccessToken(accessToken: string) {
    try {
      const response = await baseRequestClient.get<AdminUserInfoResponse>(
        '/user/info',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      const responseBody = response.data;
      if (response.status < 200 || response.status >= 300) return null;
      if (responseBody.code !== 200 || !responseBody.data) return null;
      userStore.setUserInfo(responseBody.data);
      return responseBody.data;
    } catch {
      return null;
    }
  }

  /**
   * 清除尚未通过服务端校验的访问令牌、权限码与用户资料，阻止旧状态继续参与 SSO 回跳。
   */
  function clearUnverifiedSsoState() {
    accessStore.setAccessToken(null);
    accessStore.setAccessCodes([]);
    userStore.setUserInfo(null);
  }

  /**
   * 校验现有令牌；失效或缺失时显式使用 HttpOnly Cookie 刷新并再次校验，全部失败才清空状态。
   *
   * @returns 当前 Admin 会话已由 `/user/info` 确认时返回 true，否则返回 false。
   */
  async function ensureValidSsoSession() {
    const currentAccessToken = accessStore.accessToken;
    if (
      currentAccessToken &&
      (await validateSsoAccessToken(currentAccessToken))
    ) {
      accessStore.setLoginExpired(false);
      return true;
    }

    clearUnverifiedSsoState();

    try {
      const response = await refreshTokenApi();
      const refreshedAccessToken = response.data;
      if (!refreshedAccessToken) {
        clearUnverifiedSsoState();
        return false;
      }

      accessStore.setAccessToken(refreshedAccessToken);
      if (!(await validateSsoAccessToken(refreshedAccessToken))) {
        clearUnverifiedSsoState();
        return false;
      }

      accessStore.setLoginExpired(false);
      return true;
    } catch {
      clearUnverifiedSsoState();
      return false;
    }
  }

  const isLoggingOut = ref(false); // 正在 logout 标识, 防止 /logout 死循环.

  /**
   * 结束后端会话并清空全部本地 store，随后带当前地址返回登录页。
   *
   * @param redirect - 是否在退出后保留当前地址作为登录回跳参数；未传入时使用 `true`。
   */
  async function logout(redirect: boolean = true) {
    if (isLoggingOut.value) return; // 正在登出中, 说明已进入循环, 直接返回.
    isLoggingOut.value = true; // 设置 标识

    try {
      await logoutApi();
    } catch {
      // 不做任何处理
    } finally {
      isLoggingOut.value = false; // 重置 标识

      resetAllStores();
      accessStore.setLoginExpired(false);
    }

    // 回登录页带上当前路由地址
    await router.replace({
      path: LOGIN_PATH,
      query: (() => {
        if (redirect) {
          return {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath),
          };
        }
        return {};
      })(),
    });
  }

  /**
   * 从后端读取当前登录用户资料并写入用户 store，返回同一份资料记录。
   *
   * @returns 后端返回并已写入用户 store 的当前用户资料。
   */
  async function fetchUserInfo() {
    let userInfo: null | UserInfo = null;
    userInfo = await getUserInfoApi();
    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  /**
   * 清空当前 store 的用户资料与角色缓存，使会话状态回到未初始化值。
   */
  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    ensureValidSsoSession,
    fetchUserInfo,
    loginLoading,
    logout,
    redirectToExternalWithAuth,
  };
});
