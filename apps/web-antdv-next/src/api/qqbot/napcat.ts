export type NapcatLoginNewDeviceStatus =
  | 'confirming'
  | 'expired'
  | 'failed'
  | 'qr-pending'
  | 'scanned'
  | 'verified';

export type NapcatLoginDisplayQrcodeSource = {
  captchaUrl?: string;
  newDeviceQrcode?: string;
  qrcode?: string;
};

export const NAPCAT_LOGIN_PROGRESS_LABELS = {
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
} as const;

export function resolveNapcatLoginDisplayQrcode(
  source: NapcatLoginDisplayQrcodeSource,
) {
  return source.newDeviceQrcode || source.qrcode || '';
}

export function getNapcatNewDeviceStatusMessage(
  status?: NapcatLoginNewDeviceStatus,
) {
  if (status === 'scanned') return '新设备二维码已扫码';
  if (status === 'confirming') return '新设备确认中';
  if (status === 'verified') return '新设备验证成功，继续登录';
  if (status === 'expired') return '新设备二维码已过期';
  if (status === 'failed') return '新设备验证失败';
  return '新设备二维码待扫码';
}
