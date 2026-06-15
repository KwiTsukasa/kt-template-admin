import type { TableColumnType } from 'antdv-next';

import type { PropType } from 'vue';

import type { QqbotApi } from '#/api/qqbot';
import type { KtTableRowAction } from '#/components/ktTable';

import { computed, defineComponent, ref, watch } from 'vue';

import { message, Spin, Tabs, Tag } from 'antdv-next';

import {
  bindQqbotAccountCommand,
  bindQqbotAccountRule,
  bindQqbotEventPlugin,
  getQqbotCommandList,
  getQqbotEventPluginList,
  getQqbotRuleList,
  unbindQqbotAccountCommand,
  unbindQqbotAccountRule,
  unbindQqbotEventPlugin,
} from '#/api/qqbot';
import { KtTable } from '#/components/ktTable';

import {
  getOptionLabel,
  qqbotRuleMatchOptions,
  qqbotRuleTargetOptions,
} from '../../modules/options';
import { getQqbotStatusColor, getQqbotStatusLabel } from '../../modules/status';

const AKtTable = KtTable as any;
const ASpin = Spin as any;
const ATabs = Tabs as any;

const configTabItems = [
  { key: 'command', label: '在线命令' },
  { key: 'event', label: '事件触发' },
  { key: 'rule', label: '自动回复规则' },
] as const;

type ConfigTabKey = (typeof configTabItems)[number]['key'];

