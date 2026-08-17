import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  export interface LoginResult {
    accessToken: string;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }
}

/**
 * 将账号密码发送到登录端点，并携带 Cookie 凭据换取访问令牌与用户标识。
 *
 * @param data - 用户输入的账号与密码；请求会携带 Cookie 凭据。
 * @returns 登录端点返回的访问令牌、刷新信息与用户标识。
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
 * 通过 HttpOnly Cookie 请求刷新访问令牌，使内存会话继续有效。
 *
 * @returns 通过 Cookie 刷新得到的新访问令牌。
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
 * 携带 Cookie 凭据通知后端结束当前登录会话。
 *
 * @returns 后端结束当前会话后的响应结果。
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
 * 从后端读取当前用户的权限码集合。
 *
 * @returns 当前用户拥有的权限码数组；无权限码时为空数组。
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/auth/codes');
}
