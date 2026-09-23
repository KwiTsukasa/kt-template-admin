import type { BotApi } from '#/api/bot';

import { getAccountRuntimeSummary } from '@test-source/apps/web-antdv-next/src/views/bot/account/napcat/runtime-summary';
import { describe, expect, it } from 'vitest';

/**
 * 为状态表提供同时在线的 NapCat 基线，单个用例只覆盖自己关心的差异。
 * @returns 不含秘密的账号连接事实。
 */
function connectedAccount(): BotApi.Account {
  return {
    connectStatus: 'online',
    connectionMode: 'reverse-ws',
    enabled: true,
    id: 'A',
    name: 'A',
    napcat: {
      containerStatus: 'running',
      oneBotOnline: true,
      qqLoginStatus: 'online',
    },
    selfId: '10001',
  };
}

describe('napcat account runtime summary', () => {
  it.each([
    ['unknown', 'QQ 登录状态未知，OneBot 在线'],
    ['offline', 'QQ 离线，OneBot 在线'],
    ['qrcode_expired', '二维码已过期，点击更新登录'],
    ['qrcode_pending', '等待扫码登录'],
  ] as const)(
    'does not call a %s QQ login connected',
    (qqLoginStatus, expected) => {
      const row = connectedAccount();
      row.qqLoginStatus = qqLoginStatus;
      expect(getAccountRuntimeSummary(row)).toMatchObject({
        level: 'warning',
        text: expected,
      });
    },
  );

  it('keeps OneBot offline and disabled or stopped containers distinct', () => {
    const row = connectedAccount();
    row.oneBotStatus = 'offline';
    expect(getAccountRuntimeSummary(row).text).toBe(
      'QQ 在线，等待 OneBot 连接',
    );
    row.enabled = false;
    expect(getAccountRuntimeSummary(row).text).toBe('账号已停用');
    row.enabled = true;
    row.containerStatus = 'stopped';
    expect(getAccountRuntimeSummary(row).text).toBe('容器已停止');
    row.containerStatus = 'error';
    expect(getAccountRuntimeSummary(row).text).toBe('容器异常');
  });

  it('separates historical errors from both declared online states', () => {
    const row = connectedAccount();
    row.lastError = '网络连接异常!';
    row.napcat = { ...row.napcat, lastError: '另一条旧记录' };
    expect(getAccountRuntimeSummary(row)).toEqual({
      level: 'normal',
      recentErrors: ['网络连接异常!', '另一条旧记录'],
      text: 'QQ 与 OneBot 已连接',
    });
  });

  it('uses the backend OneBot connectStatus fallback but still requires QQ online', () => {
    const row = connectedAccount();
    row.napcat = { ...row.napcat, oneBotOnline: undefined };
    expect(getAccountRuntimeSummary(row).text).toBe('QQ 与 OneBot 已连接');
    row.qqLoginStatus = 'unknown';
    expect(getAccountRuntimeSummary(row)).toMatchObject({
      level: 'warning',
      text: 'QQ 登录状态未知，OneBot 在线',
    });
  });

  it('does not infer a running container from connected QQ and OneBot alone', () => {
    const row = connectedAccount();
    row.napcat = { ...row.napcat, containerStatus: undefined };
    expect(getAccountRuntimeSummary(row)).toMatchObject({
      level: 'warning',
      text: 'QQ 与 OneBot 已连接，容器状态未确认',
    });
  });

  it('reports an explicit container error even without a nested NapCat record', () => {
    const row = connectedAccount();
    row.napcat = null;
    row.containerStatus = 'error';
    expect(getAccountRuntimeSummary(row).text).toBe('容器异常');
  });

  it('keeps unrecognized server statuses out of the connected branch', () => {
    const row = connectedAccount();
    row.qqLoginStatus = 'unexpected' as BotApi.QqLoginStatus;
    row.napcat = {
      ...row.napcat,
      containerStatus:
        'toString' as BotApi.AccountNapcatRuntime['containerStatus'],
    };
    expect(getAccountRuntimeSummary(row)).toMatchObject({
      level: 'warning',
      text: 'QQ 登录状态未知',
    });
  });

  it('uses the official connection without requiring a NapCat QQ status', () => {
    const row = connectedAccount();
    row.connectionMode = 'official-websocket';
    row.napcat = null;
    expect(getAccountRuntimeSummary(row)).toMatchObject({
      level: 'normal',
      text: '连接在线',
    });
  });
});
