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

vi.mock('#/api', () => apiMocks);
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

  it('restores an access token from the Admin-origin HttpOnly refresh cookie', async () => {
    apiMocks.refreshTokenApi.mockResolvedValue({
      data: 'fresh-access-token',
      status: 200,
    });

    const restored = await useAuthStore().restoreSessionFromCookie();

    expect(restored).toBe(true);
    expect(useAccessStore().accessToken).toBe('fresh-access-token');
    expect(apiMocks.refreshTokenApi).toHaveBeenCalledTimes(1);
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

    const restored = await useAuthStore().restoreSessionFromCookie();

    expect(restored).toBe(false);
    expect(accessStore.accessToken).toBeNull();
    expect(accessStore.accessCodes).toEqual([]);
    expect(userStore.userInfo).toBeNull();
  });
});
