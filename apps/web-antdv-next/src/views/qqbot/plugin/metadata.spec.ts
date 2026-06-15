import { describe, expect, it, vi } from 'vitest';

import { loadQqbotPluginMetadata } from './metadata';

describe('qqbot plugin page metadata', () => {
  it('keeps plugin page metadata loading from rejecting when plugin list fails', async () => {
    const error = { code: 500, msg: 'plugin list failed' };
    const onError = vi.fn();

    await expect(
      loadQqbotPluginMetadata({
        labelOf: (value, fallback) => fallback ?? String(value),
        loadPlugins: () => Promise.reject(error),
        onError,
        reloadTriggerModes: () =>
          Promise.resolve([{ label: '命令', value: 'command' }]),
      }),
    ).resolves.toEqual({
      pluginMap: {},
      pluginOptions: [],
    });

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('builds plugin map and options after trigger mode dictionary is reloaded', async () => {
    const plugin = {
      description: 'BangDream commands',
      key: 'bangdream',
      name: 'BangDream',
      operationCount: 12,
      triggerMode: 'command',
      version: '1.0.0',
    } as const;

    await expect(
      loadQqbotPluginMetadata({
        labelOf: (value) => (value === 'command' ? '命令' : String(value)),
        loadPlugins: () => Promise.resolve([plugin]),
        reloadTriggerModes: () =>
          Promise.resolve([{ label: '命令', value: 'command' }]),
      }),
    ).resolves.toEqual({
      pluginMap: {
        bangdream: plugin,
      },
      pluginOptions: [
        {
          label: 'BangDream (bangdream / 命令)',
          value: 'bangdream',
        },
      ],
    });
  });
});
