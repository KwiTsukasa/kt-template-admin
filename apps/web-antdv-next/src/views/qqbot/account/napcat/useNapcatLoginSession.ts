import type { QqbotApi } from '#/api/qqbot';
import type {
  NapcatLoginNewDeviceStatus,
  QqbotNapcatApi,
} from '#/api/qqbot/napcat';

import { computed, onBeforeUnmount, reactive, ref } from 'vue';

import { useQRCode } from '@vueuse/integrations/useQRCode';
import { message } from 'antdv-next';

import {
  cancelQqbotAccountScan,
  getNapcatLoginProgressLabel,
  getNapcatNewDeviceStatusMessage,
  getQqbotAccountScanEventsUrl,
  getQqbotAccountScanStatus,
  mergeNapcatAccountScanResult,
  refreshQqbotAccountScanQrcode,
  resolveNapcatLoginDisplayQrcode,
  startQqbotAccountScanCreate,
  startQqbotAccountScanRefresh,
  submitQqbotAccountScanCaptcha,
} from '#/api/qqbot/napcat';

import {
  formatEventTime,
  getScanStepStatus,
  isQrcodeImageCandidate,
  normalizeQrcodeImageSrc,
} from './qrcode';
import { requestTencentCaptcha } from './tencentCaptcha';

type NapcatLoginSessionOptions = {
  closeModal: () => Promise<unknown> | unknown;
  onSuccess?: () => Promise<unknown> | unknown;
  openModal: (title: string) => void;
};

export type NapcatLoginScanState = {
  captchaUrl?: string;
  containerId?: string;
  containerName?: string;
  deviceVerifyUrl?: string;
  errorMessage?: string;
  expiresAt?: number;
  mode: 'create' | 'refresh';
  newDeviceQrcode?: string;
  newDeviceStatus?: NapcatLoginNewDeviceStatus;
  selfId?: string;
  sessionId?: string;
  status: 'error' | 'expired' | 'idle' | 'pending' | 'success';
  webuiPort?: null | number;
};

/**
 * 通过编排 QQBot 新建或刷新登录的扫码会话，统一处理二维码、轮询、SSE 进度、安全验证和清理。
 *
 * @param options - 打开和关闭扫描弹窗的回调，以及登录成功后可选的刷新回调。
 * @returns 包含扫码状态、二维码展示、进度数据及创建、刷新、验证和清理操作的登录会话控制器。
 */
