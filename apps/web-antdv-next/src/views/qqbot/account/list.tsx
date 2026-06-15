import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type {
  NapcatLoginNewDeviceStatus,
  QqbotNapcatApi,
} from '#/api/qqbot/napcat';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/ktTable';

import { computed, defineComponent, onBeforeUnmount, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { useQRCode } from '@vueuse/integrations/useQRCode';
import {
  Alert,
  Button,
  message,
  Space,
  Steps,
  Tag,
  Typography,
} from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createQqbotAccount,
  deleteQqbotAccount,
  getQqbotAccountList,
  kickQqbotAccount,
  updateQqbotAccount,
} from '#/api/qqbot';
import {
  cancelQqbotAccountScan,
  getNapcatNewDeviceStatusMessage,
  getQqbotAccountScanEventsUrl,
  getQqbotAccountScanStatus,
  refreshQqbotAccountScanQrcode,
  resolveNapcatLoginDisplayQrcode,
  startQqbotAccountScanCreate,
  startQqbotAccountScanRefresh,
  submitQqbotAccountScanCaptcha,
} from '#/api/qqbot/napcat';
import { KtTable, useKtTable } from '#/components/ktTable';

const AKtTable = KtTable as any;
const AButton = Button as any;
const ASteps = Steps as any;
const ATypographyLink = Typography.Link as any;
const ATypographyText = Typography.Text as any;

type TencentCaptchaResult = {
  appid?: string;
  errorCode?: number;
  errorMessage?: string;
  randstr?: string;
  ret: number;
  ticket?: string;
};

type TencentCaptchaInstance = {
  destroy: () => void;
  show: () => void;
};

declare global {
  interface Window {
    TencentCaptcha?: new (
      appid: string,
      callback: (res: TencentCaptchaResult) => void,
      options?: Record<string, unknown>,
    ) => TencentCaptchaInstance;
  }
}

let tencentCaptchaScriptPromise: Promise<void> | undefined;

