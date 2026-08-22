import { refreshAccessCodes } from '@test-source/apps/web-antdv-next/src/router/access-codes';
import { describe, expect, it, vi } from 'vitest';

describe('router access code refresh', () => {
  it('overwrites persisted access codes with the latest backend codes', async () => {
    const setAccessCodes = vi.fn();
    const loadAccessCodes = vi
      .fn()
      .mockResolvedValue(['Bot:Command:Test', 'Bot:Account:RefreshLogin']);

    await expect(
      refreshAccessCodes({
        loadAccessCodes,
        setAccessCodes,
      }),
    ).resolves.toEqual(['Bot:Command:Test', 'Bot:Account:RefreshLogin']);

    expect(loadAccessCodes).toHaveBeenCalledOnce();
    expect(setAccessCodes).toHaveBeenCalledWith([
      'Bot:Command:Test',
      'Bot:Account:RefreshLogin',
    ]);
  });
});