export function useNapcatLoginSession(options: NapcatLoginSessionOptions) {
  const scanLoading = ref(false);
  const scanQrcodeImageFailed = ref(false);
  const scanQrcodeRevision = ref(0);
  const scanQrcodeText = ref('');
  const scanEvents = ref<QqbotNapcatApi.AccountScanEvent[]>([]);
  const scanState = reactive<NapcatLoginScanState>({
    mode: 'create',
    status: 'idle',
  });
  const scanQrcode = useQRCode(scanQrcodeText, {
    errorCorrectionLevel: 'H',
    margin: 2,
    scale: 8,
  });
  const scanQrcodeImageSrc = computed(() => {
    const qrcode = scanQrcodeText.value.trim();
    if (!qrcode) return '';
    if (!scanQrcodeImageFailed.value && isQrcodeImageCandidate(qrcode)) {
      return normalizeQrcodeImageSrc(qrcode, scanQrcodeRevision.value);
    }
    return scanQrcode.value;
  });
  const scanQrcodeOpenHref = computed(() => {
    const qrcode = scanQrcodeText.value.trim();
    if (!qrcode) return '';
    if (isQrcodeImageCandidate(qrcode)) {
      return normalizeQrcodeImageSrc(qrcode, scanQrcodeRevision.value);
    }
    return qrcode;
  });
  const scanProgressItems = computed(() =>
    scanEvents.value.map((event) => ({
      description: formatEventTime(event.createdAt),
      status: getScanStepStatus(event.status),
      title: getNapcatLoginProgressLabel(event),
    })),
  );
  const scanProgressCurrent = computed(() =>
    Math.max(scanProgressItems.value.length - 1, 0),
  );
  const scanQrcodePlaceholderText = computed(() => {
    if (scanState.newDeviceStatus) {
      return getNapcatNewDeviceStatusMessage(scanState.newDeviceStatus);
    }
    if (scanState.captchaUrl) {
      return '等待安全验证';
    }
    if (
      scanState.mode === 'refresh' &&
      scanState.errorMessage?.includes('正在尝试快速登录')
    ) {
      return '正在尝试快速登录';
    }
    if (
      scanState.mode === 'refresh' &&
      scanState.errorMessage?.includes('正在尝试密码登录')
    ) {
      return '正在尝试密码登录';
    }
    return '二维码生成中';
  });
  const scanTitle = computed(() => {
    if (scanState.mode === 'refresh') {
      return '更新账号登录';
    }
    return '扫码新增账号';
  });
  let scanTimer: number | undefined;
  let scanEventSessionId = '';
  let scanEventSource: EventSource | undefined;

  onBeforeUnmount(() => {
    stopScanPolling();
    stopScanEvents();
  });

  /**
   * 以新建模式启动 NapCat 扫码会话，供登录并创建新的 QQBot 账号。
   */
  async function openCreate() {
    await startScan('create');
  }

  /**
   * 把选中账号作为上下文，启动刷新登录状态的扫码会话。
   *
   * @param row - 要刷新登录状态的 QQBot 账号记录。
   */
  async function openRefresh(row: QqbotApi.Account) {
    await startScan('refresh', row);
  }

  /**
   * 按新建账号或刷新登录模式创建扫码会话，并启动对应状态订阅。
   *
   * @param mode - 区分新建账号登录与刷新已有账号登录的扫码模式。
   * @param row - 刷新模式下要重新建立登录态的现有 QQBot 账号；创建模式可省略。
   */
  async function startScan(mode: 'create' | 'refresh', row?: QqbotApi.Account) {
    resetScanState(mode);
    options.openModal(scanTitle.value);
    scanLoading.value = true;
    try {
      if (mode === 'create') {
        await applyScanResult(await startQqbotAccountScanCreate(), {
          reloadQrcode: true,
        });
        return;
      }
      if (!row) {
        message.warning('请选择需要更新登录的账号');
        return;
      }
      await applyScanResult(await startQqbotAccountScanRefresh(row.id), {
        reloadQrcode: true,
      });
    } catch (error) {
      stopScanPolling();
      scanState.status = 'error';
      scanState.errorMessage = getErrorMessage(error);
    } finally {
      scanLoading.value = false;
    }
  }

  /**
   * 合并扫码响应并同步二维码与验证状态；待处理结果继续监听，成功结果关闭弹窗并通知调用方。
   *
   * @param result - 后端返回、需要写入当前会话状态的最新结果。
   * @param applyOptions - 控制是否强制刷新二维码图片的扫描结果应用选项；未传入时使用 `{}`。
   */
  async function applyScanResult(
    result: QqbotNapcatApi.AccountScanResult,
    applyOptions: { reloadQrcode?: boolean } = {},
  ) {
    const nextState = mergeNapcatAccountScanResult(scanState, result);
    scanState.captchaUrl = nextState.captchaUrl;
    scanState.containerId = nextState.containerId;
    scanState.containerName = nextState.containerName;
    scanState.deviceVerifyUrl = nextState.deviceVerifyUrl;
    scanState.errorMessage = nextState.errorMessage;
    scanState.expiresAt = nextState.expiresAt;
    scanState.mode = nextState.mode;
    scanState.newDeviceQrcode = nextState.newDeviceQrcode;
    scanState.newDeviceStatus = nextState.newDeviceStatus;
    scanState.selfId = nextState.selfId;
    scanState.sessionId = nextState.sessionId;
    scanState.status = nextState.status;
    scanState.webuiPort = nextState.webuiPort;
    const nextQrcode = resolveNapcatLoginDisplayQrcode(nextState);
    const qrcodeChanged = nextQrcode !== scanQrcodeText.value;
    if (qrcodeChanged) {
      scanQrcodeImageFailed.value = false;
    }
    scanQrcodeText.value = nextQrcode;
    if (nextQrcode && (qrcodeChanged || applyOptions.reloadQrcode)) {
      scanQrcodeRevision.value += 1;
      scanQrcodeImageFailed.value = false;
    }

    if (result.status === 'pending') {
      startScanPolling();
      startScanEvents(result.sessionId);
      return;
    }
    stopScanPolling();
    stopScanEvents();
    if (result.status === 'success') {
      message.success(
        (() => {
          if (result.selfId) {
            return `账号 ${result.selfId} 登录态已更新`;
          }
          return '账号已更新';
        })(),
      );
      await options.closeModal();
      await options.onSuccess?.();
    }
  }

  /**
   * 轮询当前扫码会话状态，并把二维码、验证步骤和终态同步到界面。
   */
  async function pollScanStatus() {
    if (!scanState.sessionId || scanLoading.value) return;
    scanLoading.value = true;
    try {
      await applyScanResult(
        await getQqbotAccountScanStatus(scanState.sessionId),
      );
    } finally {
      scanLoading.value = false;
    }
  }

  /**
   * 刷新当前扫码会话二维码并应用新结果；没有会话标识时保持现状。
   */
  async function refreshScanQrcode() {
    if (!scanState.sessionId) return;
    scanLoading.value = true;
    try {
      await applyScanResult(
        await refreshQqbotAccountScanQrcode(scanState.sessionId),
        { reloadQrcode: true },
      );
    } finally {
      scanLoading.value = false;
    }
  }

  /**
   * 为当前扫码会话打开腾讯验证码，只有会话和验证码地址仍匹配时才提交并应用结果。
   */
  async function submitScanCaptcha() {
    const sessionId = scanState.sessionId;
    const captchaUrl = scanState.captchaUrl;
    if (!sessionId || !captchaUrl || scanLoading.value) {
      return;
    }
    scanLoading.value = true;
    try {
      const captcha = await requestTencentCaptcha(captchaUrl);
      if (
        scanState.sessionId !== sessionId ||
        scanState.captchaUrl !== captchaUrl
      ) {
        return;
      }
      await applyScanResult(
        await submitQqbotAccountScanCaptcha({
          ...captcha,
          sessionId,
        }),
      );
    } catch (error) {
      const text = getErrorMessage(error);
      if (text !== '已取消安全验证') {
        message.error(text);
      }
    } finally {
      scanLoading.value = false;
    }
  }

  /**
   * 为当前扫码会话启动两秒一次的状态轮询；已有计时器时保持现有轮询。
   */
  function startScanPolling() {
    if (scanTimer) return;
    scanTimer = window.setInterval(() => {
      void pollScanStatus();
    }, 2000);
  }

  /**
   * 停止扫码状态轮询并清空计时器引用，避免会话结束后继续请求状态。
   */
  function stopScanPolling() {
    if (!scanTimer) return;
    window.clearInterval(scanTimer);
    scanTimer = undefined;
  }

  /**
   * 为新的扫码会话建立带凭据的 SSE 连接，并让相同会话复用现有连接。
   *
   * @param sessionId - 目标扫码或 WebUI 会话的唯一标识。
   */
  function startScanEvents(sessionId?: string) {
    if (!sessionId || scanEventSessionId === sessionId) return;
    stopScanEvents();
    scanEventSessionId = sessionId;
    const source = new EventSource(getQqbotAccountScanEventsUrl(sessionId), {
      withCredentials: true,
    });
    scanEventSource = source;
    source.addEventListener('message', (event) => {
      handleScanEvent(event.data);
    });
    source.addEventListener('error', () => {
      stopScanEvents();
    });
  }

  /**
   * 关闭扫码 SSE 连接并清空当前事件会话标识。
   */
  function stopScanEvents() {
    if (scanEventSource) {
      scanEventSource.close();
    }
    scanEventSource = undefined;
    scanEventSessionId = '';
  }

  /**
   * 消费当前扫码会话事件，按事件类型更新二维码、验证步骤、错误或完成状态。
   *
   * @param payload - EventSource message 携带的 JSON 文本；畸形片段会被忽略。
   */
  function handleScanEvent(payload: string) {
    try {
      const event = JSON.parse(payload) as QqbotNapcatApi.AccountScanEvent;
      const index = scanEvents.value.findIndex(
        (item) => item.step === event.step,
      );
      if (index === -1) {
        scanEvents.value.push(event);
      } else {
        scanEvents.value.splice(index, 1, event);
      }
      if (scanEvents.value.length > 20) {
        scanEvents.value.splice(0, scanEvents.value.length - 20);
      }
      if (event.result) {
        void applyScanResult(event.result, {
          reloadQrcode: ['new-device-qrcode-ready', 'qrcode-ready'].includes(
            event.step,
          ),
        });
      }
    } catch {
      // Ignore malformed SSE chunks and wait for the next event.
    }
  }

  /**
   * 根据创建或刷新模式重置扫码会话状态，清除旧二维码、错误与验证进度。
   *
   * @param mode - 区分新建账号登录与刷新已有账号登录的扫码模式。
   */
  function resetScanState(mode: 'create' | 'refresh') {
    stopScanPolling();
    stopScanEvents();
    Object.assign(scanState, {
      captchaUrl: undefined,
      containerId: undefined,
      containerName: undefined,
      deviceVerifyUrl: undefined,
      errorMessage: undefined,
      expiresAt: undefined,
      mode,
      newDeviceQrcode: undefined,
      newDeviceStatus: undefined,
      selfId: undefined,
      sessionId: undefined,
      status: 'idle',
      webuiPort: undefined,
    });
    scanQrcodeImageFailed.value = false;
    scanQrcodeRevision.value = 0;
    scanQrcodeText.value = '';
    scanEvents.value = [];
  }

  /**
   * 停止扫码轮询与事件订阅，并清空只属于当前登录会话的临时状态。
   */
  function cleanupScanSession() {
    const sessionId = scanState.sessionId;
    stopScanPolling();
    stopScanEvents();
    if (sessionId && scanState.status === 'pending') {
      void cancelQqbotAccountScan(sessionId);
    }
  }

  /**
   * 调用外部关闭方法收起当前 NapCat 扫码弹窗。
   */
  function closeScanModal() {
    void options.closeModal();
  }

  /**
   * 把扫码成功、失败、过期及等待状态映射为 Ant Design 警告类型。
   *
   * @returns 适用于当前扫码状态的 `success`、`error`、`warning` 或 `info` 类型。
   */
  function getScanAlertType() {
    if (scanState.status === 'success') return 'success';
    if (scanState.status === 'error') return 'error';
    if (scanState.status === 'expired') return 'warning';
    return 'info';
  }

  /**
   * 把新设备验证失败、成功和等待状态映射为错误、成功或警告类型。
   *
   * @param status - NapCat 新设备验证阶段；failed 显示错误、verified 显示成功，其余显示警告。
   * @returns 适用于新设备验证状态的 `error`、`success` 或 `warning` 类型。
   */
  function getNewDeviceAlertType(status?: NapcatLoginNewDeviceStatus) {
    if (status === 'failed') return 'error';
    if (status === 'verified') return 'success';
    return 'warning';
  }

  /**
   * 根据扫码会话状态选择成功、失败、过期或等待提示，并优先展示后端错误。
   *
   * @returns 当前扫码状态的中文提示；失败或处理中存在后端消息时优先返回该消息。
   */
  function getScanMessage() {
    if (scanState.status === 'success') return '扫码登录成功';
    if (scanState.status === 'error') {
      return scanState.errorMessage || '扫码登录失败';
    }
    if (scanState.status === 'expired') return '二维码已过期，请刷新二维码';
    if (scanState.errorMessage) return scanState.errorMessage;
    return '请使用目标 QQ 扫码登录，页面会自动轮询登录结果';
  }

  /**
   * 二维码候选地址加载失败时标记图片不可用，以便界面回退展示原始文本。
   */
  function onQrcodeImageError() {
    if (isQrcodeImageCandidate(scanQrcodeText.value)) {
      scanQrcodeImageFailed.value = true;
    }
  }

  return {
    cleanupScanSession,
    closeScanModal,
    getNewDeviceAlertType,
    getScanAlertType,
    getScanMessage,
    onQrcodeImageError,
    openCreate,
    openRefresh,
    pollScanStatus,
    refreshScanQrcode,
    scanLoading,
    scanProgressCurrent,
    scanProgressItems,
    scanQrcodeImageSrc,
    scanQrcodeOpenHref,
    scanQrcodePlaceholderText,
    scanQrcodeText,
    scanState,
    scanTitle,
    submitScanCaptcha,
  };
}

/**
 * 从字符串或 Error 对象提取非空消息，无法识别时返回调用方提供的兜底文本。
 *
 * @param error - 可能为 Error、字符串或携带 err、message、msg 字段的扫码异常值。
 * @returns 可展示的错误文本；无法识别输入时回退为“扫码登录请求失败”。
 */
function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return `${record.msg || record.message || record.err || '扫码登录请求失败'}`;
  }
  return '扫码登录请求失败';
}
