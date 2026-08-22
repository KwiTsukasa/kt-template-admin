import { requestClient } from '#/api/request';

export type NapcatLoginNewDeviceStatus =
  | 'confirming'
  | 'expired'
  | 'failed'
  | 'qr-pending'
  | 'scanned'
  | 'verified';

export namespace BotNapcatApi {
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
    BotNapcatApi.AccountScanResult,
    | 'captchaUrl'
    | 'deviceVerifyUrl'
    | 'newDeviceQrcode'
    | 'newDeviceStatus'
    | 'qrcode'
  >
> & {
  mode: BotNapcatApi.AccountScanResult['mode'];
  sessionId?: string;
  status: 'idle' | BotNapcatApi.AccountScanResult['status'];
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

/**
 * 优先展示新设备验证二维码，其次使用普通登录二维码，均缺失时返回空字符串。
 *
 * @param source - 可能同时包含新设备二维码与普通登录二维码的扫描结果片段。
 * @returns 新设备验证二维码、普通登录二维码或空字符串，优先级依次递减。
 */
export function resolveNapcatLoginDisplayQrcode(
  source: NapcatLoginDisplayQrcodeSource,
) {
  return source.newDeviceQrcode || source.qrcode || '';
}

/**
 * 合并 NapCat 扫码新旧状态，仅用新响应中的有效字段覆盖当前会话。
 *
 * @param current - 合并前保留的当前状态或现有记录。
 * @param result - 包含新扫码字段、用于覆盖当前会话状态的后端结果。
 * @returns 以新结果有效字段覆盖旧值后的扫码状态；没有旧值时直接返回新结果。
 */
export function mergeNapcatAccountScanResult(
  current: NapcatLoginScanStateSnapshot,
  result: BotNapcatApi.AccountScanResult,
): BotNapcatApi.AccountScanResult {
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
    captchaUrl: (() => {
      if (hasNewDevice) {
        return undefined;
      }
      return result.captchaUrl || current.captchaUrl;
    })(),
    deviceVerifyUrl: (() => {
      if (hasCaptcha) {
        return undefined;
      }
      return result.deviceVerifyUrl || current.deviceVerifyUrl;
    })(),
    newDeviceQrcode: (() => {
      if (hasCaptcha) {
        return undefined;
      }
      return result.newDeviceQrcode || current.newDeviceQrcode;
    })(),
    newDeviceStatus: (() => {
      if (hasCaptcha) {
        return undefined;
      }
      return result.newDeviceStatus || current.newDeviceStatus;
    })(),
  };
}

/**
 * 把新设备验证状态映射为扫码、确认、成功、过期或失败提示。
 *
 * @param status - NapCat 新设备验证阶段；缺省或 qr-pending 均显示待扫码。
 * @returns 与新设备验证阶段对应的中文提示；缺省或未单列阶段显示待扫码。
 */
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

/**
 * 把 NapCat 登录事件映射为用户可读进度文本，未知事件显示通用等待说明。
 *
 * @param event - 需要映射为登录进度标签的 NapCat 扫码事件。
 * @returns 步骤表中的中文进度标签；未知步骤依次回退到事件消息、步骤名和通用等待文本。
 */
export function getNapcatLoginProgressLabel(
  event: Pick<BotNapcatApi.AccountScanEvent, 'message' | 'step'>,
) {
  const label =
    NAPCAT_LOGIN_PROGRESS_LABELS[
      event.step as keyof typeof NAPCAT_LOGIN_PROGRESS_LABELS
    ];
  return label || event.message || event.step || '登录处理中';
}

/**
 * 启动创建账号的 NapCat 扫码会话，并返回首个二维码与会话状态。
 *
 * @returns 新建账号扫描会话的标识、二维码、模式、状态和可选过期时间。
 */
export function startBotAccountScanCreate() {
  return requestClient.post<BotNapcatApi.AccountScanResult>(
    '/bot-adapter/napcat/account/scan/create',
  );
}

/**
 * 为现有账号启动 NapCat 重新登录扫码，并返回二维码与会话状态。
 *
 * @param id - 需要刷新现有登录状态的 Bot 账号记录标识。
 * @returns 现有账号重新登录会话的标识、二维码、模式、状态和可选过期时间。
 */
export function startBotAccountScanRefresh(id: string) {
  return requestClient.post<BotNapcatApi.AccountScanResult>(
    `/bot-adapter/napcat/account/scan/refresh?id=${id}`,
  );
}

/**
 * 根据会话标识读取 NapCat 扫码、验证码或新设备验证的最新进度。
 *
 * @param sessionId - 目标扫码或 WebUI 会话的唯一标识。
 * @returns 扫码会话最新的二维码、验证步骤、过期时间、状态及可选错误信息。
 */
export function getBotAccountScanStatus(sessionId: string) {
  return requestClient.get<BotNapcatApi.AccountScanResult>(
    '/bot-adapter/napcat/account/scan/status',
    { params: { sessionId } },
  );
}

/**
 * 请求后端刷新指定扫码会话的二维码，并返回该会话最新登录进度。
 *
 * @param sessionId - 目标扫码或 WebUI 会话的唯一标识。
 * @returns 后端返回的扫码会话最新二维码与登录进度。
 */
export function refreshBotAccountScanQrcode(sessionId: string) {
  return requestClient.post<BotNapcatApi.AccountScanResult>(
    `/bot-adapter/napcat/account/scan/qrcode/refresh?sessionId=${sessionId}`,
  );
}

/**
 * 向当前扫码会话提交图形验证码答案，并返回后端推进后的登录状态。
 *
 * @param data - 当前扫描会话标识及腾讯验证码 ticket、randstr 和可选 sid。
 * @returns 验证码提交后扫码会话的最新状态。
 */
export function submitBotAccountScanCaptcha(
  data: BotNapcatApi.AccountScanCaptchaBody,
) {
  return requestClient.post<BotNapcatApi.AccountScanResult>(
    '/bot-adapter/napcat/account/scan/captcha/submit',
    data,
  );
}

/**
 * 取消指定 NapCat 扫码会话，并返回后端是否完成清理。
 *
 * @param sessionId - 目标扫码或 WebUI 会话的唯一标识。
 * @returns 后端成功取消并清理扫码会话时为 true，否则为 false。
 */
export function cancelBotAccountScan(sessionId: string) {
  return requestClient.post<boolean>(
    `/bot-adapter/napcat/account/scan/cancel?sessionId=${sessionId}`,
  );
}

/**
 * 把扫码会话标识编码进 NapCat 登录事件流地址。
 *
 * @param sessionId - 目标扫码或 WebUI 会话的唯一标识。
 * @returns 包含 URL 编码会话标识、可直接建立 SSE 连接的登录事件地址。
 */
export function getBotAccountScanEventsUrl(sessionId: string) {
  return buildApiUrl(
    `/bot-adapter/napcat/account/scan/events?sessionId=${encodeURIComponent(sessionId)}`,
  );
}

/**
 * 从后端读取账号的 NapCat 协议、风险、会话行为配置及近期登录事件。
 *
 * @param accountId - 用于查询运行态或创建 WebUI 会话的 Bot 账号唯一标识。
 * @returns 账号当前协议、风险、运行与会话行为配置及近期登录事件。
 */
export function getBotNapcatRuntimeDetail(accountId: string) {
  return requestClient.get<BotNapcatApi.RuntimeProfileDetail>(
    '/bot-adapter/napcat/runtime/detail',
    {
      params: { accountId },
    },
  );
}

/**
 * 为 Bot 账号创建限时 NapCat WebUI 网关会话，并返回 iframe 地址与有效期。
 *
 * @param data - 需要打开 NapCat WebUI 网关的 Bot 账号记录标识。
 * @returns 限时 WebUI 网关会话的标识、iframe 地址、有效期及账号和容器状态。
 */
export function createBotNapcatWebuiSession(
  data: BotNapcatApi.WebuiGatewaySessionCreateBody,
) {
  return requestClient.post<BotNapcatApi.WebuiGatewaySession>(
    '/bot-adapter/napcat/webui/session',
    data,
  );
}

/**
 * 续期 NapCat WebUI 网关会话，并返回会话标识、状态与新有效期。
 *
 * @param sessionId - 目标扫码或 WebUI 会话的唯一标识。
 * @returns 续期后的会话标识、active 状态及可选新有效期。
 */
export function heartbeatBotNapcatWebuiSession(sessionId: string) {
  return requestClient.post<BotNapcatApi.WebuiGatewayLifecycleResult>(
    `/bot-adapter/napcat/webui/session/${sessionId}/heartbeat`,
  );
}

/**
 * 撤销 NapCat WebUI 网关会话，并返回已撤销状态。
 *
 * @param sessionId - 目标扫码或 WebUI 会话的唯一标识。
 * @returns 已撤销的会话标识、revoked 状态及可选有效期。
 */
export function revokeBotNapcatWebuiSession(sessionId: string) {
  return requestClient.post<BotNapcatApi.WebuiGatewayLifecycleResult>(
    `/bot-adapter/napcat/webui/session/${sessionId}/revoke`,
  );
}

/**
 * 基于当前管理端 API 根路径拼接相对地址，避免部署子路径丢失。
 *
 * @param path - 要拼接到管理端 API 根地址后的相对路径。
 * @returns 包含部署基础路径的完整 API 地址。
 */
function buildApiUrl(path: string) {
  const baseUrl = requestClient.getBaseUrl() || '';
  if (!baseUrl) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (/^https?:\/\//i.test(baseUrl)) {
    return new URL(path, baseUrl).toString();
  }
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
