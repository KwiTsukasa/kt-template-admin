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
  const scanTitle = computed(() =>
    scanState.mode === 'refresh' ? '更新账号登录' : '扫码新增账号',
  );
  let scanTimer: number | undefined;
  let scanEventSessionId = '';
  let scanEventSource: EventSource | undefined;

  onBeforeUnmount(() => {
    stopScanPolling();
    stopScanEvents();
  });

  async function openCreate() {
    await startScan('create');
  }

  async function openRefresh(row: QqbotApi.Account) {
    await startScan('refresh', row);
  }

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
        result.selfId ? `账号 ${result.selfId} 登录态已更新` : '账号已更新',
      );
      await options.closeModal();
      await options.onSuccess?.();
    }
  }

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

  function startScanPolling() {
    if (scanTimer) return;
    scanTimer = window.setInterval(() => {
      void pollScanStatus();
    }, 2000);
  }

  function stopScanPolling() {
    if (!scanTimer) return;
    window.clearInterval(scanTimer);
    scanTimer = undefined;
  }

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

  function stopScanEvents() {
    if (scanEventSource) {
      scanEventSource.close();
    }
    scanEventSource = undefined;
    scanEventSessionId = '';
  }

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

  function cleanupScanSession() {
    const sessionId = scanState.sessionId;
    stopScanPolling();
    stopScanEvents();
    if (sessionId && scanState.status === 'pending') {
      void cancelQqbotAccountScan(sessionId);
    }
  }

  function closeScanModal() {
    void options.closeModal();
  }

  function getScanAlertType() {
    if (scanState.status === 'success') return 'success';
    if (scanState.status === 'error') return 'error';
    if (scanState.status === 'expired') return 'warning';
    return 'info';
  }

  function getNewDeviceAlertType(status?: NapcatLoginNewDeviceStatus) {
    if (status === 'failed') return 'error';
    if (status === 'verified') return 'success';
    return 'warning';
  }

  function getScanMessage() {
    if (scanState.status === 'success') return '扫码登录成功';
    if (scanState.status === 'error') {
      return scanState.errorMessage || '扫码登录失败';
    }
    if (scanState.status === 'expired') return '二维码已过期，请刷新二维码';
    if (scanState.errorMessage) return scanState.errorMessage;
    return '请使用目标 QQ 扫码登录，页面会自动轮询登录结果';
  }

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return `${record.msg || record.message || record.err || '扫码登录请求失败'}`;
  }
  return '扫码登录请求失败';
}
