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
        rowKey: 'id',
        tableTitle: '消息模板',
      });

    function openCreate() {
      modalRef.value?.openCreate();
    }

    function openEdit(row: QqbotMessagePushApi.MessageTemplateView) {
      modalRef.value?.openEdit(row);
    }

    function getDeleteConfirm(row: QqbotMessagePushApi.MessageTemplateView) {
      return `确认删除消息模板「${row.name}」吗？`;
    }

    function getDeleteDisabledReason(
      row: QqbotMessagePushApi.MessageTemplateView,
    ) {
      return row.referenceCount > 0
        ? `已有 ${row.referenceCount} 个发布绑定引用，无法删除`
        : undefined;
    }

    async function handleToggle(
      row: QqbotMessagePushApi.MessageTemplateView,
      context: KtTableContext<QqbotMessagePushApi.MessageTemplateView>,
    ) {
      await setMessageTemplateEnabled(row.id, !row.enabled);
      await context.reload();
    }

    async function handleDelete(
      row: QqbotMessagePushApi.MessageTemplateView,
      context: KtTableContext<QqbotMessagePushApi.MessageTemplateView>,
    ) {
      await deleteMessageTemplate(row.id);
      await context.reload();
    }

    async function handleModalSaved() {
      await tableApi.reload();
    }

    async function loadSources() {
      sources.value = await getMessagePushSources();
    }

    async function activatePage() {
      if (!canList) return;
      await Promise.all([tableApi.reload(), loadSources()]);
    }

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
