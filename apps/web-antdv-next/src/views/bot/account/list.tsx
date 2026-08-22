import type { TableColumnType } from 'antdv-next';

import type { NapcatLoginModalExposed } from './napcat/NapcatLoginModal';

import type { BotApi } from '#/api/bot';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/kt-table';

import { computed, defineComponent, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Space, Tag, Typography } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createBotAccount,
  deleteBotAccount,
  getBotAccountList,
  kickBotAccount,
  updateBotAccount,
} from '#/api/bot';
import { KtTable, useKtTable } from '#/components/kt-table';

import NapcatLoginModal from './napcat/NapcatLoginModal';
import NapcatRuntimeProfileDrawer from './napcat/NapcatRuntimeProfileDrawer';

const AKtTable = KtTable as any;
const ATypographyText = Typography.Text as any;

export default defineComponent({
  name: 'BotNapcatConnectionList',
  setup() {
    const editingId = ref<string>();
    const napcatLoginRef = ref<NapcatLoginModalExposed>();
    const runtimeProfileAccount = ref<BotApi.Account>();
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
          label: 'QQ 号',
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
            placeholder: (() => {
              if (editingId.value) {
                return '留空表示不修改';
              }
              return 'OneBot 反向 WS token';
            })(),
          }),
          fieldName: 'accessToken',
          label: 'Token',
        },
        {
          component: 'InputPassword',
          componentProps: () => ({
            placeholder: (() => {
              if (editingId.value) {
                return '留空表示不修改 QQ 登录密码';
              }
              return '可选，用于 NapCat 密码登录';
            })(),
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

    const columns: Array<TableColumnType<BotApi.Account>> = [
      {
        dataIndex: 'selfId',
        key: 'accountIdentity',
        title: '账号标识',
        width: 210,
      },
      { dataIndex: 'name', key: 'name', title: '账号名称', width: 150 },
      {
        dataIndex: 'connectionMode',
        key: 'connectionMode',
        title: '接入方式',
        width: 160,
      },
      {
        dataIndex: 'connectStatus',
        key: 'accountOnlineStatus',
        title: '连接状态',
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

    const api: KtTableApi<BotApi.Account> = {
      list: async (params) => await getBotAccountList(params),
    };
    const buttons: Array<KtTableButton<BotApi.Account>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'scanCreate',
        label: '扫码新增 NapCat',
        onClick: openScanCreate,
        permissionCodes: ['Bot:Account:Create'],
        type: 'primary',
      },
      {
        key: 'manualCreate',
        label: '新增账号',
        onClick: openCreate,
        permissionCodes: ['Bot:Account:Create'],
      },
    ];
    const rowActions: Array<KtTableRowAction<BotApi.Account>> = [
      {
        key: 'config',
        label: '配置',
        onClick: openConfig,
        permissionCodes: ['Bot:Account:Config'],
        rowVisible: true,
      },
      {
        key: 'refreshLogin',
        label: '更新登录',
        onClick: openScanRefresh,
        permissionCodes: ['Bot:Account:RefreshLogin'],
        rowVisible: isNapcatAccount,
      },
      {
        key: 'runtimeProfile',
        label: '运行态',
        onClick: openRuntimeProfile,
        permissionCodes: ['Bot:Account:Config'],
        rowVisible: isNapcatAccount,
      },
      {
        key: 'napcatWebui',
        label: 'WebUI',
        onClick: openNapcatWebui,
        permissionCodes: ['Bot:Account:WebUI'],
        rowVisible: (row) =>
          isNapcatAccount(row) &&
          !!row.napcat?.containerName &&
          getWebuiStatus(row) === 'online',
      },
      {
        confirm: getDeleteConfirmation,
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: async (row, context) => {
          const result = await deleteBotAccount(row.id);
          message.success(
            (() => {
              if (result.deletedContainers > 0) {
                return `账号删除成功，已删除 ${result.deletedContainers} 个 NapCat 容器`;
              }
              return '账号删除成功';
            })(),
          );
          await context.reload();
        },
        permissionCodes: ['Bot:Account:Delete'],
        rowVisible: true,
      },
      {
        key: 'kick',
        label: '断开',
        onClick: async (row, context) => {
          await kickBotAccount(row.selfId);
          message.success('连接已断开');
          await context.reload();
        },
        permissionCodes: ['Bot:Account:Kick'],
        rowVisible: isAccountConnected,
      },
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        permissionCodes: ['Bot:Account:Edit'],
        rowVisible: true,
      },
    ];
    const [registerTable, tableApi] = useKtTable<BotApi.Account>({
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
      tableTitle: 'NapCat 连接',
    });
    const modalTitle = computed(() => {
      if (editingId.value) {
        return '编辑账号';
      }
      return '新建账号';
    });

    const [AccountModal, accountModalApi] = useVbenModal({
      class: 'w-[620px]',
      fullscreenButton: false,
      /**
       * 确认账号弹窗时校验并提交 Bot 账号配置。
       */
      async onConfirm() {
        await submitAccount();
      },
      /**
       * 仅在账号弹窗打开时读取上下文值，并重置账号字段与校验状态。
       *
       * @param isOpen - 弹窗或抽屉最新显隐状态；true 表示已打开。
       */
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = accountModalApi.getData<{
          values?: BotApi.AccountBody;
        }>();
        void resetAccountForm(values || getAccountFormDefaults());
      },
    });

    /**
     * 通过调用 NapCat 登录组件启动新增 Bot 账号扫码流程。
     */
    async function openScanCreate() {
      await napcatLoginRef.value?.openCreate();
    }

    /**
     * 把选中 Bot 账号作为上下文，启动更新登录状态的扫码流程。
     *
     * @param row - 需要通过 NapCat 扫码刷新登录态的 Bot 账号。
     */
    async function openScanRefresh(row: BotApi.Account) {
      await napcatLoginRef.value?.openRefresh(row);
    }

    /**
     * 保存选中 Bot 账号并打开 NapCat 运行态资料抽屉。
     *
     * @param row - 需要在抽屉中展示 NapCat 协议、风险和运行配置的 Bot 账号。
     */
    function openRuntimeProfile(row: BotApi.Account) {
      runtimeProfileAccount.value = row;
      runtimeProfileOpen.value = true;
    }

    /**
     * 返回 NapCat 账号与专属容器一并删除的确认文案。
     *
     * @param row - 即将删除的 Bot 账号。
     * @returns 包含专属容器影响的确认文案。
     */
    function getDeleteConfirmation(row: BotApi.Account) {
      return `确认删除账号「${row.selfId}」吗？该操作会同时删除该账号专属的 NapCat 容器。`;
    }

    /**
     * 判断账号是否通过 NapCat OneBot 反向 WebSocket 接入。
     *
     * @param row - 待判断的 Bot 账号。
     * @returns 接入方式为 reverse-ws 时返回 true。
     */
    function isNapcatAccount(row: BotApi.Account) {
      return row.connectionMode === 'reverse-ws';
    }

    /**
     * 按 transport 判断账号是否存在可主动断开的在线连接。
     *
     * @param row - 待判断连接状态的 Bot 账号。
     * @returns NapCat OneBot 在线时返回 true。
     */
    function isAccountConnected(row: BotApi.Account) {
      return getOneBotStatus(row) === 'online';
    }

    /**
     * 将 NapCat 当前登录 QQ 号作为该连接的唯一身份文本展示。
     *
     * @param row - 需要展示身份的 Bot 账号。
     * @returns QQ 号节点。
     */
    function renderAccountIdentity(row: BotApi.Account) {
      return <span>{row.selfId}</span>;
    }

    /**
     * 按 NapCat 页面边界把 reverse-ws 接入统一投影为 OneBot 标签。
     *
     * @param connectionMode - Bot 账号接入方式。
     * @returns 固定 NapCat OneBot 标签。
     */
    function getConnectionModeLabel(connectionMode: BotApi.ConnectionMode) {
      void connectionMode;
      return 'NapCat OneBot';
    }

    /**
     * 将 NapCat transport 以固定颜色标签呈现，避免与 Tencent 连接混淆。
     *
     * @param row - 需要展示接入方式的 Bot 账号。
     * @returns 带 transport 中文名称的状态标签。
     */
    function renderConnectionMode(row: BotApi.Account) {
      return (
        <Tag color="blue">{getConnectionModeLabel(row.connectionMode)}</Tag>
      );
    }

    const renderAccountOnlineStatus = (row: BotApi.Account) => {
      if (!row.enabled) {
        return <Tag color="default">已停用</Tag>;
      }
      const online = isAccountConnected(row);
      const label = (() => {
        return 'OneBot';
      })();
      return (
        <Tag
          color={(() => {
            if (online) {
              return 'success';
            }
            return 'default';
          })()}
        >
          {(() => {
            if (online) {
              return `${label} 在线`;
            }
            return `${label} 离线`;
          })()}
        </Tag>
      );
    };

    const renderQqLoginStatus = (row: BotApi.Account) => {
      const meta = getQqLoginStatusMeta(row);
      const message = getQqLoginMessage(row);
      return (
        <Space orientation="vertical" size={2}>
          <Tag color={meta.color}>{meta.label}</Tag>
          {(() => {
            if (message) {
              return (
                <ATypographyText type="secondary">{message}</ATypographyText>
              );
            }
            return null;
          })()}
        </Space>
      );
    };

    const renderNapcatRuntime = (row: BotApi.Account) => {
      const napcat = row.napcat;
      const meta = getNapcatStatusMeta(row);
      const webuiMeta = getNapcatWebuiMeta(row);
      return (
        <Space orientation="vertical" size={2}>
          <Space size={4} wrap>
            <Tag color={meta.color}>{meta.label}</Tag>
            <Tag color={webuiMeta.color}>{webuiMeta.label}</Tag>
          </Space>
          {(() => {
            if (napcat?.containerName) {
              return (
                <ATypographyText type="secondary">
                  {napcat.containerName}
                  {(() => {
                    if (napcat.webuiPort) {
                      return `:${napcat.webuiPort}`;
                    }
                    return '';
                  })()}
                </ATypographyText>
              );
            }
            return null;
          })()}
        </Space>
      );
    };

    const renderRecentActivity = (row: BotApi.Account) => {
      const active = getRecentActivity(row);
      return (
        <Space orientation="vertical" size={2}>
          <span>{active.label}</span>
          <ATypographyText type="secondary">
            {active.time || '暂无记录'}
          </ATypographyText>
        </Space>
      );
    };

    const renderRuntimeSummary = (row: BotApi.Account) => {
      const summary = getRuntimeSummary(row);
      return (
        <ATypographyText
          title={summary.text}
          type={(() => {
            if (summary.level === 'warning') {
              return 'warning';
            }
            return undefined;
          })()}
        >
          {summary.text}
        </ATypographyText>
      );
    };

    /**
     * 根据容器绑定与运行状态显示未绑定、缺失、创建中、异常、运行中或已停止。
     *
     * @param row - 需要投影 NapCat 容器展示状态的 Bot 账号。
     * @returns NapCat 容器状态对应的标签、颜色与状态值。
     */
    function getNapcatStatusMeta(row: BotApi.Account) {
      const status = row.containerStatus || row.napcat?.containerStatus;
      if (!row.napcat && !status) {
        return { color: 'default', label: '未绑定专属容器' };
      }
      if (!status) {
        return { color: 'warning', label: '容器记录缺失' };
      }
      const statusMap: Record<
        NonNullable<BotApi.AccountNapcatRuntime['containerStatus']>,
        { color: string; label: string }
      > = {
        creating: { color: 'processing', label: '容器创建中' },
        error: { color: 'error', label: '容器异常' },
        running: { color: 'success', label: '容器运行中' },
        stopped: { color: 'default', label: '容器已停止' },
      };
      return statusMap[status];
    }

    /**
     * 根据账号绑定和 WebUI 状态显示未绑定、可用、不可用或未检查。
     *
     * @param row - 需要投影 WebUI 会话展示状态的 Bot 账号。
     * @returns NapCat WebUI 状态对应的标签、颜色与状态值。
     */
    function getNapcatWebuiMeta(row: BotApi.Account) {
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

    /**
     * 根据账号容器与 QQ 登录状态显示在线、离线、等待扫码、二维码过期或未知。
     *
     * @param row - 需要投影 QQ 登录展示状态的 Bot 账号。
     * @returns QQ 登录状态对应的标签、颜色与可选说明。
     */
    function getQqLoginStatusMeta(row: BotApi.Account) {
      if (!row.napcat && !row.qqLoginStatus) {
        return { color: 'default', label: '未绑定容器' };
      }
      const statusMap: Record<
        BotApi.QqLoginStatus,
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

    /**
     * 优先采用显式 OneBot 状态，其次根据 NapCat 与账号连接状态回退为在线或离线。
     *
     * @param row - 需要读取 OneBot 连接状态的 Bot 账号。
     * @returns 归一后的 OneBot 在线或离线状态。
     */
    function getOneBotStatus(row: BotApi.Account): BotApi.OneBotStatus {
      if (row.oneBotStatus) return row.oneBotStatus;
      if (row.napcat?.oneBotOnline !== undefined) {
        if (row.napcat.oneBotOnline) {
          return 'online';
        }
        return 'offline';
      }
      if (row.connectStatus === 'online') {
        return 'online';
      }
      return 'offline';
    }

    /**
     * 优先采用显式 WebUI 状态，其次根据 NapCat 在线标志回退；缺少信息时返回未知。
     *
     * @param row - 需要读取 NapCat WebUI 状态的 Bot 账号。
     * @returns 归一后的 WebUI 在线、离线或未知状态。
     */
    function getWebuiStatus(row: BotApi.Account): BotApi.WebuiStatus {
      if (row.webuiStatus) return row.webuiStatus;
      if (row.napcat?.webuiOnline === true) return 'online';
      if (row.napcat?.webuiOnline === false) return 'offline';
      return 'unknown';
    }

    /**
     * 优先采用账号级 QQ 登录状态，其次使用 NapCat 状态，均缺失时返回未知。
     *
     * @param row - 需要读取 QQ 登录状态的 Bot 账号。
     * @returns 归一后的 QQ 登录状态；所有来源都缺失时为 `unknown`。
     */
    function getQqLoginStatus(row: BotApi.Account): BotApi.QqLoginStatus {
      return row.qqLoginStatus || row.napcat?.qqLoginStatus || 'unknown';
    }

    /**
     * 优先读取账号级 QQ 登录提示，缺失时使用 NapCat 运行态提示。
     *
     * @param row - 需要读取登录提示或错误文本的 Bot 账号。
     * @returns 账号级或 NapCat 运行态的 QQ 登录提示；均缺失时返回 undefined。
     */
    function getQqLoginMessage(row: BotApi.Account) {
      return row.qqLoginMessage ?? row.napcat?.qqLoginMessage;
    }

    /**
     * 通过比较账号心跳、连接、扫码登录与容器启动时间，返回最近一项的标签和格式化时间。
     *
     * @param row - 需要比较心跳、连接、登录与启动时间的 Bot 账号。
     * @returns 最近一项账号活动的标签和格式化时间；无活动时使用“暂无活动”和空时间。
     */
    function getRecentActivity(row: BotApi.Account) {
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
        time: (() => {
          if (latest?.value) {
            return formatDisplayTime(latest.value);
          }
          return '';
        })(),
      };
    }

    /**
     * 根据停用、错误、QQ 登录、OneBot 与容器状态优先级生成账号运行态摘要。
     *
     * @param row - 需要汇总停用、容器、QQ 与 OneBot 状态的 Bot 账号。
     * @returns 账号当前最高优先级运行说明及其普通或警告等级。
     */
    function getRuntimeSummary(row: BotApi.Account) {
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

    /**
     * 把有效时间转换为中文二十四小时制本地时间，无效输入保持原文本。
     *
     * @param value - 账号活动时间的日期字符串、时间戳或空值。
     * @returns 格式化后的本地时间文本；输入缺失或无效时返回占位符。
     */
    function formatDisplayTime(value: string) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleString('zh-CN', { hour12: false });
    }

    /**
     * 按反向 WebSocket、默认启用和空凭据约束预置 Bot 新建表单。
     *
     * @returns 不含既有账号身份、可直接写入新建弹窗的完整初值。
     */
    function getAccountFormDefaults(): BotApi.AccountBody {
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

    /**
     * 清空 Bot 账号表单后写入目标字段值，并移除上一轮校验错误。
     *
     * @param values - 重置后要写入 Bot 账号表单的完整字段。
     */
    async function resetAccountForm(values: BotApi.AccountBody) {
      await accountFormApi.resetForm();
      await accountFormApi.setValues(values);
      await accountFormApi.resetValidate();
    }

    /**
     * 清除账号编辑标识，并用默认连接模式与空凭据打开新建弹窗。
     */
    function openCreate() {
      editingId.value = undefined;
      accountModalApi.setData({ values: getAccountFormDefaults() }).open();
    }

    /**
     * 将 Bot Self ID 写入路由参数并跳转到账号配置页。
     *
     * @param row - 需要跳转到命令、规则与消息推送配置页的 Bot 账号。
     */
    function openConfig(row: BotApi.Account) {
      void router.push({
        name: 'BotNapcatConfig',
        query: {
          selfId: row.selfId,
        },
      });
    }

    /**
     * 将账号标识写入路由参数并跳转到 NapCat WebUI 会话页。
     *
     * @param row - 要打开 NapCat WebUI 会话的 Bot 账号。
     */
    function openNapcatWebui(row: BotApi.Account) {
      void router.push({
        name: 'BotNapcatWebui',
        params: { accountId: row.id },
      });
    }

    /**
     * 把账号连接、启用状态和基础资料写入表单，并清空敏感凭据字段后打开弹窗。
     *
     * @param row - 要加载到账号编辑弹窗的 Bot 账号记录。
     */
    function openEdit(row: BotApi.Account) {
      editingId.value = row.id;
      accountModalApi
        .setData({
          values: {
            accessToken: '',
            connectionMode: 'reverse-ws',
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

    /**
     * 校验 Bot 账号并按编辑标识新建或更新，空令牌与空密码不会提交，成功后刷新列表。
     */
    async function submitAccount() {
      const { valid } = await accountFormApi.validate();
      if (!valid) return;

      const values = await accountFormApi.getValues<BotApi.AccountBody>();
      const selfId = values.selfId?.trim() || '';
      if (!selfId) {
        message.warning('请填写 NapCat QQ 号');
        return;
      }

      accountModalApi.lock();
      try {
        const payload: BotApi.AccountBody = {
          ...values,
          connectionMode: 'reverse-ws',
          id: editingId.value,
          selfId,
        };
        await (() => {
          if (editingId.value) {
            return updateBotAccount(payload);
          }
          return createBotAccount(payload);
        })();
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
              const row = record as BotApi.Account;
              if (column.key === 'accountIdentity') {
                return renderAccountIdentity(row);
              }
              if (column.key === 'connectionMode') {
                return renderConnectionMode(row);
              }
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
