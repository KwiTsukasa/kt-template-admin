import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }

  export interface WordpressAuthResult {
    auth: {
      nonce: string;
      type: 'cookie';
    };
    user?: Record<string, any>;
  }
}

interface ApiSuccessResponse<T> {
  code: number;
  data: T;
  msg: string;
}

interface RawApiResponse<T> {
  data: ApiSuccessResponse<T>;
  status: number;
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/auth/login', data, {
    withCredentials: true,
  });
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>(
    '/auth/refresh',
    {},
    {
      withCredentials: true,
    },
  );
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return baseRequestClient.post(
    '/auth/logout',
    {},
    {
      withCredentials: true,
    },
  );
}

/**
 * WordPress 自动认证
 */
export async function wordpressLoginApi() {
  const response = await baseRequestClient.post<
    RawApiResponse<AuthApi.WordpressAuthResult>
  >(
    '/wordpress/auth/login',
    {},
    {
      withCredentials: true,
    },
  );

  return response.data.data;
}

/**
 * 清理 WordPress 授权态
 */
export async function wordpressLogoutApi() {
  return baseRequestClient.post(
    '/wordpress/auth/logout',
    {},
    {
      withCredentials: true,
    },
  );
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/auth/codes');
}
