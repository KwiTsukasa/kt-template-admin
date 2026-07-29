import { loginApi } from '@test-source/apps/web-antdv-next/src/api/core/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

vi.mock('#/api/request', () => ({
  baseRequestClient: {
    post: vi.fn(),
  },
  requestClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('core auth api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the login credentials directly with cookies and without a public-key request', async () => {
    const loginSecret = ['admin', 'password'].join('-');
    const tokenFixture = ['access', 'token'].join('-');
    const credentials = {
      password: loginSecret,
      username: 'admin',
    };
    const formParams = {
      ...credentials,
      captcha: true,
    };
    vi.mocked(requestClient.post).mockResolvedValue({
      accessToken: tokenFixture,
    });

    await loginApi(formParams);

    expect(requestClient.get).not.toHaveBeenCalled();
    expect(requestClient.post).toHaveBeenCalledWith(
      '/auth/login',
      credentials,
      {
        withCredentials: true,
      },
    );
  });
});
