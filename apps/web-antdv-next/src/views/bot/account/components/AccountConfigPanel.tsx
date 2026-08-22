import type { TableColumnType } from 'antdv-next';

import type { PropType } from 'vue';

import type { BotApi } from '#/api/bot';
import type { KtTableRowAction } from '#/components/kt-table';

import { computed, defineComponent, ref, watch } from 'vue';

import { message, Spin, Tabs, Tag } from 'antdv-next';

import {
  bindBotAccountCommand,
  bindBotAccountRule,
  bindNapcatPlugin,
  getBotCommandList,
  getBotRuleList,
  getNapcatPluginList,
  unbindBotAccountCommand,
  unbindBotAccountRule,
  unbindNapcatPlugin,
} from '#/api/bot';
import { KtTable } from '#/components/kt-table';

import {
  botRuleMatchOptions,
  botRuleTargetOptions,
  getOptionLabel,
} from '../../modules/options';
import { getBotStatusColor, getBotStatusLabel } from '../../modules/status';
import AccountMessagePushPanel from './AccountMessagePushPanel';

const AKtTable = KtTable as any;
const ASpin = Spin as any;
const ATabs = Tabs as any;

const configTabItems = [
  { key: 'command', label: '在线命令' },
  { key: 'event', label: '事件触发' },
  { key: 'rule', label: '自动回复规则' },
  { key: 'message-push', label: '消息推送' },
] as const;

type ConfigTabKey = (typeof configTabItems)[number]['key'];

