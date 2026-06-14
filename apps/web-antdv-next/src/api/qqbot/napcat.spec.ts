import { describe, expect, it } from 'vitest';

import {
  getNapcatNewDeviceStatusMessage,
  NAPCAT_LOGIN_PROGRESS_LABELS,
  resolveNapcatLoginDisplayQrcode,
} from './napcat';

describe('napcat login display helpers', () => {
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
});
