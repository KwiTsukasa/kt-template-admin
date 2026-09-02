import { useAccessStore, useUserStore } from '@vben/stores';

import { useAuthStore } from '@test-source/apps/web-antdv-next/src/store/auth';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  getAccessCodesApi: vi.fn(),
  getUserInfoApi: vi.fn(),
  loginApi: vi.fn(),
  logoutApi: vi.fn(),
  refreshTokenApi: vi.fn(),
}));
const requestMocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('#/api', () => apiMocks);
vi.mock('#/api/request', () => ({
  baseRequestClient: requestMocks,
}));
vi.mock('#/locales', () => ({
  $t: (key: string) => key,
}));
vi.mock('antdv-next', () => ({
  notification: {
    success: vi.fn(),
  },
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute: {
      value: {
        query: {},
      },
    },
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe('admin auth SSO restoration', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('passes login form parameters through without persisting the password', async () => {
    const loginSecret = ['admin', 'password'].join('-');
    const credentials = {
      password: loginSecret,
      username: 'admin',
    };
    apiMocks.loginApi.mockResolvedValue({
      accessToken: '',
    });

    await useAuthStore().authLogin(credentials);

    expect(apiMocks.loginApi).toHaveBeenCalledWith(credentials);
    const persistedValues = Array.from(
      { length: localStorage.length },
      (_, index) => localStorage.key(index),
    )
      .filter((key): key is string => key !== null)
      .map((key) => localStorage.getItem(key));
    expect(JSON.stringify(persistedValues)).not.toContain(credentials.password);
  });

  it('validates an existing access token before allowing an SSO redirect', async () => {
    const accessStore = useAccessStore();
    accessStore.setAccessToken('existing-access-token');
    requestMocks.get.mockResolvedValue({
      data: {
        code: 200,
        data: {
          avatar: '',
          realName: 'current user',
          userId: '1',
          username: 'current',
        },
      },
      status: 200,
    });

    const restored = await useAuthStore().ensureValidSsoSession();

    expect(restored).toBe(true);
    expect(accessStore.accessToken).toBe('existing-access-token');
    expect(requestMocks.get).toHaveBeenCalledWith('/user/info', {
      headers: {
        Authorization: 'Bearer existing-access-token',
      },
    });
    expect(apiMocks.refreshTokenApi).not.toHaveBeenCalled();
  });

  it('refreshes and revalidates a rejected existing access token', async () => {
    const accessStore = useAccessStore();
    accessStore.setAccessToken('expired-access-token');
    requestMocks.get
      .mockRejectedValueOnce(new Error('Unauthorized'))
      .mockResolvedValueOnce({
        data: {
          code: 200,
          data: {
            avatar: '',
            realName: 'refreshed user',
            userId: '1',
            username: 'refreshed',
          },
        },
        status: 200,
      });
    apiMocks.refreshTokenApi.mockResolvedValue({
      data: 'fresh-access-token',
      status: 200,
    });

    const restored = await useAuthStore().ensureValidSsoSession();

    expect(restored).toBe(true);
    expect(accessStore.accessToken).toBe('fresh-access-token');
    expect(requestMocks.get).toHaveBeenCalledTimes(2);
    expect(requestMocks.get).toHaveBeenLastCalledWith('/user/info', {
      headers: {
        Authorization: 'Bearer fresh-access-token',
      },
    });
  });

  it('rejects an SSO redirect when the refreshed access token also fails validation', async () => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    accessStore.setAccessToken('expired-access-token');
    accessStore.setAccessCodes(['Blog:Article:List']);
    userStore.setUserInfo({
      avatar: '',
      realName: 'stale user',
      userId: '1',
      username: 'stale',
    });
    requestMocks.get.mockRejectedValue(new Error('Unauthorized'));
    apiMocks.refreshTokenApi.mockResolvedValue({
      data: 'rejected-refreshed-token',
      status: 200,
    });

    const restored = await useAuthStore().ensureValidSsoSession();

    expect(restored).toBe(false);
    expect(requestMocks.get).toHaveBeenCalledTimes(2);
    expect(accessStore.accessToken).toBeNull();
    expect(accessStore.accessCodes).toEqual([]);
    expect(userStore.userInfo).toBeNull();
  });

  it('restores an access token from the Admin-origin HttpOnly refresh cookie', async () => {
    apiMocks.refreshTokenApi.mockResolvedValue({
      data: 'fresh-access-token',
      status: 200,
    });
    requestMocks.get.mockResolvedValue({
      data: {
        code: 200,
        data: {
          avatar: '',
          realName: 'restored user',
          userId: '1',
          username: 'restored',
        },
      },
      status: 200,
    });

    const restored = await useAuthStore().ensureValidSsoSession();

    expect(restored).toBe(true);
    expect(useAccessStore().accessToken).toBe('fresh-access-token');
    expect(apiMocks.refreshTokenApi).toHaveBeenCalledTimes(1);
    expect(requestMocks.get).toHaveBeenCalledTimes(1);
  });

  it('clears stale client state and falls back when the refresh cookie is invalid', async () => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    accessStore.setAccessCodes(['Blog:Article:List']);
    userStore.setUserInfo({
      avatar: '',
      realName: 'stale user',
      userId: '1',
      username: 'stale',
    });
    apiMocks.refreshTokenApi.mockRejectedValue(new Error('Forbidden'));

    const restored = await useAuthStore().ensureValidSsoSession();

    expect(restored).toBe(false);
    expect(accessStore.accessToken).toBeNull();
    expect(accessStore.accessCodes).toEqual([]);
    expect(userStore.userInfo).toBeNull();
  });
});
