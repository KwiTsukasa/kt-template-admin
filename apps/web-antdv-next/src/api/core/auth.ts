import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  export interface LoginResult {
    accessToken: string;
    wordpressAvailable?: boolean;
    wordpressAuth?: WordpressAuthResult['auth'] & {
      user?: Record<string, any>;
    };
    wordpressError?: null | {
      error?: any;
      message?: string;
      status?: number;
    };
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

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>(
    '/auth/login',
    {
      password: data.password,
      username: data.username,
    },
    {
      withCredentials: true,
    },
  );
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
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/auth/codes');
}
