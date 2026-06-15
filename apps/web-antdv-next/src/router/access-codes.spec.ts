import { describe, expect, it, vi } from 'vitest';

import { refreshAccessCodes } from './access-codes';

describe('router access code refresh', () => {
  it('overwrites persisted access codes with the latest backend codes', async () => {
    const setAccessCodes = vi.fn();
    const loadAccessCodes = vi
      .fn()
      .mockResolvedValue(['QqBot:Command:Test', 'QqBot:Account:RefreshLogin']);

    await expect(
      refreshAccessCodes({
        loadAccessCodes,
        setAccessCodes,
      }),
    ).resolves.toEqual(['QqBot:Command:Test', 'QqBot:Account:RefreshLogin']);

    expect(loadAccessCodes).toHaveBeenCalledOnce();
    expect(setAccessCodes).toHaveBeenCalledWith([
      'QqBot:Command:Test',
      'QqBot:Account:RefreshLogin',
    ]);
  });
});
