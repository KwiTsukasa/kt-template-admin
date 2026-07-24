import type { TableColumnType } from 'antdv-next';

import type { MessageTemplateModalExposed } from './components/MessageTemplateModal';

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

import Tag from 'antdv-next/dist/tag/index';

import {
  deleteMessageTemplate,
  getMessagePushSources,
  getMessageTemplateList,
  setMessageTemplateEnabled,
} from '#/api/qqbot/message-push';
import { KtTable, useKtTable } from '#/components/ktTable';

import MessageTemplateModal from './components/MessageTemplateModal';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'QqBotMessageTemplateList',
  /** Owns the permission-gated template list, source labels, and row mutations. */
  setup() {
    const { hasAccessByCodes } = useAccess();
    const canList = hasAccessByCodes(['QqBot:MessageTemplate:List']);
    const canPreview = hasAccessByCodes(['QqBot:MessageTemplate:Preview']);
    const modalRef = ref<MessageTemplateModalExposed>();
    const sources = ref<QqbotMessagePushApi.SystemMessageSourceDefinition[]>(
      [],
    );
    const columns: Array<
      TableColumnType<QqbotMessagePushApi.MessageTemplateView>
    > = [
      { dataIndex: 'name', key: 'name', title: '模板名称', width: 180 },
      { key: 'source', title: '消息源', width: 260 },
      { key: 'contentSummary', title: '内容摘要', width: 320 },
      {
        dataIndex: 'referenceCount',
        key: 'referenceCount',
        title: '引用数量',
        width: 100,
      },
      { dataIndex: 'enabled', key: 'enabled', title: '状态', width: 90 },
      {
        dataIndex: 'updateTime',
        key: 'updateTime',
        title: '更新时间',
        width: 180,
      },
    ];
    const api: KtTableApi<QqbotMessagePushApi.MessageTemplateView> = {
      /** Passes the caller's strict `{ items, total }` page through unchanged. */
      list: async (params) => await getMessageTemplateList(params),
    };
    const buttons: Array<
      KtTableButton<QqbotMessagePushApi.MessageTemplateView>
    > = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: '新建模板',
        onClick: openCreate,
        permissionCodes: ['QqBot:MessageTemplate:Create'],
        type: 'primary',
      },
    ];
    const rowActions: Array<
      KtTableRowAction<QqbotMessagePushApi.MessageTemplateView>
    > = [
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        permissionCodes: ['QqBot:MessageTemplate:Update'],
      },
      {
        key: 'toggle',
        label: '启停',
        onClick: handleToggle,
        permissionCodes: ['QqBot:MessageTemplate:Toggle'],
      },
      {
        confirm: getDeleteConfirm,
        danger: true,
        disabled: (row) => row.referenceCount > 0,
        disabledReason: getDeleteDisabledReason,
        key: 'delete',
        label: '删除',
        onClick: handleDelete,
        permissionCodes: ['QqBot:MessageTemplate:Delete'],
      },
    ];
    const [registerTable, tableApi] =
      useKtTable<QqbotMessagePushApi.MessageTemplateView>({
        api,
        buttons,
        columns,
        formOptions: {
          schema: [
            {
              component: 'Input',
              componentProps: { allowClear: true },
              fieldName: 'name',
              label: '模板名称',
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
        tableTitle: '消息模板',
      });

    /** Opens a blank template session through the page-owned exposed ref. */
    function openCreate() {
      modalRef.value?.openCreate();
    }

    /**
     * Opens one row without copying page-only runtime state into the modal.
     * @param row - Template selected from KtTable.
     */
    function openEdit(row: QqbotMessagePushApi.MessageTemplateView) {
      modalRef.value?.openEdit(row);
    }

    /**
     * Builds KtTable confirmation for one currently unreferenced template.
     * @param row - Template awaiting delete confirmation.
     * @returns Confirmation text containing the template name.
     */
    function getDeleteConfirm(row: QqbotMessagePushApi.MessageTemplateView) {
      return `确认删除消息模板「${row.name}」吗？`;
    }

    /**
     * Explains why a referenced template cannot be deleted from the current row.
     * @param row - Template whose current reference count controls the action.
     * @returns Count-bearing reason, or undefined when delete is enabled.
     */
    function getDeleteDisabledReason(
      row: QqbotMessagePushApi.MessageTemplateView,
    ) {
      return row.referenceCount > 0
        ? `已有 ${row.referenceCount} 个发布绑定引用，无法删除`
        : undefined;
    }

    /**
     * Toggles one row and reloads only its KtTable context after success.
     * @param row - Template whose enabled state is inverted.
     * @param context - Row-action context owning the affected list.
     */
    async function handleToggle(
      row: QqbotMessagePushApi.MessageTemplateView,
      context: KtTableContext<QqbotMessagePushApi.MessageTemplateView>,
    ) {
      await setMessageTemplateEnabled(row.id, !row.enabled);
      await context.reload();
    }

    /**
     * Deletes one row and reloads only its KtTable context after success.
     * @param row - Unreferenced template confirmed through KtTable.
     * @param context - Row-action context owning the affected list.
     */
    async function handleDelete(
      row: QqbotMessagePushApi.MessageTemplateView,
      context: KtTableContext<QqbotMessagePushApi.MessageTemplateView>,
    ) {
      await deleteMessageTemplate(row.id);
      await context.reload();
    }

    /** Reloads the mutable list exactly once after one successful modal save. */
    async function handleModalSaved() {
      await tableApi.reload();
    }

    /** Loads the page-lifetime source directory once for an authorized mount. */
    async function loadSources() {
      sources.value = await getMessagePushSources();
    }

    /** Starts the only automatic list/source load for this route mount. */
    async function activatePage() {
      if (!canList) return;
      await Promise.all([tableApi.reload(), loadSources()]);
    }

    /**
     * Renders source, literal content summary, and enabled presentation.
     * @param slot - KtTable body-cell payload.
     * @param slot.column - Column requesting a custom presentation.
     * @param slot.record - Template row rendered by the table.
     * @returns Escaped text/status content or undefined for native rendering.
     */
    function renderBodyCell(slot: {
      column: TableColumnType<QqbotMessagePushApi.MessageTemplateView>;
      record: QqbotMessagePushApi.MessageTemplateView;
    }) {
      const { column, record } = slot;
      if (column.key === 'source') {
        return `${record.sourceName} · ${record.sourceKey}`;
      }
      if (column.key === 'contentSummary') {
        return (
          <span class="line-clamp-2 whitespace-pre-wrap break-words">
            {record.content}
          </span>
        );
      }
      if (column.key === 'enabled') {
        return (
          <Tag color={record.enabled ? 'success' : 'default'}>
            {record.enabled ? '启用' : '停用'}
          </Tag>
        );
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
            <MessageTemplateModal
              canPreview={canPreview}
              onSaved={handleModalSaved}
              ref={modalRef}
              sources={sources.value}
            />
          </>
        ) : null}
      </Page>
    );
  },
});
