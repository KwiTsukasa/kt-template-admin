import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    username?: string;
  }

  export interface LoginRequest {
    encryptedPassword?: string;
    username?: string;
  }

  /** 登录接口返回值 */
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

  export interface PasswordPublicKeyResult {
    algorithm: 'RSA-OAEP';
    hash: 'SHA-256';
    publicKey: string;
  }
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replaceAll('-----BEGIN PUBLIC KEY-----', '')
    .replaceAll('-----END PUBLIC KEY-----', '')
    .replaceAll(/\s/g, '');
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index) || 0;
  }

  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCodePoint(byte);
  });

  return window.btoa(binary);
}

async function encryptPassword(password: string) {
  const { hash, publicKey } = await getPasswordPublicKeyApi();
  const cryptoKey = await window.crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(publicKey),
    {
      hash,
      name: 'RSA-OAEP',
    },
    false,
    ['encrypt'],
  );
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    cryptoKey,
    new TextEncoder().encode(password),
  );

  return arrayBufferToBase64(encrypted);
}

async function buildLoginRequest(data: AuthApi.LoginParams) {
  return {
    encryptedPassword: await encryptPassword(data.password || ''),
    username: data.username,
  } satisfies AuthApi.LoginRequest;
}

/**
 * 获取登录密码加密公钥
 */
export async function getPasswordPublicKeyApi() {
  return requestClient.get<AuthApi.PasswordPublicKeyResult>(
    '/auth/password-public-key',
  );
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>(
    '/auth/login',
    await buildLoginRequest(data),
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
