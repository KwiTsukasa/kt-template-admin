import {
  createUser,
  deleteUser,
  getUserList,
  resetUserPassword,
  updateUser,
} from '@test-source/apps/web-antdv-next/src/api/system/user';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

vi.mock('#/api/request', () => ({
  requestClient: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('system user api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps create, edit, reset, list, and delete contracts separate', async () => {
    const createInput = {
      password: 'create-password',
      realName: '新用户',
      roleIds: [],
      username: 'new-user',
    };
    const updateInput = {
      realName: '新姓名',
    };

    await getUserList({ page: 1, pageSize: 20 });
    await createUser(createInput);
    await updateUser('1', updateInput);
    await resetUserPassword('1', { password: 'reset-password' });
    await deleteUser('1');

    expect(requestClient.get).toHaveBeenCalledWith('/system/user/list', {
      params: { page: 1, pageSize: 20 },
    });
    expect(requestClient.post).toHaveBeenCalledWith(
      '/system/user',
      createInput,
    );
    expect(requestClient.put).toHaveBeenNthCalledWith(
      1,
      '/system/user/1',
      updateInput,
    );
    expect(requestClient.put).toHaveBeenNthCalledWith(
      2,
      '/system/user/1/password',
      { password: 'reset-password' },
    );
    expect(requestClient.delete).toHaveBeenCalledWith('/system/user/1');
  });
});