export default defineComponent({
  name: 'BotAccountConfigPanel',
  props: {
    account: {
      default: undefined,
      type: Object as PropType<BotApi.Account | undefined>,
    },
  },
  setup(props) {
    const activeTab = ref<ConfigTabKey>('command');
    const boundCommands = ref<BotApi.Command[]>([]);
    const boundRules = ref<BotApi.Rule[]>([]);
    const commandTemplates = ref<BotApi.Command[]>([]);
    const eventPlugins = ref<BotApi.AdapterPluginBinding[]>([]);
    const loading = ref(false);
    const ruleTemplates = ref<BotApi.Rule[]>([]);

    const currentSelfId = computed(() => props.account?.selfId || '');
    const boundCommandIds = computed(
      () => new Set(boundCommands.value.map((item) => item.id)),
    );
    const boundRuleIds = computed(
      () => new Set(boundRules.value.map((item) => item.id)),
    );
    const mergedCommandTemplates = computed(() =>
      mergeById(commandTemplates.value, boundCommands.value),
    );
    const mergedRuleTemplates = computed(() =>
      mergeById(ruleTemplates.value, boundRules.value),
    );

    const commandColumns: Array<TableColumnType<BotApi.Command>> = [
      { dataIndex: 'name', key: 'name', title: '命令模板', width: 160 },
      { dataIndex: 'code', key: 'code', title: '命令编码', width: 140 },
      { dataIndex: 'aliases', key: 'aliases', title: '别名', width: 200 },
      { dataIndex: 'pluginKey', key: 'pluginKey', title: '插件', width: 140 },
      {
        dataIndex: 'targetType',
        key: 'targetType',
        title: '目标范围',
        width: 100,
      },
      { dataIndex: 'enabled', key: 'enabled', title: '模板状态', width: 100 },
      { dataIndex: 'bound', key: 'bound', title: '绑定状态', width: 100 },
    ];
    const commandRowActions: Array<KtTableRowAction<BotApi.Command>> = [
      {
        key: 'bind',
        label: '绑定',
        onClick: async (row) => handleCommandBind(row),
        rowVisible: (row) => !boundCommandIds.value.has(row.id),
      },
      {
        confirm: (row) => `确认从当前账号解绑「${row.name || row.code}」吗？`,
        danger: true,
        key: 'unbind',
        label: '解绑',
        onClick: async (row) => handleCommandUnbind(row),
        rowVisible: (row) => boundCommandIds.value.has(row.id),
      },
    ];
    const eventColumns: Array<TableColumnType<BotApi.AdapterPluginBinding>> = [
      { dataIndex: 'name', key: 'name', title: '插件模板', width: 160 },
      { dataIndex: 'key', key: 'key', title: '插件 Key', width: 160 },
      {
        dataIndex: 'triggerType',
        key: 'triggerType',
        title: '触发类型',
        width: 100,
      },
      {
        dataIndex: 'description',
        key: 'description',
        title: '说明',
        width: 320,
      },
      { dataIndex: 'bound', key: 'bound', title: '绑定状态', width: 100 },
    ];
    const eventRowActions: Array<
      KtTableRowAction<BotApi.AdapterPluginBinding>
    > = [
      {
        key: 'bind',
        label: '绑定',
        onClick: async (row) => handleEventBind(row),
        rowVisible: (row) => !row.bound,
      },
      {
        confirm: (row) => `确认从当前账号解绑「${row.name}」吗？`,
        danger: true,
        key: 'unbind',
        label: '解绑',
        onClick: async (row) => handleEventUnbind(row),
        rowVisible: (row) => row.bound,
      },
    ];
    const ruleColumns: Array<TableColumnType<BotApi.Rule>> = [
      { dataIndex: 'name', key: 'name', title: '规则模板', width: 160 },
      { dataIndex: 'keyword', key: 'keyword', title: '关键词', width: 180 },
      {
        dataIndex: 'matchType',
        key: 'matchType',
        title: '匹配方式',
        width: 110,
      },
      {
        dataIndex: 'targetType',
        key: 'targetType',
        title: '目标范围',
        width: 100,
      },
      {
        dataIndex: 'replyContent',
        key: 'replyContent',
        title: '回复模板',
        width: 320,
      },
      { dataIndex: 'enabled', key: 'enabled', title: '模板状态', width: 100 },
      { dataIndex: 'bound', key: 'bound', title: '绑定状态', width: 100 },
    ];
    const ruleRowActions: Array<KtTableRowAction<BotApi.Rule>> = [
      {
        key: 'bind',
        label: '绑定',
        onClick: async (row) => handleRuleBind(row),
        rowVisible: (row) => !boundRuleIds.value.has(row.id),
      },
      {
        confirm: (row) =>
          `确认从当前账号解绑「${row.name || row.keyword}」吗？`,
        danger: true,
        key: 'unbind',
        label: '解绑',
        onClick: async (row) => handleRuleUnbind(row),
        rowVisible: (row) => boundRuleIds.value.has(row.id),
      },
    ];
    const activeColumns = computed(() => {
      if (activeTab.value === 'event') return eventColumns;
      if (activeTab.value === 'rule') return ruleColumns;
      return commandColumns;
    });
    const activeRows = computed(() => {
      if (activeTab.value === 'event') return eventPlugins.value;
      if (activeTab.value === 'rule') return mergedRuleTemplates.value;
      return mergedCommandTemplates.value;
    });
    const activeRowActions = computed(() => {
      if (activeTab.value === 'event') return eventRowActions;
      if (activeTab.value === 'rule') return ruleRowActions;
      return commandRowActions;
    });
    const activeRowKey = computed(() => {
      if (activeTab.value === 'event') {
        return (row: BotApi.AdapterPluginBinding) =>
          `${currentSelfId.value}:${row.key}`;
      }
      return 'id';
    });

    watch(
      currentSelfId,
      (selfId) => {
        if (!selfId) {
          boundCommands.value = [];
          boundRules.value = [];
          commandTemplates.value = [];
          eventPlugins.value = [];
          ruleTemplates.value = [];
          return;
        }
        void refreshAll();
      },
      { immediate: true },
    );
    /**
     * 并行刷新当前 Bot 账号的命令模板、事件插件和规则模板，并统一维护面板加载态。
     */
    async function refreshAll() {
      loading.value = true;
      try {
        await Promise.all([
          refreshCommandTemplates(),
          refreshEventPlugins(),
          refreshRuleTemplates(),
        ]);
      } finally {
        loading.value = false;
      }
    }

    /**
     * 并行加载全部命令模板与当前账号绑定命令，分别更新候选和已绑定列表。
     */
    async function refreshCommandTemplates() {
      const [templateResult, boundResult] = await Promise.all([
        getBotCommandList({ pageNo: 1, pageSize: 500 }),
        getBotCommandList({
          pageNo: 1,
          pageSize: 500,
          selfId: currentSelfId.value,
        }),
      ]);
      commandTemplates.value = templateResult.list || [];
      boundCommands.value = boundResult.list || [];
    }

    /**
     * 重新加载当前 Bot 账号已绑定的命令列表。
     */
    async function refreshCommandBindings() {
      const result = await getBotCommandList({
        pageNo: 1,
        pageSize: 500,
        selfId: currentSelfId.value,
      });
      boundCommands.value = result.list || [];
    }

    /**
     * 重新加载当前 Bot 账号可用及已绑定的事件插件状态。
     */
    async function refreshEventPlugins() {
      eventPlugins.value = await getNapcatPluginList(currentSelfId.value);
    }

    /**
     * 并行加载全部规则模板与当前账号绑定规则，分别更新候选和已绑定列表。
     */
    async function refreshRuleTemplates() {
      const [templateResult, boundResult] = await Promise.all([
        getBotRuleList({ pageNo: 1, pageSize: 500 }),
        getBotRuleList({
          pageNo: 1,
          pageSize: 500,
          selfId: currentSelfId.value,
        }),
      ]);
      ruleTemplates.value = templateResult.list || [];
      boundRules.value = boundResult.list || [];
    }

    /**
     * 重新加载当前 Bot 账号已绑定的规则列表。
     */
    async function refreshRuleBindings() {
      const result = await getBotRuleList({
        pageNo: 1,
        pageSize: 500,
        selfId: currentSelfId.value,
      });
      boundRules.value = result.list || [];
    }

    /**
     * 把选中命令绑定到当前 Bot 账号，成功后提示并刷新已绑定命令。
     *
     * @param row - 要绑定到当前账号的 Bot 命令记录。
     */
    async function handleCommandBind(row: BotApi.Command) {
      if (!ensureSelfId()) return;
      await bindBotAccountCommand(currentSelfId.value, row.id);
      message.success('命令已绑定到当前账号');
      await refreshCommandBindings();
    }

    /**
     * 解除选中命令与当前 Bot 账号的绑定，成功后提示并刷新已绑定命令。
     *
     * @param row - 要从当前账号解除绑定的 Bot 命令记录。
     */
    async function handleCommandUnbind(row: BotApi.Command) {
      if (!ensureSelfId()) return;
      await unbindBotAccountCommand(currentSelfId.value, row.id);
      message.success('命令已从当前账号解绑');
      await refreshCommandBindings();
    }

    /**
     * 把选中事件插件绑定到当前 Bot 账号，成功后提示并刷新事件插件列表。
     *
     * @param row - 要绑定到当前账号的 Bot 事件插件记录。
     */
    async function handleEventBind(row: BotApi.AdapterPluginBinding) {
      if (!ensureSelfId()) return;
      await bindNapcatPlugin(currentSelfId.value, row.key);
      message.success('事件插件已绑定到当前账号');
      await refreshEventPlugins();
    }

    /**
     * 解除选中事件插件与当前 Bot 账号的绑定，成功后提示并刷新事件插件列表。
     *
     * @param row - 要从当前账号解除绑定的 Bot 事件插件记录。
     */
    async function handleEventUnbind(row: BotApi.AdapterPluginBinding) {
      if (!ensureSelfId()) return;
      await unbindNapcatPlugin(currentSelfId.value, row.key);
      message.success('事件插件已从当前账号解绑');
      await refreshEventPlugins();
    }

    /**
     * 把选中规则绑定到当前 Bot 账号，成功后提示并刷新已绑定规则。
     *
     * @param row - 要绑定到当前账号的 Bot 规则记录。
     */
    async function handleRuleBind(row: BotApi.Rule) {
      if (!ensureSelfId()) return;
      await bindBotAccountRule(currentSelfId.value, row.id);
      message.success('规则已绑定到当前账号');
      await refreshRuleBindings();
    }

    /**
     * 解除选中规则与当前 Bot 账号的绑定，成功后提示并刷新已绑定规则。
     *
     * @param row - 要从当前账号解除绑定的 Bot 规则记录。
     */
    async function handleRuleUnbind(row: BotApi.Rule) {
      if (!ensureSelfId()) return;
      await unbindBotAccountRule(currentSelfId.value, row.id);
      message.success('规则已从当前账号解绑');
      await refreshRuleBindings();
    }

    /**
     * 确认配置页具有 Bot Self ID；缺失时提示用户返回账号列表并阻止后续绑定操作。
     *
     * @returns 存在当前 Self ID 时返回 true；缺失并已提示用户时返回 false。
     */
    function ensureSelfId() {
      if (currentSelfId.value) return true;
      message.warning('缺少账号 Self ID，请从账号连接列表进入配置页');
      return false;
    }

    /**
     * 按标识合并可选项与已绑定项，保留模板顺序并追加缺失的绑定记录。
     *
     * @param templates - 可供订阅来源筛选或绑定的消息模板集合。
     * @param bound - 限制拖拽或尺寸计算范围的边界值。
     * @returns 以模板顺序为基础、按标识去重后追加已绑定项的记录数组。
     */
    function mergeById<T extends { id: string }>(templates: T[], bound: T[]) {
      const map = new Map<string, T>();
      templates.forEach((item) => map.set(item.id, item));
      bound.forEach((item) => {
        if (!map.has(item.id)) map.set(item.id, item);
      });
      return [...map.values()];
    }

    const renderBoundTag = (bound: boolean) => {
      return (
        <Tag
          color={(() => {
            if (bound) {
              return 'success';
            }
            return 'default';
          })()}
        >
          {(() => {
            if (bound) {
              return '已绑定';
            }
            return '未绑定';
          })()}
        </Tag>
      );
    };

    const renderEnabledTag = (enabled: boolean) => {
      const status = (() => {
        if (enabled) {
          return 'enabled';
        }
        return 'disabled';
      })();
      return (
        <Tag color={getBotStatusColor(status)}>{getBotStatusLabel(status)}</Tag>
      );
    };

    const renderTableTitle = () => {
      return (
        <div class="bot-account-config-panel__table-title">
          <span>账号功能配置</span>
          <Tag color="processing">{`Self ID：${currentSelfId.value || '-'}`}</Tag>
          {(() => {
            if (props.account?.name) {
              return <Tag>{props.account.name}</Tag>;
            }
            return null;
          })()}
        </div>
      );
    };

    const renderHeaderControls = () => {
      return (
        <div class="kt-table__header-control-group">
          <ATabs
            class="kt-table__header-tabs"
            items={[...configTabItems]}
            v-model:activeKey={activeTab.value}
          />
        </div>
      );
    };

    const renderBodyCell = ({ column, record }: any) => {
      if (activeTab.value === 'event') {
        const row = record as BotApi.AdapterPluginBinding;
        if (column.key === 'triggerType') {
          if (row.triggerType === 'message') {
            return '消息事件';
          }
          return row.triggerType;
        }
        if (column.key === 'bound') {
          return renderBoundTag(row.bound);
        }
        return undefined;
      }

      if (activeTab.value === 'rule') {
        const row = record as BotApi.Rule;
        const bound = boundRuleIds.value.has(row.id);
        if (column.key === 'matchType') {
          return getOptionLabel(botRuleMatchOptions, row.matchType);
        }
        if (column.key === 'targetType') {
          return getOptionLabel(botRuleTargetOptions, row.targetType);
        }
        if (column.key === 'replyContent') {
          return (
            <span class="bot-account-config-panel__ellipsis">
              {row.replyContent || '-'}
            </span>
          );
        }
        if (column.key === 'enabled') {
          return renderEnabledTag(row.enabled);
        }
        if (column.key === 'bound') {
          return renderBoundTag(bound);
        }
        return undefined;
      }

      const row = record as BotApi.Command;
      const bound = boundCommandIds.value.has(row.id);
      if (column.key === 'aliases') {
        return row.aliases?.join(' / ') || '-';
      }
      if (column.key === 'targetType') {
        return getOptionLabel(botRuleTargetOptions, row.targetType);
      }
      if (column.key === 'enabled') {
        return renderEnabledTag(row.enabled);
      }
      if (column.key === 'bound') {
        return renderBoundTag(bound);
      }
      return undefined;
    };

    return () => (
      <div class="bot-account-config-panel">
        {(() => {
          if (activeTab.value === 'message-push') {
            return (
              <AccountMessagePushPanel
                headerControls={renderHeaderControls}
                selfId={currentSelfId.value}
                title={renderTableTitle}
              />
            );
          }
          return (
            <div class="bot-account-config-panel__spin">
              <ASpin spinning={loading.value}>
                <AKtTable
                  class="bot-account-config-panel__table"
                  columns={activeColumns.value}
                  dataSource={activeRows.value}
                  rowActions={activeRowActions.value}
                  rowKey={activeRowKey.value}
                  showDefaultButtons={false}
                  showFooter={false}
                  showIndex={false}
                  showPagination={false}
                  showTableSetting={false}
                  size="small"
                  v-slots={{
                    bodyCell: renderBodyCell,
                    headerControls: renderHeaderControls,
                    title: renderTableTitle,
                  }}
                />
              </ASpin>
            </div>
          );
        })()}
      </div>
    );
  },
});
