import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  createQqbotAccount,
  updateQqbotAccount,
} from '@test-source/apps/web-antdv-next/src/api/qqbot';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

vi.mock('#/api/request', () => ({
  requestClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const readApiFile = (name: string) =>
  readFileSync(resolve('apps/web-antdv-next/src/api/qqbot', name), 'utf8');

describe('qqbot core API caller boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps plugin platform and NapCat scan routes out of the core caller', () => {
    const source = readApiFile('index.ts');

    expect(source).not.toContain('/qqbot/plugin');
    expect(source).not.toContain('/qqbot/plugin-platform');
    expect(source).not.toContain('/qqbot/account/scan');
  });

  it('keeps domain-specific caller routes in plugin and napcat callers', () => {
    expect(readApiFile('plugin.ts')).toEqual(
      expect.stringContaining('/qqbot/plugin/operation/page'),
    );
    expect(readApiFile('plugin.ts')).toEqual(
      expect.stringContaining('/qqbot/plugin-platform/runtime-events'),
    );
    expect(readApiFile('napcat.ts')).toEqual(
      expect.stringContaining('/qqbot/account/scan/events'),
    );
  });

  it('submits non-empty login passwords directly for account create and update', async () => {
    vi.mocked(requestClient.post).mockResolvedValue(true);

    await createQqbotAccount({
      loginPassword: 'create-password',
      name: '新账号',
      selfId: '10001',
    });
    await updateQqbotAccount({
      id: 'account-1',
      loginPassword: 'update-password',
      selfId: '10001',
    });

    expect(requestClient.post).toHaveBeenNthCalledWith(
      1,
      '/qqbot/account/save',
      {
        loginPassword: 'create-password',
        name: '新账号',
        selfId: '10001',
      },
    );
    expect(requestClient.post).toHaveBeenNthCalledWith(
      2,
      '/qqbot/account/update',
      {
        id: 'account-1',
        loginPassword: 'update-password',
        selfId: '10001',
      },
    );
    expect(vi.mocked(requestClient.post).mock.calls).not.toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          expect.anything(),
          expect.objectContaining({
            encryptedLoginPassword: expect.anything(),
          }),
        ]),
      ]),
    );
  });

  it('omits undefined, null, and blank login passwords when editing', async () => {
    vi.mocked(requestClient.post).mockResolvedValue(true);

    await updateQqbotAccount({
      id: 'account-1',
      loginPassword: undefined,
      selfId: '10001',
    });
    await updateQqbotAccount({
      id: 'account-1',
      loginPassword: null,
      selfId: '10001',
    });
    await updateQqbotAccount({
      id: 'account-1',
      loginPassword: '   ',
      selfId: '10001',
    });

    expect(requestClient.post).toHaveBeenCalledTimes(3);
    vi.mocked(requestClient.post).mock.calls.forEach(([, body]) => {
      expect(body).toEqual({
        id: 'account-1',
        selfId: '10001',
      });
      expect(body).not.toHaveProperty('encryptedLoginPassword');
      expect(body).not.toHaveProperty('loginPassword');
    });
  });
});
