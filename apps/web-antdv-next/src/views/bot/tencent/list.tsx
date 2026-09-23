import type { TableColumnType } from 'antdv-next';

import type { BotApi } from '#/api/bot';
import type { TencentBotApi } from '#/api/bot/tencent';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/kt-table';

import { computed, defineComponent, onBeforeUnmount, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import {
  Alert,
  Button,
  Empty,
  message,
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  bindTencentPlugin,
  deleteTencentBot,
  getTencentBotList,
  getTencentPluginBindings,
  getTencentWebhookUrl,
  reconnectTencentBot,
  saveTencentBot,
  syncTencentMenu,
  unbindTencentPlugin,
  updateTencentBot,
} from '#/api/bot/tencent';
import { KtTable, useKtTable } from '#/components/kt-table';

const AKtTable = KtTable as any;
const AAlert = Alert as any;
const AButton = Button as any;
const AEmpty = Empty as any;
const ATypographyText = Typography.Text as any;

export default defineComponent({
  name: 'TencentConnectionList',
  setup() {
    const editingId = ref<string>();
    const pluginAccount = ref<BotApi.Account>();
    const pluginBindings = ref<TencentBotApi.PluginBinding[]>([]);
    const pluginLoading = ref(false);
    const pluginWriteBusy = ref(false);
    const pluginError = ref('');
    const pendingPluginWrites = new Set<string>();
    let pluginSession = 0;
    let pluginReadGeneration = 0;
    let pluginOpen = false;
    let disposed = false;

    const [ConnectionForm, connectionFormApi] = useVbenForm({
      commonConfig: { labelClass: 'w-24' },
      layout: 'horizontal',
      schema: [
        {
          component: 'Select',
          componentProps: {
            options: [
              { label: 'WebSocket', value: 'official-websocket' },
              { label: 'Webhook', value: 'official-webhook' },
            ],
            placeholder: '选择事件接收方式',
          },
          fieldName: 'connectionMode',
          label: '连接方式',
          rules: 'required',
        },
        {
          component: 'Input',
          componentProps: {
            autocomplete: 'off',
            placeholder: 'QQ 开放平台 AppID',
          },
          fieldName: 'appId',
          label: 'AppID',
          rules: 'required',
        },
        {
          component: 'InputPassword',
          componentProps: () => ({
            autocomplete: 'new-password',
            placeholder: (() => {
              if (editingId.value) return '留空表示不修改';
              return 'QQ 开放平台 AppSecret';
            })(),
          }),
          fieldName: 'appSecret',
          label: 'AppSecret',
        },
        {
          component: 'Input',
          componentProps: { placeholder: '便于后台识别' },
          fieldName: 'name',
          label: '名称',
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
      { dataIndex: 'officialAppId', key: 'appId', title: 'AppID', width: 180 },
      { dataIndex: 'name', key: 'name', title: '名称', width: 160 },
      {
        dataIndex: 'connectionMode',
        key: 'connectionMode',
        title: '连接方式',
        width: 140,
      },
      {
        dataIndex: 'connectStatus',
        key: 'connectStatus',
        title: '状态',
        width: 110,
      },
      {
        dataIndex: 'lastHeartbeatAt',
        key: 'lastHeartbeatAt',
        title: '最近活动',
        width: 180,
      },
      {
        dataIndex: 'lastError',
        ellipsis: true,
        key: 'lastError',
        title: '运行说明',
        width: 240,
      },
    ];
    const api: KtTableApi<BotApi.Account> = {
      list: async (params) => await getTencentBotList(params),
    };
    const buttons: Array<KtTableButton<BotApi.Account>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: '新增 Tencent 连接',
        onClick: openCreate,
        permissionCodes: ['Bot:Tencent:Create'],
        type: 'primary',
      },
    ];
    const rowActions: KtTableRowAction<BotApi.Account>[] = [
      {
        key: 'plugins',
        label: '插件能力',
        icon: <IconifyIcon icon="lucide:plug-zap" />,
        permissionCodes: ['Bot:Tencent:Plugin'],
        onClick: openPlugins,
      },
      {
        key: 'reconnect',
        label: '重连',
        icon: <IconifyIcon icon="lucide:refresh-cw" />,
        permissionCodes: ['Bot:Tencent:Reconnect'],
        onClick: async (row, context) => {
          await reconnectTencentBot(row.id);
          message.success('Tencent 连接已重新准备');
          await context.reload();
        },
      },
      {
        key: 'menu-sync',
        label: '同步官方菜单',
        icon: <IconifyIcon icon="lucide:panel-top" />,
        permissionCodes: ['Bot:Tencent:MenuSync'],
        onClick: async (row) => {
          await syncTencentMenu(row.id);
          message.success('Tencent 官方菜单已同步');
        },
      },
      {
        key: 'webhook-url',
        label: '复制 Webhook 回调',
        icon: <IconifyIcon icon="lucide:copy" />,
        permissionCodes: ['Bot:Tencent:WebhookUrl'],
        rowVisible: (row) => row.connectionMode === 'official-webhook',
        onClick: async (row) => {
          const result = await getTencentWebhookUrl(row.id);
          await navigator.clipboard.writeText(result.url);
          message.success('Webhook 回调地址已复制');
        },
      },
      {
        key: 'edit',
        label: '编辑',
        icon: <IconifyIcon icon="lucide:pencil" />,
        permissionCodes: ['Bot:Tencent:Edit'],
        onClick: openEdit,
      },
      {
        key: 'delete',
        label: '删除',
        icon: <IconifyIcon icon="lucide:trash-2" />,
        permissionCodes: ['Bot:Tencent:Delete'],
        danger: true,
        confirm: (row) =>
          `确认删除 Tencent 连接“${row.name || row.officialAppId}”吗？`,
        onClick: async (row, context) => {
          await deleteTencentBot(row.id);
          message.success('Tencent 连接已删除');
          await context.reload();
        },
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
            componentProps: { allowClear: true, placeholder: 'AppID / 名称' },
            fieldName: 'name',
            label: '关键词',
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
            label: '状态',
          },
        ],
      },
      rowActions,
      tableTitle: 'Tencent Bot 连接',
    });

    const [ConnectionModal, connectionModalApi] = useVbenModal({
      class: 'w-[620px]',
      fullscreenButton: false,
      /** 将当前表单校验并提交后关闭连接弹窗。 */
      async onConfirm() {
        await submitConnection();
      },
      /**
       * 仅在弹窗打开时恢复待编辑值，关闭事件不重置用户输入。
       * @param open - 当前弹窗是否进入打开状态。
       */
      onOpenChange(open: boolean) {
        if (!open) return;
        const data = connectionModalApi.getData<{
          values?: BotApi.AccountBody;
        }>();
        void resetConnectionForm(data.values || defaultConnectionValues());
      },
    });
    const [PluginModal, pluginModalApi] = useVbenModal({
      class: 'w-[720px]',
      footer: false,
      fullscreenButton: false,
      /**
       * 关闭弹窗时使旧读取失效；在途写入仍按其原账号完成。
       * @param open - 插件弹窗当前是否打开。
       */
      onOpenChange(open: boolean) {
        if (open) return;
        pluginOpen = false;
        pluginSession += 1;
        pluginReadGeneration += 1;
        pluginAccount.value = undefined;
        pluginBindings.value = [];
        pluginLoading.value = false;
        pluginWriteBusy.value = false;
        pluginError.value = '';
      },
    });
    const modalTitle = computed(() => {
      if (editingId.value) return '编辑 Tencent 连接';
      return '新增 Tencent 连接';
    });
    const pluginTitle = computed(() => {
      const account = pluginAccount.value;
      if (!account) return '插件能力';
      return `插件能力 · ${account.name.trim() || account.officialAppId || account.id}`;
    });

    /**
     * 打开 Tencent 新建弹窗并清空编辑上下文。
     */
    function openCreate() {
      editingId.value = undefined;
      connectionModalApi.setData({ values: defaultConnectionValues() });
      connectionModalApi.open();
    }

    /**
     * 将选中账号转换为无密文的编辑表单并打开弹窗。
     * @param row - 当前 Tencent 账号。
     */
    function openEdit(row: BotApi.Account) {
      editingId.value = row.id;
      connectionModalApi.setData({
        values: {
          appId: row.officialAppId || '',
          appSecret: '',
          connectionMode: row.connectionMode,
          enabled: row.enabled,
          name: row.name,
          remark: row.remark || '',
        },
      });
      connectionModalApi.open();
    }

    /**
     * 校验并保存 Tencent 连接；编辑时空 AppSecret 保持服务端现值。
     */
    async function submitConnection() {
      const valid = await connectionFormApi.validate();
      if (!valid.valid) return;
      const values = await connectionFormApi.getValues<BotApi.AccountBody>();
      const payload = { ...values };
      if (!`${payload.appSecret || ''}`.trim()) delete payload.appSecret;
      if (editingId.value) {
        await updateTencentBot({ ...payload, id: editingId.value });
        message.success('Tencent 连接已更新');
      } else {
        if (!payload.appSecret) {
          message.warning('请填写 AppSecret');
          return;
        }
        await saveTencentBot(payload);
        message.success('Tencent 连接已创建');
      }
      connectionModalApi.close();
      await tableApi.reload();
    }

    /**
     * 重置 Tencent 连接表单并清除上一轮校验状态。
     * @param values - 新的完整表单值。
     */
    async function resetConnectionForm(values: BotApi.AccountBody) {
      await connectionFormApi.resetForm();
      await connectionFormApi.setValues(values);
      connectionFormApi.resetValidate();
    }

    /**
     * 为新增 Tencent 连接提供启用的 WebSocket 初始值，且不预填任何凭据。
     * @returns 默认 WebSocket 且启用的表单值。
     */
    function defaultConnectionValues(): BotApi.AccountBody {
      return {
        appId: '',
        appSecret: '',
        connectionMode: 'official-websocket',
        enabled: true,
        name: '',
        remark: '',
      };
    }

    /**
     * 打开目标账号的新弹窗会话，并清除上一账号的插件展示状态。
     * @param row - 当前 Tencent 账号。
     */
    function openPlugins(row: BotApi.Account) {
      pluginSession += 1;
      pluginOpen = true;
      pluginAccount.value = row;
      pluginBindings.value = [];
      pluginError.value = '';
      pluginWriteBusy.value = pendingPluginWrites.has(row.id);
      pluginModalApi.open();
      void loadPluginBindings(row.id, pluginSession);
    }

    /**
     * 只为仍打开且身份匹配的弹窗会话接纳读取结果。
     * @param accountId - 本次读取绑定的 Tencent 账号标识。
     * @param session - 发起读取时的弹窗会话序号。
     * @returns 当前弹窗仍归属该账号和会话时为 true。
     */
    function isCurrentPluginSession(accountId: string, session: number) {
      return (
        !disposed &&
        pluginOpen &&
        pluginSession === session &&
        pluginAccount.value?.id === accountId
      );
    }

    /**
     * 按账号和读取序号提交绑定目录，失败时只提示当前会话重试。
     * @param accountId - 本次读取的 Tencent 账号标识。
     * @param session - 发起读取时的弹窗会话序号。
     */
    async function loadPluginBindings(accountId: string, session: number) {
      if (!isCurrentPluginSession(accountId, session)) return;
      const request = ++pluginReadGeneration;
      pluginLoading.value = true;
      pluginError.value = '';
      try {
        const bindings = await getTencentPluginBindings(accountId);
        if (!isCurrentPluginSession(accountId, session)) return;
        if (request !== pluginReadGeneration) return;
        pluginBindings.value = bindings;
      } catch {
        if (!isCurrentPluginSession(accountId, session)) return;
        if (request !== pluginReadGeneration) return;
        pluginBindings.value = [];
        pluginError.value = '插件能力读取失败，请重试。';
      } finally {
        if (
          isCurrentPluginSession(accountId, session) &&
          request === pluginReadGeneration
        )
          pluginLoading.value = false;
      }
    }

    /**
     * 固定点击时的账号执行绑定写入，只给当前展示账号回读最终事实。
     * @param plugin - 当前插件候选。
     * @param enabled - 目标绑定状态。
     */
    async function togglePlugin(
      plugin: TencentBotApi.PluginBinding,
      enabled: boolean,
    ) {
      const account = pluginAccount.value;
      if (!account || !pluginOpen || disposed) return;
      if (pendingPluginWrites.has(account.id)) return;
      const accountId = account.id;
      pendingPluginWrites.add(accountId);
      pluginWriteBusy.value = true;
      try {
        if (enabled) {
          await bindTencentPlugin(accountId, plugin.pluginKey);
        } else {
          await unbindTencentPlugin(accountId, plugin.pluginKey);
        }
        message.success('插件能力与 Tencent 官方菜单已同步');
      } catch {
        // 请求层已呈现写入失败，仍需回读可能变化的服务端事实。
      } finally {
        pendingPluginWrites.delete(accountId);
        if (pluginOpen && !disposed && pluginAccount.value?.id === accountId) {
          pluginWriteBusy.value = pendingPluginWrites.has(accountId);
          await loadPluginBindings(accountId, pluginSession);
        }
      }
    }

    /**
     * 按当前账号重新读取插件目录，重试不复用上一次错误结果。
     */
    function retryPluginBindings() {
      const account = pluginAccount.value;
      if (!account) return;
      void loadPluginBindings(account.id, pluginSession);
    }

    /**
     * 区分读取错误、成功空目录与当前账号的插件绑定列表。
     * @returns 当前弹窗所需的错误、空态或绑定节点。
     */
    function renderPluginBindings() {
      if (pluginError.value) {
        return (
          <AAlert
            action={<AButton onClick={retryPluginBindings}>重试</AButton>}
            showIcon
            title={pluginError.value}
            type="warning"
          />
        );
      }
      if (!pluginLoading.value && pluginBindings.value.length === 0) {
        return <AEmpty description="暂无插件能力" />;
      }
      return (
        <div class="space-y-2">
          {pluginBindings.value.map((item) => (
            <div
              class="flex items-center justify-between rounded-lg border border-border px-4 py-3"
              key={item.pluginKey}
            >
              <div class="min-w-0 pr-4">
                <div class="font-medium">
                  {item.pluginName} · {item.version}
                </div>
                <ATypographyText type="secondary">
                  {item.description || item.pluginKey}
                </ATypographyText>
              </div>
              <Switch
                checked={item.bound}
                disabled={pluginLoading.value || pluginWriteBusy.value}
                onChange={(checked: boolean) =>
                  void togglePlugin(item, checked)
                }
              />
            </div>
          ))}
        </div>
      );
    }

    onBeforeUnmount(() => {
      disposed = true;
      pluginOpen = false;
      pluginSession += 1;
      pluginReadGeneration += 1;
    });

    /**
     * 把连接状态转换为中文语义标签。
     * @param row - 当前 Tencent 账号。
     * @returns 在线或离线状态标签。
     */
    function renderConnectionStatus(row: BotApi.Account) {
      if (row.connectStatus === 'online') {
        return <Tag color="success">在线</Tag>;
      }
      return <Tag color="default">离线</Tag>;
    }

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as BotApi.Account;
              if (column.key === 'appId') {
                return (
                  <ATypographyText code>{row.officialAppId}</ATypographyText>
                );
              }
              if (column.key === 'connectionMode') {
                if (row.connectionMode === 'official-webhook') {
                  return <Tag color="cyan">Webhook</Tag>;
                }
                return <Tag color="purple">WebSocket</Tag>;
              }
              if (column.key === 'connectStatus') {
                return renderConnectionStatus(row);
              }
              return undefined;
            },
          }}
        />
        <ConnectionModal title={modalTitle.value}>
          <ConnectionForm class="mx-2" />
        </ConnectionModal>
        <PluginModal title={pluginTitle.value}>
          <Spin spinning={pluginLoading.value || pluginWriteBusy.value}>
            {renderPluginBindings()}
          </Spin>
        </PluginModal>
      </Page>
    );
  },
});