export default defineComponent({
  name: 'QqBotAccountList',
  setup() {
    const editingId = ref<string>();
    const router = useRouter();
    const scanLoading = ref(false);
    const scanQrcodeImageFailed = ref(false);
    const scanQrcodeRevision = ref(0);
    const scanQrcodeText = ref('');
    const scanEvents = ref<QqbotNapcatApi.AccountScanEvent[]>([]);
    const scanState = reactive<{
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
    }>({
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
        title: event.message,
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
    let scanTimer: number | undefined;
    let scanEventSessionId = '';
    let scanEventSource: EventSource | undefined;

    const [AccountForm, accountFormApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      layout: 'horizontal',
      schema: [
        {
          component: 'Input',
          componentProps: {
            placeholder: 'NapCat 当前登录 QQ',
          },
          fieldName: 'selfId',
          label: 'Self ID',
          rules: 'required',
        },
        {
          component: 'Input',
          componentProps: {
            placeholder: '便于后台识别',
          },
          fieldName: 'name',
          label: '账号名称',
        },
        {
          component: 'InputPassword',
          componentProps: () => ({
            placeholder: editingId.value
              ? '留空表示不修改'
              : 'OneBot 反向 WS token',
          }),
          fieldName: 'accessToken',
          label: 'Token',
        },
        {
          component: 'InputPassword',
          componentProps: () => ({
            placeholder: editingId.value
              ? '留空表示不修改 QQ 登录密码'
              : '可选，用于 NapCat 密码登录',
          }),
          fieldName: 'loginPassword',
          label: '登录密码',
        },
        {
          component: 'Switch',
          fieldName: 'enabled',
          label: '启用',
        },
        {
          component: 'Input',
          fieldName: 'remark',
          label: '备注',
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });

    const columns: Array<TableColumnType<QqbotApi.Account>> = [
      { dataIndex: 'selfId', key: 'selfId', title: 'Self ID', width: 140 },
      { dataIndex: 'name', key: 'name', title: '账号名称', width: 150 },
      {
        dataIndex: 'connectStatus',
        key: 'accountOnlineStatus',
        title: 'OneBot 连接',
        width: 140,
      },
      {
        dataIndex: 'napcat',
        key: 'qqLoginStatus',
        title: 'QQ 登录',
        width: 150,
      },
      {
        dataIndex: 'napcat',
        key: 'napcatRuntime',
        title: 'NapCat 运行',
        width: 240,
      },
      {
        dataIndex: 'lastHeartbeatAt',
        key: 'lastHeartbeatAt',
        title: '最近活动',
        width: 190,
      },
      {
        dataIndex: 'lastError',
        key: 'runtimeSummary',
        title: '运行说明',
        width: 220,
      },
    ];

    const api: KtTableApi<QqbotApi.Account> = {
      list: async (params) => await getQqbotAccountList(params),
    };
    const buttons: Array<KtTableButton<QqbotApi.Account>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'scanCreate',
        label: '扫码新增账号',
        onClick: openScanCreate,
        permissionCodes: ['QqBot:Account:Create'],
        type: 'primary',
      },
      {
        key: 'manualCreate',
        label: '手动维护',
        onClick: openCreate,
        permissionCodes: ['QqBot:Account:Create'],
      },
    ];
    const rowActions: Array<KtTableRowAction<QqbotApi.Account>> = [
      {
        key: 'config',
        label: '配置',
        onClick: openConfig,
        permissionCodes: ['QqBot:Account:Config'],
      },
      {
        key: 'refreshLogin',
        label: '更新登录',
        onClick: openScanRefresh,
        permissionCodes: ['QqBot:Account:RefreshLogin'],
      },
      {
        confirm: (row) =>
          `确认删除账号「${row.selfId}」吗？该操作会同时删除该账号专属的 NapCat 容器。`,
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: async (row, context) => {
          const result = await deleteQqbotAccount(row.id);
          message.success(
            result.deletedContainers > 0
              ? `账号删除成功，已删除 ${result.deletedContainers} 个 NapCat 容器`
              : '账号删除成功',
          );
          await context.reload();
        },
        permissionCodes: ['QqBot:Account:Delete'],
      },
      {
        disabled: (row) => getOneBotStatus(row) !== 'online',
        key: 'kick',
        label: '断开',
        onClick: async (row, context) => {
          await kickQqbotAccount(row.selfId);
          message.success('连接已断开');
          await context.reload();
        },
        permissionCodes: ['QqBot:Account:Kick'],
      },
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        permissionCodes: ['QqBot:Account:Edit'],
      },
    ];
    const [registerTable, tableApi] = useKtTable<QqbotApi.Account>({
      api,
      buttons,
      columns,
      formOptions: {
        schema: [
          {
            component: 'Input',
            componentProps: { allowClear: true, placeholder: 'Self ID' },
            fieldName: 'selfId',
            label: 'Self ID',
          },
          {
            component: 'Input',
            componentProps: { allowClear: true, placeholder: '账号名称' },
            fieldName: 'name',
            label: '账号名称',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: [
                { label: 'OneBot 在线', value: 'online' },
                { label: 'OneBot 离线', value: 'offline' },
              ],
            },
            fieldName: 'connectStatus',
            label: 'OneBot',
          },
        ],
      },
      rowActions,
      tableTitle: 'QQBot 账号连接',
    });
    const modalTitle = computed(() =>
      editingId.value ? '编辑账号' : '新建账号',
    );
    const scanTitle = computed(() =>
      scanState.mode === 'refresh' ? '更新账号登录' : '扫码新增账号',
    );

    const [ScanModal, scanModalApi] = useVbenModal({
      class: 'w-[520px]',
      fullscreenButton: false,
      onBeforeClose() {
        cleanupScanSession();
        return true;
      },
      onCancel() {
        closeScanModal();
      },
    });

    const [AccountModal, accountModalApi] = useVbenModal({
      class: 'w-[620px]',
      fullscreenButton: false,
      async onConfirm() {
        await submitAccount();
      },
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = accountModalApi.getData<{
          values?: QqbotApi.AccountBody;
        }>();
        void resetAccountForm(values || getAccountFormDefaults());
      },
    });
    onBeforeUnmount(() => {
      stopScanPolling();
      stopScanEvents();
    });

    async function openScanCreate() {
      await startScan('create');
    }

    async function openScanRefresh(row: QqbotApi.Account) {
      await startScan('refresh', row);
    }

    async function startScan(
      mode: 'create' | 'refresh',
      row?: QqbotApi.Account,
    ) {
      resetScanState(mode);
      scanModalApi.setState({ title: scanTitle.value }).open();
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
      options: { reloadQrcode?: boolean } = {},
    ) {
      scanState.captchaUrl = result.captchaUrl;
      scanState.containerId = result.containerId;
      scanState.containerName = result.containerName;
      scanState.deviceVerifyUrl = result.deviceVerifyUrl;
      scanState.errorMessage = result.errorMessage;
      scanState.expiresAt = result.expiresAt;
      scanState.mode = result.mode;
      scanState.newDeviceQrcode = result.newDeviceQrcode;
      scanState.newDeviceStatus = result.newDeviceStatus;
      scanState.selfId = result.selfId;
      scanState.sessionId = result.sessionId;
      scanState.status = result.status;
      scanState.webuiPort = result.webuiPort;
      const nextQrcode = resolveNapcatLoginDisplayQrcode(result);
      const qrcodeChanged = nextQrcode !== scanQrcodeText.value;
      if (qrcodeChanged) {
        scanQrcodeImageFailed.value = false;
      }
      scanQrcodeText.value = nextQrcode;
      if (nextQrcode && (qrcodeChanged || options.reloadQrcode)) {
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
        await scanModalApi.close();
        await tableApi.reload();
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
      void scanModalApi.close();
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

    function getErrorMessage(error: unknown) {
      if (error instanceof Error) return error.message;
      if (typeof error === 'string') return error;
      if (error && typeof error === 'object') {
        const record = error as Record<string, unknown>;
        return `${record.msg || record.message || record.err || '扫码登录请求失败'}`;
      }
      return '扫码登录请求失败';
    }

    function getScanStepStatus(
      status: QqbotNapcatApi.AccountScanEvent['status'],
    ) {
      if (status === 'error') return 'error';
      if (status === 'processing') return 'process';
      if (status === 'success') return 'finish';
      return 'wait';
    }

    function formatEventTime(value: number) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('zh-CN', { hour12: false });
    }

    function isQrcodeImageCandidate(value: string) {
      return (
        /^data:image\//i.test(value) ||
        /^https?:\/\//i.test(value) ||
        isRawBase64Image(value)
      );
    }

    function normalizeQrcodeImageSrc(value: string, revision = 0) {
      if (isRawBase64Image(value)) {
        return `data:image/png;base64,${value}`;
      }
      if (/^https?:\/\//i.test(value) && revision > 0) {
        return appendQrcodeCacheBuster(value, revision);
      }
      return value;
    }

    function appendQrcodeCacheBuster(value: string, revision: number) {
      try {
        const url = new URL(value);
        url.searchParams.set('_kt_qrcode_v', `${revision}`);
        return url.toString();
      } catch {
        const joiner = value.includes('?') ? '&' : '?';
        return `${value}${joiner}_kt_qrcode_v=${revision}`;
      }
    }

    function isRawBase64Image(value: string) {
      const normalized = value.trim();
      return (
        normalized.startsWith('iVBORw0KGgo') ||
        normalized.startsWith('/9j/') ||
        normalized.startsWith('R0lGOD')
      );
    }

    const renderAccountOnlineStatus = (row: QqbotApi.Account) => {
      if (!row.enabled) {
        return <Tag color="default">已停用</Tag>;
      }
      const online = getOneBotStatus(row) === 'online';
      return (
        <Tag color={online ? 'success' : 'default'}>
          {online ? 'OneBot 在线' : 'OneBot 离线'}
        </Tag>
      );
    };

    const renderQqLoginStatus = (row: QqbotApi.Account) => {
      const meta = getQqLoginStatusMeta(row);
      const message = getQqLoginMessage(row);
      return (
        <Space direction="vertical" size={2}>
          <Tag color={meta.color}>{meta.label}</Tag>
          {message ? (
            <ATypographyText type="secondary">{message}</ATypographyText>
          ) : null}
        </Space>
      );
    };

    const renderNapcatRuntime = (row: QqbotApi.Account) => {
      const napcat = row.napcat;
      const meta = getNapcatStatusMeta(row);
      const webuiMeta = getNapcatWebuiMeta(row);
      return (
        <Space direction="vertical" size={2}>
          <Space size={4} wrap>
            <Tag color={meta.color}>{meta.label}</Tag>
            <Tag color={webuiMeta.color}>{webuiMeta.label}</Tag>
          </Space>
          {napcat?.containerName ? (
            <ATypographyText type="secondary">
              {napcat.containerName}
              {napcat.webuiPort ? `:${napcat.webuiPort}` : ''}
            </ATypographyText>
          ) : null}
        </Space>
      );
    };

    const renderRecentActivity = (row: QqbotApi.Account) => {
      const active = getRecentActivity(row);
      return (
        <Space direction="vertical" size={2}>
          <span>{active.label}</span>
          <ATypographyText type="secondary">
            {active.time || '暂无记录'}
          </ATypographyText>
        </Space>
      );
    };

    const renderRuntimeSummary = (row: QqbotApi.Account) => {
      const summary = getRuntimeSummary(row);
      return (
        <ATypographyText
          title={summary.text}
          type={summary.level === 'warning' ? 'warning' : undefined}
        >
          {summary.text}
        </ATypographyText>
      );
    };

    function getNapcatStatusMeta(row: QqbotApi.Account) {
      const status = row.containerStatus || row.napcat?.containerStatus;
      if (!row.napcat && !status) {
        return { color: 'default', label: '未绑定专属容器' };
      }
      if (!status) {
        return { color: 'warning', label: '容器记录缺失' };
      }
      const statusMap: Record<
        NonNullable<QqbotApi.AccountNapcatRuntime['containerStatus']>,
        { color: string; label: string }
      > = {
        creating: { color: 'processing', label: '容器创建中' },
        error: { color: 'error', label: '容器异常' },
        running: { color: 'success', label: '容器运行中' },
        stopped: { color: 'default', label: '容器已停止' },
      };
      return statusMap[status];
    }

    function getNapcatWebuiMeta(row: QqbotApi.Account) {
      const status = getWebuiStatus(row);
      if (!row.napcat && status === 'unknown') {
        return { color: 'default', label: 'WebUI 未绑定' };
      }
      if (status === 'online') {
        return { color: 'success', label: 'WebUI 可用' };
      }
      if (status === 'offline') {
        return { color: 'error', label: 'WebUI 不可用' };
      }
      return { color: 'default', label: 'WebUI 未检查' };
    }

    function getQqLoginStatusMeta(row: QqbotApi.Account) {
      if (!row.napcat && !row.qqLoginStatus) {
        return { color: 'default', label: '未绑定容器' };
      }
      const statusMap: Record<
        QqbotApi.QqLoginStatus,
        { color: string; label: string }
      > = {
        offline: { color: 'error', label: 'QQ 离线' },
        online: { color: 'success', label: 'QQ 在线' },
        qrcode_expired: { color: 'warning', label: '二维码过期' },
        qrcode_pending: { color: 'processing', label: '等待扫码' },
        unknown: { color: 'default', label: '状态未知' },
      };
      return statusMap[getQqLoginStatus(row)];
    }

    function getOneBotStatus(row: QqbotApi.Account): QqbotApi.OneBotStatus {
      if (row.oneBotStatus) return row.oneBotStatus;
      if (row.napcat?.oneBotOnline !== undefined) {
        return row.napcat.oneBotOnline ? 'online' : 'offline';
      }
      return row.connectStatus === 'online' ? 'online' : 'offline';
    }

    function getWebuiStatus(row: QqbotApi.Account): QqbotApi.WebuiStatus {
      if (row.webuiStatus) return row.webuiStatus;
      if (row.napcat?.webuiOnline === true) return 'online';
      if (row.napcat?.webuiOnline === false) return 'offline';
      return 'unknown';
    }

    function getQqLoginStatus(row: QqbotApi.Account): QqbotApi.QqLoginStatus {
      return row.qqLoginStatus || row.napcat?.qqLoginStatus || 'unknown';
    }

    function getQqLoginMessage(row: QqbotApi.Account) {
      return row.qqLoginMessage ?? row.napcat?.qqLoginMessage;
    }

    function getRecentActivity(row: QqbotApi.Account) {
      const candidates = [
        { label: '最近心跳', value: row.lastHeartbeatAt },
        { label: '最近连接', value: row.lastConnectedAt },
        { label: '最近扫码登录', value: row.napcat?.lastLoginAt },
        { label: '容器启动', value: row.napcat?.lastStartedAt },
      ].filter((item) => item.value);
      const latest = candidates.toSorted(
        (left, right) =>
          new Date(right.value || '').getTime() -
          new Date(left.value || '').getTime(),
      )[0];
      return {
        label: latest?.label || '暂无活动',
        time: latest?.value ? formatDisplayTime(latest.value) : '',
      };
    }

    function getRuntimeSummary(row: QqbotApi.Account) {
      if (!row.enabled) {
        return { level: 'warning', text: '账号已停用' };
      }
      if (row.lastError) {
        return { level: 'warning', text: `账号异常：${row.lastError}` };
      }
      const qqLoginMessage = getQqLoginMessage(row);
      const qqLoginStatus = getQqLoginStatus(row);
      const containerStatus =
        row.containerStatus || row.napcat?.containerStatus;
      if (qqLoginMessage) {
        return {
          level: 'warning',
          text: `QQ 登录：${qqLoginMessage}`,
        };
      }
      if (row.napcat?.lastError) {
        return { level: 'warning', text: `NapCat：${row.napcat.lastError}` };
      }
      if (qqLoginStatus === 'qrcode_expired') {
        return { level: 'warning', text: '二维码已过期，点击更新登录' };
      }
      if (getOneBotStatus(row) === 'online') {
        return { level: 'normal', text: '消息链路可用' };
      }
      if (qqLoginStatus === 'online') {
        return { level: 'warning', text: 'QQ 在线，等待 OneBot 连接' };
      }
      if (containerStatus === 'running') {
        return { level: 'warning', text: 'NapCat 运行中，等待 OneBot 连接' };
      }
      if (containerStatus === 'creating') {
        return { level: 'warning', text: '容器创建中' };
      }
      if (containerStatus === 'stopped') {
        return { level: 'warning', text: '容器已停止' };
      }
      if (!row.napcat) {
        return {
          level: 'warning',
          text: '可更新登录绑定容器',
        };
      }
      return { level: 'normal', text: '暂无异常记录' };
    }

    function formatDisplayTime(value: string) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleString('zh-CN', { hour12: false });
    }

    function getAccountFormDefaults(): QqbotApi.AccountBody {
      return {
        accessToken: '',
        connectionMode: 'reverse-ws',
        enabled: true,
        loginPassword: '',
        name: '',
        remark: '',
        selfId: '',
      };
    }

    async function resetAccountForm(values: QqbotApi.AccountBody) {
      await accountFormApi.resetForm();
      await accountFormApi.setValues(values);
      await accountFormApi.resetValidate();
    }

    function openCreate() {
      editingId.value = undefined;
      accountModalApi.setData({ values: getAccountFormDefaults() }).open();
    }

    function openConfig(row: QqbotApi.Account) {
      void router.push({
        name: 'QqBotAccountConfig',
        query: {
          selfId: row.selfId,
        },
      });
    }

    function openEdit(row: QqbotApi.Account) {
      editingId.value = row.id;
      accountModalApi
        .setData({
          values: {
            accessToken: '',
            connectionMode: row.connectionMode,
            enabled: row.enabled,
            id: row.id,
            loginPassword: '',
            name: row.name,
            remark: row.remark || '',
            selfId: row.selfId,
          },
        })
        .open();
    }

    async function submitAccount() {
      const { valid } = await accountFormApi.validate();
      if (!valid) return;

      const values = await accountFormApi.getValues<QqbotApi.AccountBody>();
      const selfId = values.selfId?.trim();
      if (!selfId) {
        message.warning('请填写 Self ID');
        return;
      }

      accountModalApi.lock();
      try {
        const payload = {
          ...values,
          id: editingId.value,
          selfId,
        };
        if (!payload.accessToken) delete payload.accessToken;
        if (!payload.loginPassword) delete payload.loginPassword;
        await (editingId.value
          ? updateQqbotAccount(payload)
          : createQqbotAccount(payload));
        message.success('账号保存成功');
        await accountModalApi.close();
        await tableApi.reload();
      } finally {
        accountModalApi.unlock();
      }
    }

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as QqbotApi.Account;
              if (column.key === 'accountOnlineStatus') {
                return renderAccountOnlineStatus(row);
              }
              if (column.key === 'qqLoginStatus') {
                return renderQqLoginStatus(row);
              }
              if (column.key === 'napcatRuntime') {
                return renderNapcatRuntime(row);
              }
              if (column.key === 'lastHeartbeatAt') {
                return renderRecentActivity(row);
              }
              if (column.key === 'runtimeSummary') {
                return renderRuntimeSummary(row);
              }
              return undefined;
            },
          }}
        />
        <ScanModal
          title={scanTitle.value}
          v-slots={{
            footer: () => [
              <AButton key="close" onClick={closeScanModal}>
                关闭
              </AButton>,
              <AButton
                disabled={
                  !scanState.sessionId ||
                  !!scanState.captchaUrl ||
                  !!scanState.newDeviceStatus
                }
                key="refresh"
                loading={scanLoading.value}
                onClick={refreshScanQrcode}
              >
                刷新二维码
              </AButton>,
              <AButton
                disabled={!scanState.sessionId}
                key="check"
                loading={scanLoading.value}
                onClick={pollScanStatus}
                type="primary"
              >
                检查状态
              </AButton>,
            ],
          }}
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              message={getScanMessage()}
              showIcon
              type={getScanAlertType() as any}
            />
            {scanState.containerName ? (
              <Alert
                message={`NapCat 容器：${scanState.containerName}${
                  scanState.webuiPort
                    ? `，WebUI 端口：${scanState.webuiPort}`
                    : ''
                }`}
                showIcon
                type="info"
              />
            ) : null}
            {scanState.newDeviceStatus ? (
              <Alert
                description={
                  <Space direction="vertical">
                    <ATypographyText>
                      请使用手机 QQ
                      扫描下方新设备验证二维码，并在手机端确认登录。
                    </ATypographyText>
                    {scanState.deviceVerifyUrl ? (
                      <ATypographyLink
                        href={scanState.deviceVerifyUrl}
                        target="_blank"
                      >
                        打开新设备验证链接
                      </ATypographyLink>
                    ) : null}
                  </Space>
                }
                message={getNapcatNewDeviceStatusMessage(
                  scanState.newDeviceStatus,
                )}
                showIcon
                type={getNewDeviceAlertType(scanState.newDeviceStatus)}
              />
            ) : null}
            {scanState.captchaUrl && !scanState.newDeviceStatus ? (
              <Alert
                description={
                  <Space>
                    <ATypographyText>
                      请在当前页面完成腾讯安全验证，验证结果会自动提交到对应
                      NapCat 容器。
                    </ATypographyText>
                    <AButton
                      loading={scanLoading.value}
                      onClick={submitScanCaptcha}
                      type="primary"
                    >
                      完成安全验证
                    </AButton>
                  </Space>
                }
                message="QQ 密码登录需要安全验证"
                showIcon
                type="warning"
              />
            ) : null}
            {scanProgressItems.value.length > 0 ? (
              <ASteps
                current={scanProgressCurrent.value}
                direction="vertical"
                items={scanProgressItems.value}
                size="small"
              />
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {scanQrcodeText.value ? (
                <img
                  alt="qqbot-login-qrcode"
                  onError={() => {
                    if (isQrcodeImageCandidate(scanQrcodeText.value)) {
                      scanQrcodeImageFailed.value = true;
                    }
                  }}
                  src={scanQrcodeImageSrc.value}
                  style={{
                    background: '#fff',
                    borderRadius: '8px',
                    height: '240px',
                    padding: '12px',
                    width: '240px',
                  }}
                />
              ) : (
                <div
                  style={{
                    alignItems: 'center',
                    border: '1px dashed var(--border-color)',
                    borderRadius: '8px',
                    display: 'flex',
                    height: '240px',
                    justifyContent: 'center',
                    width: '240px',
                  }}
                >
                  {scanQrcodePlaceholderText.value}
                </div>
              )}
            </div>
            {scanQrcodeText.value ? (
              <ATypographyLink href={scanQrcodeOpenHref.value} target="_blank">
                打开扫码链接
              </ATypographyLink>
            ) : null}
          </Space>
        </ScanModal>
        <AccountModal title={modalTitle.value}>
          <AccountForm class="mx-2" />
        </AccountModal>
      </Page>
    );
  },
});

