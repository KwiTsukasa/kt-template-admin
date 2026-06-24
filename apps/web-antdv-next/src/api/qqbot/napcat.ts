import { requestClient } from '#/api/request';

export type NapcatLoginNewDeviceStatus =
  | 'confirming'
  | 'expired'
  | 'failed'
  | 'qr-pending'
  | 'scanned'
  | 'verified';

export namespace QqbotNapcatApi {
  export interface RuntimeProfileDetail {
    accountId: string;
    inspectionTimeoutMs?: number;
    loginEvents?: Array<{
      createTime?: string;
      eventKind: string;
      eventSource: string;
      eventStatus: string;
    }>;
    protocolProfile?: Record<string, unknown>;
    riskMode?: Record<string, unknown>;
    runtimeProfile?: Record<string, unknown>;
    sessionBehaviorProfile?: Record<string, unknown>;
  }

  export interface WebuiGatewaySessionAccount {
    id: string;
    name: string;
    selfId: string;
  }

  export interface WebuiGatewaySessionContainer {
    webuiStatus: 'offline' | 'online' | 'unknown';
  }

  export interface WebuiGatewaySession {
    account: WebuiGatewaySessionAccount;
    container: WebuiGatewaySessionContainer;
    expiresAt: number;
    iframeUrl: string;
    sessionId: string;
  }

  export interface WebuiGatewaySessionCreateBody {
    accountId: string;
  }

  export interface WebuiGatewayLifecycleResult {
    expiresAt?: number;
    sessionId: string;
    status: 'active' | 'revoked';
  }

  export interface AccountScanResult {
    accountId?: string;
    captchaUrl?: string;
    containerId?: string;
    containerName?: string;
    deviceVerifyUrl?: string;
    errorMessage?: string;
    expiresAt?: number;
    mode: 'create' | 'refresh';
    newDeviceQrcode?: string;
    newDeviceStatus?: NapcatLoginNewDeviceStatus;
    qrcode?: string;
    selfId?: string;
    sessionId?: string;
    status: 'error' | 'expired' | 'pending' | 'success';
    webuiPort?: null | number;
  }

  export interface AccountScanEvent {
    createdAt: number;
    message: string;
    result?: AccountScanResult;
    status: 'error' | 'info' | 'processing' | 'success';
    step: string;
  }

  export interface AccountScanCaptchaBody {
    randstr: string;
    sessionId: string;
    sid?: string;
    ticket: string;
  }
}

export type NapcatLoginDisplayQrcodeSource = {
  captchaUrl?: string;
  newDeviceQrcode?: string;
  qrcode?: string;
};

export type NapcatLoginScanStateSnapshot = Partial<
  Pick<
    QqbotNapcatApi.AccountScanResult,
    | 'captchaUrl'
    | 'deviceVerifyUrl'
    | 'newDeviceQrcode'
    | 'newDeviceStatus'
    | 'qrcode'
  >
