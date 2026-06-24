import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';

import {
  cancelQqbotAccountScan,
  createQqbotNapcatWebuiSession,
  getNapcatLoginProgressLabel,
  getNapcatNewDeviceStatusMessage,
  getQqbotAccountScanEventsUrl,
  getQqbotAccountScanStatus,
  getQqbotNapcatRuntimeDetail,
  heartbeatQqbotNapcatWebuiSession,
  mergeNapcatAccountScanResult,
  NAPCAT_LOGIN_PROGRESS_LABELS,
  refreshQqbotAccountScanQrcode,
  resolveNapcatLoginDisplayQrcode,
  revokeQqbotNapcatWebuiSession,
  startQqbotAccountScanCreate,
  startQqbotAccountScanRefresh,
  submitQqbotAccountScanCaptcha,
} from './napcat';

vi.mock('#/api/request', () => ({
  requestClient: {
    get: vi.fn(),
    getBaseUrl: vi.fn(() => '/api'),
    post: vi.fn(),
  },
}));

describe('napcat login display helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps all Chinese progress labels required by the login flow', () => {
    expect(NAPCAT_LOGIN_PROGRESS_LABELS).toMatchObject({
      'captcha-submit': '验证码已提交，等待确认',
      'login-failed': '登录失败',
      'login-success': '登录成功',
      'manual-qr-required': '正在生成手动二维码',
      'new-device-confirming': '新设备确认中',
      'new-device-qrcode-ready': '新设备二维码待扫码',
      'new-device-required': '需要新设备验证二维码',
      'new-device-scanned': '新设备二维码已扫码',
      'new-device-verified': '新设备验证成功，继续登录',
      'password-login': '正在密码登录',
      'password-login-captcha': '需要验证码',
      'password-login-captcha-submit': '验证码已提交，等待确认',
      'password-login-failed': '登录失败',
      'password-login-start': '正在密码登录',
      'quick-login-fallback': '快速登录失败，进入密码登录',
      'quick-login-start': '正在快速登录',
      'runtime-cleanup-failed': '运行态清理失败',
    });
  });

  it('shows new-device QR separately before normal login QR or captcha', () => {
    expect(
      resolveNapcatLoginDisplayQrcode({
        captchaUrl: 'https://captcha.qq.com/',
        newDeviceQrcode: 'data:image/png;base64,new-device',
        qrcode: 'normal-login-qrcode',
      }),
    ).toBe('data:image/png;base64,new-device');
    expect(getNapcatNewDeviceStatusMessage('scanned')).toBe(
      '新设备二维码已扫码',
    );
  });

  it('preserves pending captcha and new-device evidence when later polls omit URLs', () => {
    expect(
      mergeNapcatAccountScanResult(
        {
          captchaUrl: 'https://captcha.qq.com/proof',
          mode: 'refresh',
          sessionId: 'scan-1',
          status: 'pending',
        },
        {
          mode: 'refresh',
          sessionId: 'scan-1',
          status: 'pending',
        },
      ),
    ).toMatchObject({
      captchaUrl: 'https://captcha.qq.com/proof',
      status: 'pending',
    });

    expect(
      mergeNapcatAccountScanResult(
        {
          deviceVerifyUrl: 'https://ti.qq.com/device',
          mode: 'refresh',
          newDeviceQrcode: 'data:image/png;base64,new-device',
          newDeviceStatus: 'qr-pending',
          sessionId: 'scan-1',
          status: 'pending',
        },
        {
          mode: 'refresh',
          newDeviceStatus: 'scanned',
          sessionId: 'scan-1',
          status: 'pending',
        },
      ),
    ).toMatchObject({
      deviceVerifyUrl: 'https://ti.qq.com/device',
      newDeviceQrcode: 'data:image/png;base64,new-device',
      newDeviceStatus: 'scanned',
      status: 'pending',
    });
  });

  it('clears stale verification evidence when scan reaches a terminal state', () => {
    expect(
      mergeNapcatAccountScanResult(
        {
          captchaUrl: 'https://captcha.qq.com/proof',
          deviceVerifyUrl: 'https://ti.qq.com/device',
          mode: 'refresh',
          newDeviceQrcode: 'data:image/png;base64,new-device',
          newDeviceStatus: 'confirming',
          sessionId: 'scan-1',
          status: 'pending',
        },
        {
          mode: 'refresh',
          sessionId: 'scan-1',
          status: 'success',
        },
      ),
    ).toMatchObject({
      captchaUrl: undefined,
      deviceVerifyUrl: undefined,
      newDeviceQrcode: undefined,
      newDeviceStatus: undefined,
      status: 'success',
    });
  });

  it('keeps the complete new-device progress key set in caller helpers', () => {
    expect(
      Object.keys(NAPCAT_LOGIN_PROGRESS_LABELS)
        .filter((key) => key.startsWith('new-device-'))
        .toSorted(),
    ).toEqual([
      'new-device-confirming',
      'new-device-qrcode-ready',
      'new-device-required',
      'new-device-scanned',
      'new-device-verified',
    ]);
  });

  it('falls back to Chinese progress labels by SSE step key', () => {
    expect(
      getNapcatLoginProgressLabel({
        message: 'Need new device',
        step: 'new-device-required',
      }),
    ).toBe('需要新设备验证二维码');
    expect(
      getNapcatLoginProgressLabel({
        message: '',
        step: 'new-device-confirming',
      }),
    ).toBe('新设备确认中');
  });

  it('owns create, refresh, status, QR refresh, captcha, cancel, and SSE caller routes', async () => {
    const scanResult = {
      mode: 'refresh' as const,
      sessionId: 'scan-1',
      status: 'pending' as const,
    };
    vi.mocked(requestClient.post).mockResolvedValue(scanResult);
    vi.mocked(requestClient.get).mockResolvedValue(scanResult);

    await expect(startQqbotAccountScanCreate()).resolves.toBe(scanResult);
    await expect(startQqbotAccountScanRefresh('account-1')).resolves.toBe(
      scanResult,
    );
    await expect(getQqbotAccountScanStatus('scan-1')).resolves.toBe(scanResult);
    await expect(refreshQqbotAccountScanQrcode('scan-1')).resolves.toBe(
      scanResult,
    );
    await expect(
      submitQqbotAccountScanCaptcha({
        randstr: '@rand',
        sessionId: 'scan-1',
        ticket: 'ticket',
      }),
    ).resolves.toBe(scanResult);
    await expect(cancelQqbotAccountScan('scan-1')).resolves.toBe(scanResult);

    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/account/scan/create',
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/account/scan/refresh?id=account-1',
    );
    expect(requestClient.get).toHaveBeenCalledWith(
      '/qqbot/account/scan/status',
      { params: { sessionId: 'scan-1' } },
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/account/scan/qrcode/refresh?sessionId=scan-1',
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/account/scan/captcha/submit',
      {
        randstr: '@rand',
        sessionId: 'scan-1',
        ticket: 'ticket',
      },
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/account/scan/cancel?sessionId=scan-1',
    );
    expect(getQqbotAccountScanEventsUrl('scan 1')).toBe(
      '/api/qqbot/account/scan/events?sessionId=scan%201',
    );
  });

  it('builds the read-only NapCat runtime detail request', async () => {
    vi.mocked(requestClient.get).mockResolvedValue({});

    await getQqbotNapcatRuntimeDetail('account-1');

    expect(requestClient.get).toHaveBeenCalledWith(
      '/qqbot/napcat/runtime/detail',
      {
        params: { accountId: 'account-1' },
      },
    );
  });

  it('owns NapCat WebUI gateway session caller routes', async () => {
    const sessionResult = {
      account: {
        id: 'account-1',
        name: 'preview',
        selfId: '10001',
      },
      container: {
        id: 'container-1',
        name: 'kt-qqbot-napcat-10001',
        webuiStatus: 'online' as const,
      },
      expiresAt: 1_782_000_000,
      iframeUrl: '/qqbot/napcat/webui/session/session-1/',
      sessionId: 'session-1',
    };
    const lifecycleResult = {
      sessionId: 'session-1',
      status: 'active' as const,
    };
    vi.mocked(requestClient.post)
      .mockResolvedValueOnce(sessionResult)
      .mockResolvedValueOnce(lifecycleResult)
      .mockResolvedValueOnce({ ...lifecycleResult, status: 'revoked' });

    await expect(
      createQqbotNapcatWebuiSession({ accountId: 'account-1' }),
    ).resolves.toBe(sessionResult);
    await expect(heartbeatQqbotNapcatWebuiSession('session-1')).resolves.toBe(
      lifecycleResult,
    );
    await expect(revokeQqbotNapcatWebuiSession('session-1')).resolves.toEqual({
      sessionId: 'session-1',
      status: 'revoked',
    });

    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/napcat/webui/session',
      { accountId: 'account-1' },
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/napcat/webui/session/session-1/heartbeat',
    );
    expect(requestClient.post).toHaveBeenCalledWith(
      '/qqbot/napcat/webui/session/session-1/revoke',
    );
  });
});
