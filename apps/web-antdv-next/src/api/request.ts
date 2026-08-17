import type { AxiosResponseHeaders, RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';
import { cloneDeep } from '@vben/utils';

import { message } from 'antdv-next';
import JSONBigInt from 'json-bigint';

import { useAuthStore } from '#/store';

import { refreshTokenApi } from './core';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

/**
 * 创建管理端请求客户端，并统一启用 Cookie、语言头、BigInt 安全解析与令牌刷新机制。
 *
 * @param baseURL - 所有管理端请求拼接使用的 API 基础地址。
 * @param options - 控制响应解包、认证刷新与错误处理的请求客户端选项。
 * @returns 已注册认证、响应解包与错误提示拦截器的请求客户端。
 */
function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
    withCredentials: true,
    transformResponse: (data: any, header: AxiosResponseHeaders) => {
      // storeAsString指示将BigInt存储为字符串，设为false则会存储为内置的BigInt类型
      if (
        header.getContentType()?.toString().includes('application/json') &&
        typeof data === 'string'
      ) {
        return cloneDeep(
          JSONBigInt({ storeAsString: true, strict: true }).parse(data),
        );
      }
      return data;
    },
  });

  /**
   * 当访问令牌与刷新令牌均失效时清空本地令牌，并按偏好显示过期弹窗或退出登录。
   */
  async function doReAuthenticate() {
    console.warn('Access token or refresh token is invalid or expired. ');
    const accessStore = useAccessStore();
    const authStore = useAuthStore();
    accessStore.setAccessToken(null);
    if (
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked
    ) {
      accessStore.setLoginExpired(true);
    } else {
      await authStore.logout();
    }
  }

  /**
   * 通过刷新端点取得新访问令牌，并立即写回访问状态仓库。
   *
   * @returns 已写入访问状态仓库的新访问令牌。
   */
  async function doRefreshToken() {
    const accessStore = useAccessStore();
    const resp = await refreshTokenApi();
    const newToken = resp.data;
    accessStore.setAccessToken(newToken);
    return newToken;
  }

  /**
   * 为非空访问令牌补上 Bearer 认证前缀，空令牌保持 null。
   *
   * @param token - 要添加 Bearer 前缀的访问令牌；null 表示不发送认证头。
   * @returns 带 Bearer 前缀的认证头值；令牌为空时返回 null。
   */
  function formatToken(token: null | string) {
    if (token) {
      return `Bearer ${token}`;
    }
    return null;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();
      const token = formatToken(accessStore.accessToken);

      if (token) {
        config.headers.Authorization = token;
      } else {
        delete config.headers.Authorization;
      }
      config.headers['Accept-Language'] = preferences.app.locale;
      return config;
    },
  });

  // 处理返回的响应数据格式
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'data',
      successCode: 200,
    }),
  );

  // token过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      // 这里可以根据业务进行定制,你可以拿到 error 内的信息进行定制化处理，根据不同的 code 做不同的提示，而不是直接使用 message.error 提示 msg
      // 后端错误统一放在 err，兼容旧 error/message 便于排查存量接口。
      const responseData = error?.response?.data ?? {};
      const errorMessage =
        responseData?.err ??
        responseData?.error ??
        responseData?.message ??
        responseData?.msg ??
        '';
      // 如果没有错误信息，则会根据状态码进行提示
      message.error(errorMessage || msg);
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const baseRequestClient = new RequestClient({ baseURL: apiURL });

export interface PageFetchParams {
  [key: string]: any;
  pageNo?: number;
  pageSize?: number;
}
