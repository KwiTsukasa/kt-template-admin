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

    function openCreate() {
      modalRef.value?.openCreate();
    }

    function openEdit(row: QqbotMessagePushApi.QqbotMessagePublishBindingView) {
      modalRef.value?.openEdit(row);
    }

    function getDeleteConfirm(
      row: QqbotMessagePushApi.QqbotMessagePublishBindingView,
    ): string {
      return `确认解绑消息订阅「${row.subscriptionName}」吗？`;
    }

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

    async function handleDelete(
      row: QqbotMessagePushApi.QqbotMessagePublishBindingView,
      context: KtTableContext<QqbotMessagePushApi.QqbotMessagePublishBindingView>,
    ) {
      await deleteAccountMessagePushBinding(props.selfId, row.id);
      await context.reload();
    }

    async function handleModalSaved() {
      await tableApi.reload();
    }

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

    function activatePanel() {
      if (canList && props.selfId) void loadAccount(props.selfId);
    }

    function invalidatePendingLoad() {
      loadRevision += 1;
    }

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