export default defineComponent({
  name: 'QqBotAccountConfigPanel',
  props: {
    account: {
      default: undefined,
      type: Object as PropType<QqbotApi.Account | undefined>,
    },
  },
  setup(props) {
    const activeTab = ref<ConfigTabKey>('command');
    const boundCommands = ref<QqbotApi.Command[]>([]);
    const boundRules = ref<QqbotApi.Rule[]>([]);
    const commandTemplates = ref<QqbotApi.Command[]>([]);
    const eventPlugins = ref<QqbotApi.EventPlugin[]>([]);
    const loading = ref(false);
    const ruleTemplates = ref<QqbotApi.Rule[]>([]);

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

    const commandColumns: Array<TableColumnType<QqbotApi.Command>> = [
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
    const commandRowActions: Array<KtTableRowAction<QqbotApi.Command>> = [
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
    const eventColumns: Array<TableColumnType<QqbotApi.EventPlugin>> = [
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
    const eventRowActions: Array<KtTableRowAction<QqbotApi.EventPlugin>> = [
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
    const ruleColumns: Array<TableColumnType<QqbotApi.Rule>> = [
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
    const ruleRowActions: Array<KtTableRowAction<QqbotApi.Rule>> = [
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
        return (row: QqbotApi.EventPlugin) =>
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

    async function refreshCommandTemplates() {
      const [templateResult, boundResult] = await Promise.all([
        getQqbotCommandList({ pageNo: 1, pageSize: 500 }),
        getQqbotCommandList({
          pageNo: 1,
          pageSize: 500,
          selfId: currentSelfId.value,
        }),
      ]);
      commandTemplates.value = templateResult.list || [];
      boundCommands.value = boundResult.list || [];
    }

    async function refreshCommandBindings() {
      const result = await getQqbotCommandList({
        pageNo: 1,
        pageSize: 500,
        selfId: currentSelfId.value,
      });
      boundCommands.value = result.list || [];
    }

    async function refreshEventPlugins() {
      eventPlugins.value = await getQqbotEventPluginList({
        selfId: currentSelfId.value,
      });
    }

    async function refreshRuleTemplates() {
      const [templateResult, boundResult] = await Promise.all([
        getQqbotRuleList({ pageNo: 1, pageSize: 500 }),
        getQqbotRuleList({
          pageNo: 1,
          pageSize: 500,
          selfId: currentSelfId.value,
        }),
      ]);
      ruleTemplates.value = templateResult.list || [];
      boundRules.value = boundResult.list || [];
    }

    async function refreshRuleBindings() {
      const result = await getQqbotRuleList({
        pageNo: 1,
        pageSize: 500,
        selfId: currentSelfId.value,
      });
      boundRules.value = result.list || [];
    }

    async function handleCommandBind(row: QqbotApi.Command) {
      if (!ensureSelfId()) return;
      await bindQqbotAccountCommand(currentSelfId.value, row.id);
      message.success('命令已绑定到当前账号');
      await refreshCommandBindings();
    }

    async function handleCommandUnbind(row: QqbotApi.Command) {
      if (!ensureSelfId()) return;
      await unbindQqbotAccountCommand(currentSelfId.value, row.id);
      message.success('命令已从当前账号解绑');
      await refreshCommandBindings();
    }

    async function handleEventBind(row: QqbotApi.EventPlugin) {
      if (!ensureSelfId()) return;
      await bindQqbotEventPlugin(currentSelfId.value, row.key);
      message.success('事件插件已绑定到当前账号');
      await refreshEventPlugins();
    }

    async function handleEventUnbind(row: QqbotApi.EventPlugin) {
      if (!ensureSelfId()) return;
      await unbindQqbotEventPlugin(currentSelfId.value, row.key);
      message.success('事件插件已从当前账号解绑');
      await refreshEventPlugins();
    }

    async function handleRuleBind(row: QqbotApi.Rule) {
      if (!ensureSelfId()) return;
      await bindQqbotAccountRule(currentSelfId.value, row.id);
      message.success('规则已绑定到当前账号');
      await refreshRuleBindings();
    }

    async function handleRuleUnbind(row: QqbotApi.Rule) {
      if (!ensureSelfId()) return;
      await unbindQqbotAccountRule(currentSelfId.value, row.id);
      message.success('规则已从当前账号解绑');
      await refreshRuleBindings();
    }

    function ensureSelfId() {
      if (currentSelfId.value) return true;
      message.warning('缺少账号 Self ID，请从账号连接列表进入配置页');
      return false;
    }

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
        <Tag color={bound ? 'success' : 'default'}>
          {bound ? '已绑定' : '未绑定'}
        </Tag>
      );
    };

    const renderEnabledTag = (enabled: boolean) => {
      const status = enabled ? 'enabled' : 'disabled';
      return (
        <Tag color={getQqbotStatusColor(status)}>
          {getQqbotStatusLabel(status)}
        </Tag>
      );
    };

    const renderTableTitle = () => {
      return (
        <div class="qqbot-account-config-panel__table-title">
          <span>账号功能配置</span>
          <Tag color="processing">{`Self ID：${currentSelfId.value || '-'}`}</Tag>
          {props.account?.name ? <Tag>{props.account.name}</Tag> : null}
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
        const row = record as QqbotApi.EventPlugin;
        if (column.key === 'triggerType') {
          return row.triggerType === 'message' ? '消息事件' : row.triggerType;
        }
        if (column.key === 'bound') {
          return renderBoundTag(row.bound);
        }
        return undefined;
      }

      if (activeTab.value === 'rule') {
        const row = record as QqbotApi.Rule;
        const bound = boundRuleIds.value.has(row.id);
        if (column.key === 'matchType') {
          return getOptionLabel(qqbotRuleMatchOptions, row.matchType);
        }
        if (column.key === 'targetType') {
          return getOptionLabel(qqbotRuleTargetOptions, row.targetType);
        }
        if (column.key === 'replyContent') {
          return (
            <span class="qqbot-account-config-panel__ellipsis">
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

      const row = record as QqbotApi.Command;
      const bound = boundCommandIds.value.has(row.id);
      if (column.key === 'aliases') {
        return row.aliases?.join(' / ') || '-';
      }
      if (column.key === 'targetType') {
        return getOptionLabel(qqbotRuleTargetOptions, row.targetType);
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
      <div class="qqbot-account-config-panel">
        <div class="qqbot-account-config-panel__spin">
          <ASpin spinning={loading.value}>
            <AKtTable
              class="qqbot-account-config-panel__table"
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
      </div>
    );
  },
});
