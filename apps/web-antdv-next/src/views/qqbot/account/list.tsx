import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/ktTable';

import { computed, defineComponent, onBeforeUnmount, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { useQRCode } from '@vueuse/integrations/useQRCode';
import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antdv-next';

import {
  cancelQqbotAccountScan,
  createQqbotAccount,
  deleteQqbotAccount,
  getQqbotAccountList,
  getQqbotAccountScanStatus,
  kickQqbotAccount,
  refreshQqbotAccountScanQrcode,
  startQqbotAccountScanCreate,
  startQqbotAccountScanRefresh,
  updateQqbotAccount,
} from '#/api/qqbot';
import { KtTable, useKtTable } from '#/components/ktTable';

const AKtTable = KtTable as any;
const AButton = Button as any;
const AInput = Input as any;
const AModal = Modal as any;
const ASwitch = Switch as any;
const ATypographyLink = Typography.Link as any;

export default defineComponent({
  name: 'QqBotAccountList',
  setup() {
    const saving = ref(false);
    const modalOpen = ref(false);
    const editingId = ref<string>();
    const scanLoading = ref(false);
    const scanModalOpen = ref(false);
    const scanQrcodeText = ref('');
    const scanState = reactive<{
      containerId?: string;
      containerName?: string;
      errorMessage?: string;
      expiresAt?: number;
      mode: 'create' | 'refresh';
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
    let scanTimer: number | undefined;
    const form = reactive<QqbotApi.AccountBody>({
      accessToken: '',
      connectionMode: 'reverse-ws',
      enabled: true,
      name: '',
      remark: '',
      selfId: '',
    });

    const columns: Array<TableColumnType<QqbotApi.Account>> = [
      { dataIndex: 'selfId', key: 'selfId', title: 'Self ID', width: 160 },
      { dataIndex: 'name', key: 'name', title: '账号名称', width: 180 },
      {
        dataIndex: 'connectStatus',
        key: 'connectStatus',
        title: '连接状态',
        width: 120,
      },
      {
        dataIndex: 'clientRole',
        key: 'clientRole',
        title: '连接角色',
        width: 120,
      },
      {
        dataIndex: 'lastHeartbeatAt',
        key: 'lastHeartbeatAt',
        title: '最后心跳',
        width: 190,
      },
      {
        dataIndex: 'lastError',
        key: 'lastError',
        title: '错误信息',
        width: 260,
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
        disabled: (row) => row.connectStatus !== 'online',
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
                { label: '在线', value: 'online' },
                { label: '离线', value: 'offline' },
              ],
            },
            fieldName: 'connectStatus',
            label: '连接状态',
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

    onBeforeUnmount(() => {
      stopScanPolling();
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
      scanModalOpen.value = true;
      scanLoading.value = true;
      try {
        if (mode === 'create') {
          await applyScanResult(await startQqbotAccountScanCreate());
          return;
        }
        if (!row) {
          message.warning('请选择需要更新登录的账号');
          return;
        }
        await applyScanResult(await startQqbotAccountScanRefresh(row.id));
      } catch (error) {
        stopScanPolling();
        scanState.status = 'error';
        scanState.errorMessage = getErrorMessage(error);
      } finally {
        scanLoading.value = false;
      }
    }

    async function applyScanResult(result: QqbotApi.AccountScanResult) {
      scanState.containerId = result.containerId;
      scanState.containerName = result.containerName;
      scanState.errorMessage = result.errorMessage;
      scanState.expiresAt = result.expiresAt;
      scanState.mode = result.mode;
      scanState.selfId = result.selfId;
      scanState.sessionId = result.sessionId;
      scanState.status = result.status;
      scanState.webuiPort = result.webuiPort;
      scanQrcodeText.value = result.qrcode || '';

      if (result.status === 'pending') {
        startScanPolling();
        return;
      }
      stopScanPolling();
      if (result.status === 'success') {
        message.success(
          result.selfId ? `账号 ${result.selfId} 登录态已更新` : '账号已更新',
        );
        scanModalOpen.value = false;
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
        );
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

    function resetScanState(mode: 'create' | 'refresh') {
      stopScanPolling();
      Object.assign(scanState, {
        containerId: undefined,
        containerName: undefined,
        errorMessage: undefined,
        expiresAt: undefined,
        mode,
        selfId: undefined,
        sessionId: undefined,
        status: 'idle',
        webuiPort: undefined,
      });
      scanQrcodeText.value = '';
    }

    function closeScanModal() {
      const sessionId = scanState.sessionId;
      stopScanPolling();
      scanModalOpen.value = false;
      if (sessionId && scanState.status === 'pending') {
        void cancelQqbotAccountScan(sessionId);
      }
    }

    function getScanAlertType() {
      if (scanState.status === 'success') return 'success';
      if (scanState.status === 'error') return 'error';
      if (scanState.status === 'expired') return 'warning';
      return 'info';
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

    function openCreate() {
      editingId.value = undefined;
      Object.assign(form, {
        accessToken: '',
        connectionMode: 'reverse-ws',
        enabled: true,
        name: '',
        remark: '',
        selfId: '',
      });
      modalOpen.value = true;
    }

    function openEdit(row: QqbotApi.Account) {
      editingId.value = row.id;
      Object.assign(form, {
        accessToken: '',
        connectionMode: row.connectionMode,
        enabled: row.enabled,
        id: row.id,
        name: row.name,
        remark: row.remark || '',
        selfId: row.selfId,
      });
      modalOpen.value = true;
    }

    async function submitAccount() {
      if (!form.selfId.trim()) {
        message.warning('请填写 Self ID');
        return;
      }

      saving.value = true;
      try {
        const payload = {
          ...form,
          id: editingId.value,
          selfId: form.selfId.trim(),
        };
        if (!payload.accessToken) delete payload.accessToken;
        await (editingId.value
          ? updateQqbotAccount(payload)
          : createQqbotAccount(payload));
        message.success('账号保存成功');
        modalOpen.value = false;
        await tableApi.reload();
      } finally {
        saving.value = false;
      }
    }

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as QqbotApi.Account;
              if (column.key === 'connectStatus') {
                return (
                  <Tag
                    color={
                      row.connectStatus === 'online' ? 'success' : 'default'
                    }
                  >
                    {row.connectStatus === 'online' ? '在线' : '离线'}
                  </Tag>
                );
              }
              return undefined;
            },
          }}
        />
        <AModal
          destroyOnClose
          footer={[
            <AButton key="close" onClick={closeScanModal}>
              关闭
            </AButton>,
            <AButton
              disabled={!scanState.sessionId}
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
          ]}
          onCancel={closeScanModal}
          {...{
            'onUpdate:open': (value: boolean) => {
              if (value) {
                scanModalOpen.value = value;
                return;
              }
              closeScanModal();
            },
          }}
          open={scanModalOpen.value}
          title={scanTitle.value}
          width="520px"
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
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {scanQrcodeText.value ? (
                <img
                  alt="qqbot-login-qrcode"
                  src={scanQrcode.value}
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
                  二维码生成中
                </div>
              )}
            </div>
            {scanQrcodeText.value ? (
              <ATypographyLink href={scanQrcodeText.value} target="_blank">
                打开扫码链接
              </ATypographyLink>
            ) : null}
          </Space>
        </AModal>
        <AModal
          confirmLoading={saving.value}
          onOk={submitAccount}
          {...{
            'onUpdate:open': (value: boolean) => {
              modalOpen.value = value;
            },
          }}
          open={modalOpen.value}
          title={modalTitle.value}
          width="620px"
        >
          <Form labelCol={{ span: 5 }} model={form} wrapperCol={{ span: 18 }}>
            <FormItem label="Self ID" required>
              <AInput
                {...{
                  'onUpdate:value': (value: string) => {
                    form.selfId = value;
                  },
                }}
                placeholder="NapCat 当前登录 QQ"
                value={form.selfId}
              />
            </FormItem>
            <FormItem label="账号名称">
              <AInput
                {...{
                  'onUpdate:value': (value: string) => {
                    form.name = value;
                  },
                }}
                placeholder="便于后台识别"
                value={form.name}
              />
            </FormItem>
            <FormItem label="Token">
              <AInput.Password
                {...{
                  'onUpdate:value': (value: string) => {
                    form.accessToken = value;
                  },
                }}
                placeholder={
                  editingId.value ? '留空表示不修改' : 'OneBot 反向 WS token'
                }
                value={form.accessToken}
              />
            </FormItem>
            <FormItem label="启用">
              <ASwitch
                checked={form.enabled}
                {...{
                  'onUpdate:checked': (value: boolean) => {
                    form.enabled = value;
                  },
                }}
              />
            </FormItem>
            <FormItem label="备注">
              <AInput
                {...{
                  'onUpdate:value': (value: string) => {
                    form.remark = value;
                  },
                }}
                value={form.remark}
              />
            </FormItem>
          </Form>
        </AModal>
      </Page>
    );
  },
});
