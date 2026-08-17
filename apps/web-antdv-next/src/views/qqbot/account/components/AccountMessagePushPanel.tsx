import type { TableColumnType } from 'antdv-next';

import type { PropType, VNodeChild } from 'vue';

import type { AccountMessagePushModalExposed } from './AccountMessagePushModal';

import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/kt-table';

import { defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { Plus } from '@vben/icons';

import { Space, Tag } from 'antdv-next';

import {
  deleteAccountMessagePushBinding,
  getAccountMessagePushBindings,
  getAccountMessagePushTargets,
  getMessageSubscriptionList,
  getMessageTemplateList,
  setAccountMessagePushBindingEnabled,
} from '#/api/qqbot/message-push';
import { KtTable, useKtTable } from '#/components/kt-table';

import AccountMessagePushModal from './AccountMessagePushModal';

const AKtTable = KtTable as any;

export interface AccountMessagePushPanelProps {
  headerControls: () => VNodeChild;
  selfId: string;
  title: () => VNodeChild;
}

const PERMISSIONS = {
  create: 'QqBot:Account:MessagePush:Create',
  delete: 'QqBot:Account:MessagePush:Delete',
  list: 'QqBot:Account:MessagePush:List',
  toggle: 'QqBot:Account:MessagePush:Toggle',
  update: 'QqBot:Account:MessagePush:Update',
} as const;

const METADATA_MAX_PAGES = 100;
const METADATA_PAGE_SIZE = 100;

export default defineComponent({
  name: 'AccountMessagePushPanel',
  props: {
    headerControls: {
      required: true,
      type: Function as PropType<() => VNodeChild>,
    },
    selfId: {
      required: true,
      type: String,
    },
    title: {
      required: true,
      type: Function as PropType<() => VNodeChild>,
    },
  },
  setup(props) {
    const { hasAccessByCodes } = useAccess();
    const canList = hasAccessByCodes([PERMISSIONS.list]);
    const canLoadTargets =
      hasAccessByCodes([PERMISSIONS.create]) ||
      hasAccessByCodes([PERMISSIONS.update]);
    const modalRef = ref<AccountMessagePushModalExposed>();
    const subscriptions = ref<QqbotMessagePushApi.MessageSubscriptionView[]>(
      [],
    );
    const templates = ref<QqbotMessagePushApi.MessageTemplateView[]>([]);
    const targetOptions =
      ref<QqbotMessagePushApi.QqbotMessagePushTargetOptionsResponse>();
    const targetOptionsLoading = ref(false);
    let loadRevision = 0;
    let latestBindingPage: {
      items: QqbotMessagePushApi.QqbotMessagePublishBindingView[];
      total: number;
    } = { items: [], total: 0 };

    const columns: Array<
      TableColumnType<QqbotMessagePushApi.QqbotMessagePublishBindingView>
    > = [
      {
        dataIndex: 'subscriptionName',
        key: 'subscription',
        title: '消息订阅',
        width: 210,
      },
      {
        key: 'source',
        title: '消息源',
        width: 260,
      },
      {
        dataIndex: 'templateName',
        key: 'template',
        title: '消息模板',
        width: 200,
      },
      {
        key: 'targets',
        title: '推送目标',
        width: 300,
      },
      {
        dataIndex: 'enabled',
        key: 'enabled',
        title: '状态',
        width: 90,
      },
      {
        dataIndex: 'updateTime',
        key: 'updateTime',
        title: '更新时间',
        width: 180,
      },
    ];
    const api: KtTableApi<QqbotMessagePushApi.QqbotMessagePublishBindingView> =
      {
        list: async () => {
          const revision = loadRevision;
          const selfId = props.selfId;
          const bindings = await getAccountMessagePushBindings(selfId);
          if (revision !== loadRevision || selfId !== props.selfId) {
            return latestBindingPage;
          }
          latestBindingPage = {
            items: bindings,
            total: bindings.length,
          };
          return latestBindingPage;
        },
      };
    const buttons: Array<
      KtTableButton<QqbotMessagePushApi.QqbotMessagePublishBindingView>
    > = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: '新增推送',
        onClick: openCreate,
        permissionCodes: [PERMISSIONS.create],
        type: 'primary',
      },
      {
        key: 'refresh',
        label: '刷新',
        operation: 'reload',
        permissionCodes: [PERMISSIONS.list],
      },
    ];
    const rowActions: Array<
      KtTableRowAction<QqbotMessagePushApi.QqbotMessagePublishBindingView>
    > = [
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        permissionCodes: [PERMISSIONS.update],
      },
      {
        key: 'toggle',
        label: '启停',
        onClick: handleToggle,
        permissionCodes: [PERMISSIONS.toggle],
      },
      {
        confirm: getDeleteConfirm,
        danger: true,
        key: 'delete',
        label: '解绑',
        onClick: handleDelete,
        permissionCodes: [PERMISSIONS.delete],
      },
    ];
    const [registerTable, tableApi] =
      useKtTable<QqbotMessagePushApi.QqbotMessagePublishBindingView>({
        api,
        buttons,
        columns,
        immediate: false,
        rowActions,
        rowKey: 'id',
        showDefaultButtons: false,
        showFooter: false,
        showIndex: false,
        showPagination: false,
        showTableSetting: false,
        size: 'small',
      });

    /**
     * 通过子弹窗组件打开账号消息推送绑定的新建会话。
     */
    function openCreate() {
      modalRef.value?.openCreate();
    }

    /**
     * 把选中消息推送绑定交给子弹窗组件，并打开编辑会话。
     *
     * @param row - 要传给绑定编辑弹窗的账号消息推送记录。
     */
    function openEdit(row: QqbotMessagePushApi.QqbotMessagePublishBindingView) {
      modalRef.value?.openEdit(row);
    }

    /**
     * 根据订阅名称生成解绑消息推送关系的确认文本。
     *
     * @param row - 准备删除、需要在确认框展示订阅与模板名称的账号推送绑定。
     * @returns 包含订阅名称的解绑确认文本。
     */
    function getDeleteConfirm(
      row: QqbotMessagePushApi.QqbotMessagePublishBindingView,
    ): string {
      return `确认解绑消息订阅「${row.subscriptionName}」吗？`;
    }

    /**
     * 切换账号消息推送绑定的启用状态，并重新加载当前表格。
     *
     * @param row - 要切换启用状态的账号消息推送绑定。
     * @param context - 切换完成后用于重新加载列表的 KtTable 行操作上下文。
     */
    async function handleToggle(
      row: QqbotMessagePushApi.QqbotMessagePublishBindingView,
      context: KtTableContext<QqbotMessagePushApi.QqbotMessagePublishBindingView>,
    ) {
      await setAccountMessagePushBindingEnabled(
        props.selfId,
        row.id,
        !row.enabled,
      );
      await context.reload();
    }

    /**
     * 删除账号消息推送绑定，并重新加载当前表格。
     *
     * @param row - 要删除的账号消息推送绑定。
     * @param context - 删除完成后用于重新加载列表的 KtTable 行操作上下文。
     */
    async function handleDelete(
      row: QqbotMessagePushApi.QqbotMessagePublishBindingView,
      context: KtTableContext<QqbotMessagePushApi.QqbotMessagePublishBindingView>,
    ) {
      await deleteAccountMessagePushBinding(props.selfId, row.id);
      await context.reload();
    }

    /**
     * 当消息推送绑定保存后重新加载列表。
     */
    async function handleModalSaved() {
      await tableApi.reload();
    }

    /**
     * 按固定页容量连续拉取元数据，达到总数、末页或页数上限时停止并返回合并记录。
     *
     * @param loader - 按页返回消息推送记录、供函数持续读取至末页的加载器。
     * @returns 在总数、末页或页数上限内合并得到的全部元数据记录。
     */
    async function loadAllPages<Row>(
      loader: (params: {
        pageNo: number;
        pageSize: number;
      }) => Promise<QqbotMessagePushApi.PageResult<Row>>,
    ): Promise<Row[]> {
      const rows: Row[] = [];
      for (let pageNo = 1; pageNo <= METADATA_MAX_PAGES; pageNo += 1) {
        const page = await loader({
          pageNo,
          pageSize: METADATA_PAGE_SIZE,
        });
        rows.push(...page.items);
        if (
          !Number.isFinite(page.total) ||
          page.total < 0 ||
          rows.length >= page.total ||
          page.items.length < METADATA_PAGE_SIZE
        ) {
          break;
        }
      }
      return rows;
    }

    /**
     * 加载指定账号可用的推送来源、模板和现有绑定，并忽略已经过期的响应代次。
     *
     * @param selfId - 目标 QQBot 账号的稳定标识。
     * @param revision - 本次加载启动时捕获的代次；与最新代次不同时丢弃响应。
     */
    async function loadMetadata(selfId: string, revision: number) {
      targetOptionsLoading.value = canLoadTargets;
      const [subscriptionResult, templateResult, targetResult] =
        await Promise.allSettled([
          loadAllPages((params) => getMessageSubscriptionList(params)),
          loadAllPages((params) => getMessageTemplateList(params)),
          (() => {
            if (canLoadTargets) {
              return getAccountMessagePushTargets(selfId);
            }
            return Promise.resolve(undefined);
          })(),
        ]);
      if (revision !== loadRevision || selfId !== props.selfId) return;
      if (subscriptionResult.status === 'fulfilled') {
        subscriptions.value = subscriptionResult.value;
      }
      if (templateResult.status === 'fulfilled') {
        templates.value = templateResult.value;
      }
      if (targetResult.status === 'fulfilled') {
        targetOptions.value = targetResult.value;
      }
      targetOptionsLoading.value = false;
    }

    /**
     * 切换账号时清空旧元数据，并行加载绑定表格与新账号元数据；空 Self ID 只保留空态。
     *
     * @param selfId - 目标 QQBot 账号的稳定标识。
     */
    async function loadAccount(selfId: string) {
      const revision = ++loadRevision;
      latestBindingPage = { items: [], total: 0 };
      subscriptions.value = [];
      templates.value = [];
      targetOptions.value = undefined;
      if (!selfId) {
        targetOptionsLoading.value = false;
        return;
      }
      await Promise.allSettled([
        tableApi.reload(),
        loadMetadata(selfId, revision),
      ]);
    }

    /**
     * 把目标面板切换为当前项，并在需要时同步路由查询参数。
     */
    function activatePanel() {
      if (canList && props.selfId) void loadAccount(props.selfId);
    }

    /**
     * 递增加载代次并取消仍在等待的请求，使迟到响应无法写回页面状态。
     */
    function invalidatePendingLoad() {
      loadRevision += 1;
    }

    /**
     * 根据列键渲染消息来源、推送目标或启用状态；其他列返回 undefined。
     *
     * @param slot - KtTable 提供的消息推送绑定记录及当前列定义。
     * @returns 消息来源文本、目标标签组或启用状态标签；其他列返回 undefined。
     */
    function renderBodyCell(slot: {
      column: TableColumnType<QqbotMessagePushApi.QqbotMessagePublishBindingView>;
      record: QqbotMessagePushApi.QqbotMessagePublishBindingView;
    }) {
      const { column, record } = slot;
      if (column.key === 'source') {
        return `${record.sourceName} · ${record.sourceKey}`;
      }
      if (column.key === 'targets') {
        return (
          <Space wrap>
            {record.targets.map((target) => (
              <Tag key={`${target.targetType}:${target.targetId}`}>
                {(() => {
                  if (target.targetType === 'group') {
                    return '群';
                  }
                  return '私聊';
                })()}{' '}
                · {target.targetName || target.targetId}
              </Tag>
            ))}
          </Space>
        );
      }
      if (column.key === 'enabled') {
        let color = 'warning';
        let label = record.invalidReasonCode || 'unavailable';
        if (record.available) {
          if (record.enabled) {
            color = 'success';
          } else {
            color = 'default';
          }
          if (record.enabled) {
            label = '启用';
          } else {
            label = '停用';
          }
        }
        return <Tag color={color}>{label}</Tag>;
      }
      return undefined;
    }

    onMounted(activatePanel);
    onBeforeUnmount(invalidatePendingLoad);
    watch(
      () => props.selfId,
      (selfId, previousSelfId) => {
        if (!canList || selfId === previousSelfId) return;
        void loadAccount(selfId);
      },
    );

    return () => (
      <div class="qqbot-account-config-panel__spin qqbot-account-message-push-panel">
        {(() => {
          if (canList) {
            return (
              <>
                <AKtTable
                  class="qqbot-account-config-panel__table qqbot-account-message-push-panel__table"
                  onRegister={registerTable}
                  v-slots={{
                    bodyCell: renderBodyCell,
                    headerControls: props.headerControls,
                    title: props.title,
                  }}
                />
                <AccountMessagePushModal
                  onSaved={handleModalSaved}
                  ref={modalRef}
                  selfId={props.selfId}
                  subscriptions={subscriptions.value}
                  targetOptions={targetOptions.value}
                  targetOptionsLoading={targetOptionsLoading.value}
                  templates={templates.value}
                />
              </>
            );
          }
          return null;
        })()}
      </div>
    );
  },
});
