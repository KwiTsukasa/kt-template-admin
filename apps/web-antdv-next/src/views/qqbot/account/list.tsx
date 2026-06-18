import type { TableColumnType } from 'antdv-next';

import type { NapcatLoginModalExposed } from './napcat/NapcatLoginModal';

import type { QqbotApi } from '#/api/qqbot';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/ktTable';

import { computed, defineComponent, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Space, Tag, Typography } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createQqbotAccount,
  deleteQqbotAccount,
  getQqbotAccountList,
  kickQqbotAccount,
  updateQqbotAccount,
} from '#/api/qqbot';
import { KtTable, useKtTable } from '#/components/ktTable';

import NapcatLoginModal from './napcat/NapcatLoginModal';
import NapcatRuntimeProfileDrawer from './napcat/NapcatRuntimeProfileDrawer';

const AKtTable = KtTable as any;
const ATypographyText = Typography.Text as any;

export default defineComponent({
  name: 'QqBotAccountList',
  setup() {
    const editingId = ref<string>();
    const napcatLoginRef = ref<NapcatLoginModalExposed>();
    const runtimeProfileAccount = ref<QqbotApi.Account>();
    const runtimeProfileOpen = ref(false);
    const router = useRouter();

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
        key: 'runtimeProfile',
        label: '运行态',
        onClick: openRuntimeProfile,
        permissionCodes: ['QqBot:Account:Config'],
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

    async function openScanCreate() {
      await napcatLoginRef.value?.openCreate();
    }

    async function openScanRefresh(row: QqbotApi.Account) {
      await napcatLoginRef.value?.openRefresh(row);
    }

    function openRuntimeProfile(row: QqbotApi.Account) {
      runtimeProfileAccount.value = row;
      runtimeProfileOpen.value = true;
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
        <NapcatLoginModal
          onSuccess={() => {
            void tableApi.reload();
          }}
          ref={napcatLoginRef as any}
        />
        <NapcatRuntimeProfileDrawer
          account={runtimeProfileAccount.value}
          onUpdate:open={(open: boolean) => {
            runtimeProfileOpen.value = open;
          }}
          open={runtimeProfileOpen.value}
        />
        <AccountModal title={modalTitle.value}>
          <AccountForm class="mx-2" />
        </AccountModal>
      </Page>
    );
  },
});
