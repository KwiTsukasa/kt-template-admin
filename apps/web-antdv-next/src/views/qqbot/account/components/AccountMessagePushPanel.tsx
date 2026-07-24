import type { TableColumnType } from 'antdv-next';

import type { PropType, VNodeChild } from 'vue';

import type { AccountMessagePushModalExposed } from './AccountMessagePushModal';

import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/ktTable';

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
import { KtTable, useKtTable } from '#/components/ktTable';

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
  /** Owns one permission-gated account binding table and per-account option cache. */
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
        /**
         * Adapts the account binding array while returning the latest page for stale requests.
         * @returns Strict KtTable page retaining every string identifier.
         */
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
        rowActionVisibleCount: 3,
        rowKey: 'id',
        showDefaultButtons: false,
        showFooter: false,
        showIndex: false,
        showPagination: false,
        showTableSetting: false,
        size: 'small',
      });

    /** Opens a blank binding session for this panel's implicit account. */
    function openCreate() {
      modalRef.value?.openCreate();
    }

    /**
     * Opens one existing binding without deriving another account identity.
     * @param row - Binding selected from this account's KtTable.
     */
    function openEdit(row: QqbotMessagePushApi.QqbotMessagePublishBindingView) {
      modalRef.value?.openEdit(row);
    }

    /**
     * Builds account-binding removal confirmation text.
     * @param row - Binding awaiting removal.
     * @returns Confirmation containing the global subscription name.
     */
    function getDeleteConfirm(
      row: QqbotMessagePushApi.QqbotMessagePublishBindingView,
    ): string {
      return `确认解绑消息订阅「${row.subscriptionName}」吗？`;
    }

    /**
     * Toggles one binding and reloads only the mutable binding list after success.
     * @param row - Binding whose enabled state is inverted.
     * @param context - Registered KtTable action context.
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
     * Removes one binding and reloads only the mutable binding list after success.
     * @param row - Binding confirmed for account-scoped removal.
     * @param context - Registered KtTable action context.
     */
    async function handleDelete(
      row: QqbotMessagePushApi.QqbotMessagePublishBindingView,
      context: KtTableContext<QqbotMessagePushApi.QqbotMessagePublishBindingView>,
    ) {
      await deleteAccountMessagePushBinding(props.selfId, row.id);
      await context.reload();
    }

    /** Reloads only bindings after one successful modal persistence. */
    async function handleModalSaved() {
      await tableApi.reload();
    }

    /**
     * Loads the complete subscription/template collection in bounded 100-row pages.
     * @param loader - One strict page caller receiving pageNo/pageSize.
     * @returns Concatenated server rows until total is reached or progress stops.
     */
    async function loadAllPages<Row>(
      loader: (params: {
        pageNo: number;
        pageSize: number;
      }) => Promise<QqbotMessagePushApi.PageResult<Row>>,
    ): Promise<Row[]> {
      const rows: Row[] = [];
      for (let pageNo = 1; pageNo <= 1000; pageNo += 1) {
        const page = await loader({ pageNo, pageSize: 100 });
        rows.push(...page.items);
        if (rows.length >= page.total || page.items.length === 0) break;
      }
      return rows;
    }

    /**
     * Loads per-account modal metadata once and applies only the latest revision.
     * @param selfId - Exact account identity captured for this load.
     * @param revision - Monotonic revision assigned by `loadAccount`.
     */
    async function loadMetadata(selfId: string, revision: number) {
      targetOptionsLoading.value = canLoadTargets;
      const [subscriptionResult, templateResult, targetResult] =
        await Promise.allSettled([
          loadAllPages((params) => getMessageSubscriptionList(params)),
          loadAllPages((params) => getMessageTemplateList(params)),
          canLoadTargets
            ? getAccountMessagePushTargets(selfId)
            : Promise.resolve(undefined),
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
     * Starts exactly one logical load for a new nonempty account identity.
     * @param selfId - Current implicit account identity.
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

    /** Starts the one authorized initial account load after table registration. */
    function activatePanel() {
      if (canList && props.selfId) void loadAccount(props.selfId);
    }

    /** Invalidates any pending request when this tab's panel unmounts. */
    function invalidatePendingLoad() {
      loadRevision += 1;
    }

    /**
     * Renders source, targets, availability, and enabled state.
     * @param slot - KtTable body-cell slot payload.
     * @param slot.column - Current data column.
     * @param slot.record - Current account binding.
     * @returns Custom cell content or undefined for native field rendering.
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
                {target.targetType === 'group' ? '群' : '私聊'} ·{' '}
                {target.targetName || target.targetId}
              </Tag>
            ))}
          </Space>
        );
      }
      if (column.key === 'enabled') {
        let color = 'warning';
        let label = record.invalidReasonCode || 'unavailable';
        if (record.available) {
          color = record.enabled ? 'success' : 'default';
          label = record.enabled ? '启用' : '停用';
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
        {canList ? (
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
        ) : null}
      </div>
    );
  },
});