function requestTencentCaptcha(
  proofWaterUrl: string,
): Promise<Omit<QqbotNapcatApi.AccountScanCaptchaBody, 'sessionId'>> {
  const params = parseUrlParams(proofWaterUrl);
  const appid = params.aid || '2081081773';
  const sid = params.sid || '';

  return loadTencentCaptchaScript().then(
    () =>
      new Promise((resolve, reject) => {
        if (!window.TencentCaptcha) {
          reject(new Error('腾讯验证码组件加载失败'));
          return;
        }

        let captcha: TencentCaptchaInstance | undefined;
        let settled = false;
        const finish = (
          error?: Error,
          value?: Omit<QqbotNapcatApi.AccountScanCaptchaBody, 'sessionId'>,
        ) => {
          if (settled) return;
          settled = true;
          try {
            captcha?.destroy();
          } catch {
            // The captcha SDK may already have cleaned up its popup.
          }
          if (error) {
            reject(error);
            return;
          }
          if (!value) {
            reject(new Error('腾讯验证码未返回验证结果'));
            return;
          }
          resolve(value);
        };

        captcha = new window.TencentCaptcha(
          appid,
          (res) => {
            if (res.ret === 0 && res.ticket && res.randstr) {
              finish(undefined, {
                randstr: res.randstr,
                sid,
                ticket: res.ticket,
              });
              return;
            }
            finish(new Error('已取消安全验证'));
          },
          {
            enableAged: true,
            login_appid: params.login_appid,
            showHeader: false,
            sid: params.sid,
            type: 'popup',
            uin: params.uin,
          },
        );
        captcha.show();
      }),
  );
}

async function loadTencentCaptchaScript() {
  if (window.TencentCaptcha) return;
  tencentCaptchaScriptPromise =
    tencentCaptchaScriptPromise ||
    loadScriptWithFallback([
      'https://captcha.gtimg.com/TCaptcha.js',
      'https://ssl.captcha.qq.com/TCaptcha.js',
    ]);
  try {
    await tencentCaptchaScriptPromise;
  } catch (error) {
    tencentCaptchaScriptPromise = undefined;
    throw error;
  }
}

async function loadScriptWithFallback(sources: string[]) {
  let lastError: unknown;
  for (const source of sources) {
    try {
      await loadScript(source);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('腾讯验证码脚本加载失败');
}

function loadScript(source: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${source}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error(`腾讯验证码脚本加载失败：${source}`)),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = source;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error(`腾讯验证码脚本加载失败：${source}`)),
      { once: true },
    );
    document.head.append(script);
  });
}

function parseUrlParams(url: string) {
  const params: Record<string, string> = {};
  try {
    const parsed = new URL(url);
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    const query = url.split('?')[1] || '';
    query.split('&').forEach((pair) => {
      const [key, value = ''] = pair.split('=');
      if (key) params[key] = decodeURIComponent(value);
    });
    return params;
  }
}