> & {
  mode: QqbotNapcatApi.AccountScanResult['mode'];
  sessionId?: string;
  status: 'idle' | QqbotNapcatApi.AccountScanResult['status'];
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

export function mergeNapcatAccountScanResult(
  current: NapcatLoginScanStateSnapshot,
  result: QqbotNapcatApi.AccountScanResult,
): QqbotNapcatApi.AccountScanResult {
  if (result.status !== 'pending') {
    return {
      ...result,
      captchaUrl: result.captchaUrl,
      deviceVerifyUrl: result.deviceVerifyUrl,
      newDeviceQrcode: result.newDeviceQrcode,
      newDeviceStatus: result.newDeviceStatus,
    };
  }

  const hasCaptcha = !!result.captchaUrl;
  const hasNewDevice =
    !!result.newDeviceQrcode ||
    !!result.newDeviceStatus ||
    !!result.deviceVerifyUrl;

  return {
    ...result,
    captchaUrl: hasNewDevice
      ? undefined
      : result.captchaUrl || current.captchaUrl,
    deviceVerifyUrl: hasCaptcha
      ? undefined
      : result.deviceVerifyUrl || current.deviceVerifyUrl,
    newDeviceQrcode: hasCaptcha
      ? undefined
      : result.newDeviceQrcode || current.newDeviceQrcode,
    newDeviceStatus: hasCaptcha
      ? undefined
      : result.newDeviceStatus || current.newDeviceStatus,
  };
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

export function getNapcatLoginProgressLabel(
  event: Pick<QqbotNapcatApi.AccountScanEvent, 'message' | 'step'>,
) {
  const label =
    NAPCAT_LOGIN_PROGRESS_LABELS[
      event.step as keyof typeof NAPCAT_LOGIN_PROGRESS_LABELS
    ];
  return label || event.message || event.step || '登录处理中';
}

export function startQqbotAccountScanCreate() {
  return requestClient.post<QqbotNapcatApi.AccountScanResult>(
    '/qqbot/account/scan/create',
  );
}

export function startQqbotAccountScanRefresh(id: string) {
  return requestClient.post<QqbotNapcatApi.AccountScanResult>(
    `/qqbot/account/scan/refresh?id=${id}`,
  );
}

export function getQqbotAccountScanStatus(sessionId: string) {
  return requestClient.get<QqbotNapcatApi.AccountScanResult>(
    '/qqbot/account/scan/status',
    { params: { sessionId } },
  );
}

export function refreshQqbotAccountScanQrcode(sessionId: string) {
  return requestClient.post<QqbotNapcatApi.AccountScanResult>(
    `/qqbot/account/scan/qrcode/refresh?sessionId=${sessionId}`,
  );
}

export function submitQqbotAccountScanCaptcha(
  data: QqbotNapcatApi.AccountScanCaptchaBody,
) {
  return requestClient.post<QqbotNapcatApi.AccountScanResult>(
    '/qqbot/account/scan/captcha/submit',
    data,
  );
}

export function cancelQqbotAccountScan(sessionId: string) {
  return requestClient.post<boolean>(
    `/qqbot/account/scan/cancel?sessionId=${sessionId}`,
  );
}

export function getQqbotAccountScanEventsUrl(sessionId: string) {
  return buildApiUrl(
    `/qqbot/account/scan/events?sessionId=${encodeURIComponent(sessionId)}`,
  );
}

export function getQqbotNapcatRuntimeDetail(accountId: string) {
  return requestClient.get<QqbotNapcatApi.RuntimeProfileDetail>(
    '/qqbot/napcat/runtime/detail',
    {
      params: { accountId },
    },
  );
}

/**
 * Creates a short-lived gateway session for opening one account's NapCat WebUI.
 */
export function createQqbotNapcatWebuiSession(
  data: QqbotNapcatApi.WebuiGatewaySessionCreateBody,
) {
  return requestClient.post<QqbotNapcatApi.WebuiGatewaySession>(
    '/qqbot/napcat/webui/session',
    data,
  );
}

/**
 * Extends an active NapCat WebUI gateway session while the page is alive.
 */
export function heartbeatQqbotNapcatWebuiSession(sessionId: string) {
  return requestClient.post<QqbotNapcatApi.WebuiGatewayLifecycleResult>(
    `/qqbot/napcat/webui/session/${sessionId}/heartbeat`,
  );
}

/**
 * Revokes a NapCat WebUI gateway session when the page leaves the WebUI view.
 */
export function revokeQqbotNapcatWebuiSession(sessionId: string) {
  return requestClient.post<QqbotNapcatApi.WebuiGatewayLifecycleResult>(
    `/qqbot/napcat/webui/session/${sessionId}/revoke`,
  );
}

function buildApiUrl(path: string) {
  const baseUrl = requestClient.getBaseUrl() || '';
  if (!baseUrl) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (/^https?:\/\//i.test(baseUrl)) {
    return new URL(path, baseUrl).toString();
  }
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
