import type { TableColumnType } from 'antdv-next';

import type { PropType } from 'vue';

import type { AccountConfigKind } from './useAccountConfigState';

import type { BotApi } from '#/api/bot';
import type { KtTableRowAction } from '#/components/kt-table';

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  reactive,
  ref,
  watch,
} from 'vue';

import { Alert, Button, message, Spin, Tabs, Tag } from 'antdv-next';

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
import {
  isAccountConfigWritePending,
  settleAccountConfigWrite,
  subscribeAccountConfigWriteSettled,
} from './useAccountConfigState';

const AKtTable = KtTable as any;
const AAlert = Alert as any;
const AButton = Button as any;
const ASpin = Spin as any;
const ATabs = Tabs as any;

const configTabItems = [
  { key: 'command', label: '在线命令' },
  { key: 'event', label: '事件触发' },
  { key: 'rule', label: '自动回复规则' },
  { key: 'message-push', label: '消息推送' },
] as const;

type ConfigTabKey = (typeof configTabItems)[number]['key'];
type DataKind = AccountConfigKind;

interface CategoryReadState {
  error: string;
  known: boolean;
  loading: boolean;
}

interface TemplateBindingSnapshot<T> {
  bound: T[];
  templates: T[];
}

const dataKinds: DataKind[] = ['command', 'event', 'rule'];
const categoryLabels: Record<DataKind, string> = {
  command: '命令',
  event: '事件插件',
  rule: '规则',
};

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
    const commandSnapshot = ref<TemplateBindingSnapshot<BotApi.Command>>();
    const eventSnapshot = ref<BotApi.AdapterPluginBinding[]>();
    const ruleSnapshot = ref<TemplateBindingSnapshot<BotApi.Rule>>();
    const readState = reactive<Record<DataKind, CategoryReadState>>({
      command: { error: '', known: false, loading: false },
      event: { error: '', known: false, loading: false },
      rule: { error: '', known: false, loading: false },
    });
    const readGeneration: Record<DataKind, number> = {
      command: 0,
      event: 0,
      rule: 0,
    };
    let accountEpoch = 0;
    let disposed = false;

    const currentSelfId = computed(() => props.account?.selfId || '');
    const boundCommandIds = computed(
      () => new Set(commandSnapshot.value?.bound.map((item) => item.id) || []),
    );
    const boundRuleIds = computed(
      () => new Set(ruleSnapshot.value?.bound.map((item) => item.id) || []),
    );
    const mergedCommandTemplates = computed(() =>
      mergeById(
        commandSnapshot.value?.templates || [],
        commandSnapshot.value?.bound || [],
      ),
    );
    const mergedRuleTemplates = computed(() =>
      mergeById(
        ruleSnapshot.value?.templates || [],
        ruleSnapshot.value?.bound || [],
      ),
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
    const commandRowActions = computed<Array<KtTableRowAction<BotApi.Command>>>(
      () => {
        const selfId = currentSelfId.value;
        const epoch = accountEpoch;
        return [
          {
            key: 'bind',
            label: '绑定',
            onClick: (row) =>
              writeBinding('command', selfId, row.id, true, epoch),
            rowVisible: (row) =>
              canAct('command', selfId, row.id) &&
              !boundCommandIds.value.has(row.id),
          },
          {
            confirm: (row) =>
              `确认从账号 ${selfId} 解绑「${row.name || row.code}」吗？`,
            danger: true,
            key: 'unbind',
            label: '解绑',
            onClick: (row) =>
              writeBinding('command', selfId, row.id, false, epoch),
            rowVisible: (row) =>
              canAct('command', selfId, row.id) &&
              boundCommandIds.value.has(row.id),
          },
        ];
      },
    );
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
    const eventRowActions = computed<
      Array<KtTableRowAction<BotApi.AdapterPluginBinding>>
    >(() => {
      const selfId = currentSelfId.value;
      const epoch = accountEpoch;
      return [
        {
          key: 'bind',
          label: '绑定',
          onClick: (row) => writeBinding('event', selfId, row.key, true, epoch),
          rowVisible: (row) => canAct('event', selfId, row.key) && !row.bound,
        },
        {
          confirm: (row) => `确认从账号 ${selfId} 解绑「${row.name}」吗？`,
          danger: true,
          key: 'unbind',
          label: '解绑',
          onClick: (row) =>
            writeBinding('event', selfId, row.key, false, epoch),
          rowVisible: (row) => canAct('event', selfId, row.key) && row.bound,
        },
      ];
    });
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
    const ruleRowActions = computed<Array<KtTableRowAction<BotApi.Rule>>>(
      () => {
        const selfId = currentSelfId.value;
        const epoch = accountEpoch;
        return [
          {
            key: 'bind',
            label: '绑定',
            onClick: (row) => writeBinding('rule', selfId, row.id, true, epoch),
            rowVisible: (row) =>
              canAct('rule', selfId, row.id) && !boundRuleIds.value.has(row.id),
          },
          {
            confirm: (row) =>
              `确认从账号 ${selfId} 解绑「${row.name || row.keyword}」吗？`,
            danger: true,
            key: 'unbind',
            label: '解绑',
            onClick: (row) =>
              writeBinding('rule', selfId, row.id, false, epoch),
            rowVisible: (row) =>
              canAct('rule', selfId, row.id) && boundRuleIds.value.has(row.id),
          },
        ];
      },
    );
    const activeColumns = computed(() => {
      if (activeTab.value === 'event') return eventColumns;
      if (activeTab.value === 'rule') return ruleColumns;
      return commandColumns;
    });
    const activeRows = computed(() => {
      if (activeTab.value === 'event') {
        if (!readState.event.known) return [];
        return eventSnapshot.value || [];
      }
      if (activeTab.value === 'rule') {
        if (!readState.rule.known) return [];
        return mergedRuleTemplates.value;
      }
      if (!readState.command.known) return [];
      return mergedCommandTemplates.value;
    });
    const activeLoading = computed(() => {
      if (activeTab.value === 'message-push') return false;
      return readState[activeTab.value].loading;
    });
    const activeRowActions = computed(() => {
      if (activeTab.value === 'event') return eventRowActions.value;
      if (activeTab.value === 'rule') return ruleRowActions.value;
      return commandRowActions.value;
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
        accountEpoch += 1;
        commandSnapshot.value = undefined;
        eventSnapshot.value = undefined;
        ruleSnapshot.value = undefined;
        for (const kind of dataKinds) {
          readGeneration[kind] += 1;
          readState[kind].known = false;
          readState[kind].loading = false;
          readState[kind].error = '';
        }
        if (!selfId) return;
        for (const kind of dataKinds) {
          void refreshCategory(kind, selfId);
        }
      },
      { immediate: true },
    );

    const unsubscribeWrites = subscribeAccountConfigWriteSettled(
      (selfId, kind) => {
        if (disposed || currentSelfId.value !== selfId) return;
        void refreshCategory(kind, selfId);
      },
    );

    onBeforeUnmount(() => {
      disposed = true;
      for (const kind of dataKinds) readGeneration[kind] += 1;
      unsubscribeWrites();
    });

    /**
     * 判断账号和类别读取是否仍属于当前可展示会话。
     * @param kind - 命令、事件插件或规则分类。
     * @param selfId - 发起读取时固定的账号 Self ID。
     * @param request - 该分类读取的本轮序号。
     * @returns 页面仍在且账号、分类轮次都一致时为 true。
     */
    function isCurrentRead(kind: DataKind, selfId: string, request: number) {
      return (
        !disposed &&
        currentSelfId.value === selfId &&
        readGeneration[kind] === request
      );
    }

    /**
     * 将一个账号分类的读取、失败和轮次准入集中处理；仅成功快照可开放绑定动作。
     * @param kind - 本轮读取所属的配置分类。
     * @param selfId - 发起读取时固定的账号 Self ID。
     * @param reader - 取得该分类完整权威快照的请求。
     * @param publish - 在通过身份与轮次准入后提交快照。
     */
    async function readCategory<T>(
      kind: DataKind,
      selfId: string,
      reader: () => Promise<T>,
      publish: (snapshot: T) => void,
    ) {
      const request = ++readGeneration[kind];
      readState[kind].known = false;
      readState[kind].loading = true;
      readState[kind].error = '';
      try {
        const snapshot = await reader();
        if (!isCurrentRead(kind, selfId, request)) return;
        publish(snapshot);
        readState[kind].known = true;
      } catch {
        if (!isCurrentRead(kind, selfId, request)) return;
        readState[kind].error = `${categoryLabels[kind]}读取失败，请重试。`;
      } finally {
        if (isCurrentRead(kind, selfId, request))
          readState[kind].loading = false;
      }
    }

    /**
     * 按固定账号读取一个分类的完整绑定事实，模板和绑定必须同轮成功后才发布。
     * @param kind - 要重读的命令、事件插件或规则分类。
     * @param selfId - 本次读取固定归属的 Bot Self ID。
     */
    async function refreshCategory(kind: DataKind, selfId: string) {
      if (kind === 'command') {
        await readCategory(
          kind,
          selfId,
          async () =>
            await Promise.all([
              getBotCommandList({ pageNo: 1, pageSize: 500 }),
              getBotCommandList({ pageNo: 1, pageSize: 500, selfId }),
            ]),
          ([templates, bound]) => {
            if (!Array.isArray(templates.list) || !Array.isArray(bound.list)) {
              throw new TypeError('命令绑定快照不完整');
            }
            commandSnapshot.value = {
              templates: templates.list,
              bound: bound.list,
            };
          },
        );
        return;
      }
      if (kind === 'event') {
        await readCategory(
          kind,
          selfId,
          () => getNapcatPluginList(selfId),
          (rows) => {
            if (
              !Array.isArray(rows) ||
              !rows.every(
                (row) =>
                  row.selfId === selfId && typeof row.bound === 'boolean',
              )
            )
              throw new TypeError('事件插件快照不完整');
            eventSnapshot.value = rows;
          },
        );
        return;
      }
      await readCategory(
        kind,
        selfId,
        async () =>
          await Promise.all([
            getBotRuleList({ pageNo: 1, pageSize: 500 }),
            getBotRuleList({ pageNo: 1, pageSize: 500, selfId }),
          ]),
        ([templates, bound]) => {
          if (!Array.isArray(templates.list) || !Array.isArray(bound.list)) {
            throw new TypeError('规则绑定快照不完整');
          }
          ruleSnapshot.value = {
            templates: templates.list,
            bound: bound.list,
          };
        },
      );
    }

    /**
     * 仅对当前账号、已知绑定状态且无同项写入的记录显示操作。
     * @param kind - 要操作的配置分类。
     * @param selfId - 操作按钮创建时捕获的账号身份。
     * @param entityId - 命令、插件或规则的稳定标识。
     * @returns 当前记录允许新写入时为 true。
     */
    function canAct(kind: DataKind, selfId: string, entityId: string) {
      return (
        !disposed &&
        !!selfId &&
        selfId === currentSelfId.value &&
        readState[kind].known &&
        !isAccountConfigWritePending(selfId, kind, entityId)
      );
    }

    /**
     * 将绑定意图固定到按钮创建时的账号与实体，去重同项写入并只回读当前账号的对应分类。
     * @param kind - 命令、事件插件或规则分类。
     * @param selfId - 打开操作或确认框时所属账号 Self ID。
     * @param entityId - 本次绑定或解绑的稳定实体标识。
     * @param bind - true 为绑定，false 为解绑。
     * @param intentEpoch - 打开操作或确认框时的账号会话序号。
     */
    async function writeBinding(
      kind: DataKind,
      selfId: string,
      entityId: string,
      bind: boolean,
      intentEpoch: number,
    ) {
      if (intentEpoch !== accountEpoch) {
        message.warning('账号上下文已变化，请重新确认');
        return;
      }
      if (!canAct(kind, selfId, entityId)) {
        if (selfId !== currentSelfId.value || !readState[kind].known)
          message.warning('账号已切换或绑定状态未知，请刷新后重试');
        return;
      }
      const outcome = await settleAccountConfigWrite(
        selfId,
        kind,
        entityId,
        async () => {
          if (kind === 'command') {
            if (bind) await bindBotAccountCommand(selfId, entityId);
            else await unbindBotAccountCommand(selfId, entityId);
          } else if (kind === 'event') {
            if (bind) await bindNapcatPlugin(selfId, entityId);
            else await unbindNapcatPlugin(selfId, entityId);
          } else if (bind) {
            await bindBotAccountRule(selfId, entityId);
          } else {
            await unbindBotAccountRule(selfId, entityId);
          }
        },
      );
      if (disposed || currentSelfId.value !== selfId) return;
      if (outcome === 'saved') {
        if (bind) message.success(`${categoryLabels[kind]}已绑定到当前账号`);
        else message.success(`${categoryLabels[kind]}已从当前账号解绑`);
      } else if (outcome === 'failed') {
        message.warning('绑定或解绑请求失败，实际状态待确认；正在重新读取');
      }
    }

    /**
     * 按标识合并可选项与已绑定项，保留模板顺序并追加缺失的绑定记录。
     *
     * @param templates - 命令或规则分类的全部候选模板。
     * @param bound - 当前账号已绑定的记录，可能包含目录未返回的项。
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

    /**
     * 只呈现当前分类自己的读取失败和重试，不影响已成功的其他页签。
     * @returns 活动分类失败时的紧凑提示；否则为空。
     */
    function renderCategoryError() {
      if (activeTab.value === 'message-push') return null;
      const kind = activeTab.value;
      const error = readState[kind].error;
      if (!error) return null;
      return (
        <AAlert
          action={
            <AButton
              onClick={() => void refreshCategory(kind, currentSelfId.value)}
            >
              重试
            </AButton>
          }
          class="bot-account-config-panel__error"
          showIcon
          title={error}
          type="warning"
        />
      );
    }

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
                title={() => null}
              />
            );
          }
          if (readState[activeTab.value].error) {
            return (
              <div class="bot-account-config-panel__error-view">
                {renderHeaderControls()}
                {renderCategoryError()}
              </div>
            );
          }
          return (
            <div class="bot-account-config-panel__spin">
              <ASpin spinning={activeLoading.value}>
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
