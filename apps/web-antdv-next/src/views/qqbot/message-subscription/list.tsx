import type { TableColumnType } from 'antdv-next';

import type { MessageSubscriptionModalExposed } from './components/MessageSubscriptionModal';

import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/ktTable';

import { defineComponent, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Tag } from 'antdv-next';

import {
  deleteMessageSubscription,
  getMessagePushSources,
  getMessageSubscriptionList,
  getStunMappingPortChangedOptions,
  setMessageSubscriptionEnabled,
} from '#/api/qqbot/message-push';
import { KtTable, useKtTable } from '#/components/ktTable';

import MessageSubscriptionModal from './components/MessageSubscriptionModal';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'QqBotMessageSubscriptionList',
  /**
   * Owns the permission-gated subscription table, metadata cache, and row reloads.
   */
  setup() {
    const { hasAccessByCodes } = useAccess();
    const canList = hasAccessByCodes(['QqBot:MessageSubscription:List']);
    const modalRef = ref<MessageSubscriptionModalExposed>();
    const sources = ref<QqbotMessagePushApi.SystemMessageSourceDefinition[]>(
      [],
    );
    const stunOptions =
      ref<QqbotMessagePushApi.StunMappingPortChangedOptionsResponse>();
    const columns: Array<
      TableColumnType<QqbotMessagePushApi.MessageSubscriptionView>
    > = [
      {
        dataIndex: 'name',
        key: 'name',
        title: '订阅名称',
        width: 180,
      },
      {
        key: 'source',
        title: '消息源',
        width: 260,
      },
      {
        dataIndex: 'sourceSummary',
        key: 'sourceSummary',
        title: '来源摘要',
        width: 260,
      },
      {
        dataIndex: 'enabled',
        key: 'enabled',
        title: '状态',
        width: 90,
      },
      {
        dataIndex: 'remark',
        key: 'remark',
        title: '备注',
        width: 220,
      },
      {
        dataIndex: 'updateTime',
        key: 'updateTime',
        title: '更新时间',
        width: 180,
      },
    ];
    const api: KtTableApi<QqbotMessagePushApi.MessageSubscriptionView> = {
      /** Passes the caller's strict `{ items, total }` page through unchanged. */
      list: async (params) => await getMessageSubscriptionList(params),
    };
    const buttons: Array<
      KtTableButton<QqbotMessagePushApi.MessageSubscriptionView>
    > = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: '新建订阅',
        onClick: openCreate,
        permissionCodes: ['QqBot:MessageSubscription:Create'],
        type: 'primary',
      },
    ];
    const rowActions: Array<
      KtTableRowAction<QqbotMessagePushApi.MessageSubscriptionView>
    > = [
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        permissionCodes: ['QqBot:MessageSubscription:Update'],
      },
      {
        key: 'toggle',
        label: '启停',
        onClick: handleToggle,
        permissionCodes: ['QqBot:MessageSubscription:Toggle'],
      },
      {
        confirm: getDeleteConfirm,
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: handleDelete,
        permissionCodes: ['QqBot:MessageSubscription:Delete'],
      },
    ];
    const [registerTable, tableApi] =
      useKtTable<QqbotMessagePushApi.MessageSubscriptionView>({
        api,
        buttons,
        columns,
        formOptions: {
          schema: [
            {
              component: 'Input',
              componentProps: { allowClear: true },
              fieldName: 'name',
              label: '订阅名称',
            },
            {
              component: 'Select',
              componentProps: () => ({
                allowClear: true,
                options: sources.value.map((source) => ({
                  label: source.displayName,
                  value: source.sourceKey,
                })),
              }),
              fieldName: 'sourceKey',
              label: '消息源',
            },
            {
              component: 'Select',
              componentProps: {
                allowClear: true,
                options: [
                  { label: '启用', value: true },
                  { label: '停用', value: false },
                ],
              },
              fieldName: 'enabled',
              label: '启用状态',
            },
          ],
        },
        immediate: false,
        rowActions,
        rowActionVisibleCount: 3,
        rowKey: 'id',
        tableTitle: '消息订阅',
      });

    /** Opens a blank modal session through the page-owned exposed ref. */
    function openCreate() {
      modalRef.value?.openCreate();
    }

    /**
     * Opens one row without copying page-only runtime state into the modal.
     * @param row - Subscription selected from KtTable.
     */
    function openEdit(row: QqbotMessagePushApi.MessageSubscriptionView) {
      modalRef.value?.openEdit(row);
    }

    /**
     * Builds KtTable's delete confirmation text for one subscription.
     * @param row - Subscription awaiting delete confirmation.
     * @returns Human-readable confirmation text containing the row name.
     */
    function getDeleteConfirm(
      row: QqbotMessagePushApi.MessageSubscriptionView,
    ) {
      return `确认删除消息订阅「${row.name}」吗？`;
    }

    /**
     * Toggles one row and reloads only that table context after success.
     * @param row - Subscription whose enabled state is inverted.
     * @param context - KtTable row-action context owning the list reload.
     */
    async function handleToggle(
      row: QqbotMessagePushApi.MessageSubscriptionView,
      context: KtTableContext<QqbotMessagePushApi.MessageSubscriptionView>,
    ) {
      await setMessageSubscriptionEnabled(row.id, !row.enabled);
      await context.reload();
    }

    /**
     * Deletes one row and reloads only that table context after success.
     * @param row - Subscription confirmed through KtTable's action system.
     * @param context - KtTable row-action context owning the list reload.
     */
    async function handleDelete(
      row: QqbotMessagePushApi.MessageSubscriptionView,
      context: KtTableContext<QqbotMessagePushApi.MessageSubscriptionView>,
    ) {
      await deleteMessageSubscription(row.id);
      await context.reload();
    }

    /** Reloads the mutable list exactly once after a successful modal save. */
    async function handleModalSaved() {
      await tableApi.reload();
    }

    /** Loads immutable source metadata once for the authorized page mount. */
    async function loadMetadata() {
      const [nextSources, nextStunOptions] = await Promise.all([
        getMessagePushSources(),
        getStunMappingPortChangedOptions(),
      ]);
      sources.value = nextSources;
      stunOptions.value = nextStunOptions;
    }

    /** Starts the single authorized list and metadata load for this mount. */
    async function activatePage() {
      if (!canList) return;
      await Promise.all([tableApi.reload(), loadMetadata()]);
    }

    /**
     * Renders source, status, and empty-value presentation for data columns.
     * @param slot - KtTable body-cell slot payload.
     * @param slot.column - Column whose custom presentation is requested.
     * @param slot.record - Subscription row rendered by the table.
     * @returns Custom cell content or undefined for native field rendering.
     */
    function renderBodyCell(slot: {
      column: TableColumnType<QqbotMessagePushApi.MessageSubscriptionView>;
      record: QqbotMessagePushApi.MessageSubscriptionView;
    }) {
      const { column, record } = slot;
      if (column.key === 'source') {
        return `${record.sourceName} · ${record.sourceKey}`;
      }
      if (column.key === 'enabled') {
        return (
          <Tag color={record.enabled ? 'success' : 'default'}>
            {record.enabled ? '启用' : '停用'}
          </Tag>
        );
      }
      if (column.key === 'remark') {
        return record.remark || '-';
      }
      return undefined;
    }

    onMounted(activatePage);

    return () => (
      <Page autoContentHeight>
        {canList ? (
          <>
            <AKtTable
              onRegister={registerTable}
              v-slots={{ bodyCell: renderBodyCell }}
            />
            <MessageSubscriptionModal
              onSaved={handleModalSaved}
              ref={modalRef}
              sources={sources.value}
              stunOptions={stunOptions.value}
            />
          </>
        ) : null}
      </Page>
    );
  },
});
