import type { TableColumnType } from 'antdv-next';

import type { BotApi } from '#/api/bot';
import type { TencentBotApi } from '#/api/bot/tencent';
import type { KtTableApi, KtTableButton } from '#/components/kt-table';

import { computed, defineComponent, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenModal } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import {
  Button,
  message,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
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
const ATypographyText = Typography.Text as any;

export default defineComponent({
  name: 'TencentConnectionList',
  setup() {
    const { hasAccessByCodes } = useAccess();
    const editingId = ref<string>();
    const pluginAccount = ref<BotApi.Account>();
    const pluginBindings = ref<TencentBotApi.PluginBinding[]>([]);
    const pluginLoading = ref(false);

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
          componentProps: { placeholder: 'QQ 开放平台 AppID' },
          fieldName: 'appId',
          label: 'AppID',
          rules: 'required',
        },
        {
          component: 'InputPassword',
          componentProps: () => ({
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
      {
        fixed: 'right',
        key: 'actions',
        title: '操作',
        width: 250,
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
      rowActions: [],
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
    });
    const modalTitle = computed(() => {
      if (editingId.value) return '编辑 Tencent 连接';
      return '新增 Tencent 连接';
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
     * 加载当前 Tencent 账号的协议插件绑定并打开能力弹窗。
     * @param row - 当前 Tencent 账号。
     */
    async function openPlugins(row: BotApi.Account) {
      pluginAccount.value = row;
      pluginLoading.value = true;
      pluginModalApi.open();
      try {
        pluginBindings.value = await getTencentPluginBindings(row.id);
      } finally {
        pluginLoading.value = false;
      }
    }

    /**
     * 根据目标状态切换适配器侧插件授权，并在同一请求后回读最新绑定目录。
     * @param plugin - 当前插件候选。
     * @param enabled - 目标绑定状态。
     */
    async function togglePlugin(
      plugin: TencentBotApi.PluginBinding,
      enabled: boolean,
    ) {
      const account = pluginAccount.value;
      if (!account) return;
      pluginLoading.value = true;
      try {
        if (enabled) {
          await bindTencentPlugin(account.id, plugin.pluginKey);
        } else {
          await unbindTencentPlugin(account.id, plugin.pluginKey);
        }
        pluginBindings.value = await getTencentPluginBindings(account.id);
        message.success('插件能力与 Tencent 官方菜单已同步');
      } finally {
        pluginLoading.value = false;
      }
    }

    /**
     * 渲染仅含语义图标和 Tooltip 的 Tencent 行操作栏。
     * @param row - 当前 Tencent 账号。
     * @returns 图标操作集合。
     */
    function renderActions(row: BotApi.Account) {
      const actions = [];
      if (hasAccessByCodes(['Bot:Tencent:Plugin'])) {
        actions.push(
          iconAction('lucide:plug-zap', '插件能力', () => openPlugins(row)),
        );
      }
      if (hasAccessByCodes(['Bot:Tencent:Reconnect'])) {
        actions.push(
          iconAction('lucide:refresh-cw', '重连', async () => {
            await reconnectTencentBot(row.id);
            message.success('Tencent 连接已重新准备');
            await tableApi.reload();
          }),
        );
      }
      if (hasAccessByCodes(['Bot:Tencent:MenuSync'])) {
        actions.push(
          iconAction('lucide:panel-top', '同步官方菜单', async () => {
            await syncTencentMenu(row.id);
            message.success('Tencent 官方菜单已同步');
          }),
        );
      }
      if (hasAccessByCodes(['Bot:Tencent:WebhookUrl'])) {
        const webhookAction = renderWebhookAction(row);
        if (webhookAction) actions.push(webhookAction);
      }
      if (hasAccessByCodes(['Bot:Tencent:Edit'])) {
        actions.push(iconAction('lucide:pencil', '编辑', () => openEdit(row)));
      }
      if (hasAccessByCodes(['Bot:Tencent:Delete'])) {
        actions.push(
          iconAction(
            'lucide:trash-2',
            '删除',
            async () => {
              await deleteTencentBot(row.id);
              message.success('Tencent 连接已删除');
              await tableApi.reload();
            },
            true,
          ),
        );
      }
      return <Space size={4}>{actions}</Space>;
    }

    /**
     * 仅为 Webhook 连接渲染复制回调地址的语义图标。
     * @param row - 当前 Tencent 账号。
     * @returns Webhook 复制按钮；WebSocket 返回 undefined。
     */
    function renderWebhookAction(row: BotApi.Account) {
      if (row.connectionMode !== 'official-webhook') return undefined;
      return iconAction('lucide:copy', '复制 Webhook 回调', async () => {
        const result = await getTencentWebhookUrl(row.id);
        await navigator.clipboard.writeText(result.url);
        message.success('Webhook 回调地址已复制');
      });
    }

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

    /**
     * 构造带 Tooltip 与 aria-label 的图标按钮。
     * @param icon - Iconify 语义图标。
     * @param label - Tooltip 与无障碍标签。
     * @param handler - 点击后的受控动作。
     * @param danger - 是否使用危险色；省略时为 false。
     * @returns 图标按钮节点。
     */
    function iconAction(
      icon: string,
      label: string,
      handler: () => Promise<void> | void,
      danger = false,
    ) {
      return (
        <Tooltip title={label}>
          <Button
            aria-label={label}
            danger={danger}
            icon={<IconifyIcon icon={icon} />}
            onClick={() => void handler()}
            type="text"
          />
        </Tooltip>
      );
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
              if (column.key === 'actions') return renderActions(row);
              return undefined;
            },
          }}
        />
        <ConnectionModal title={modalTitle.value}>
          <ConnectionForm class="mx-2" />
        </ConnectionModal>
        <PluginModal title={`插件能力 · ${pluginAccount.value?.name || ''}`}>
          <Spin spinning={pluginLoading.value}>
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
                    onChange={(checked: boolean) =>
                      void togglePlugin(item, checked)
                    }
                  />
                </div>
              ))}
            </div>
          </Spin>
        </PluginModal>
      </Page>
    );
  },
});
