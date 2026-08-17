import type { TableColumnType } from 'antdv-next';

import type { MessageTemplateModalExposed } from './components/MessageTemplateModal';

import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/kt-table';

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
import { KtTable, useKtTable } from '#/components/kt-table';

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

    /**
     * 通过消息模板子弹窗组件开始新建会话。
     */
    function openCreate() {
      modalRef.value?.openCreate();
    }

    /**
     * 将选中消息模板交给子弹窗组件开始编辑。
     *
     * @param row - 要传给模板编辑弹窗的消息模板记录。
     */
    function openEdit(row: QqbotMessagePushApi.MessageTemplateView) {
      modalRef.value?.openEdit(row);
    }

    /**
     * 根据模板名称生成删除消息模板的确认文本。
     *
     * @param row - 准备删除、需要在确认框展示名称和引用数的消息模板。
     * @returns 包含模板名称的删除确认文本。
     */
    function getDeleteConfirm(row: QqbotMessagePushApi.MessageTemplateView) {
      return `确认删除消息模板「${row.name}」吗？`;
    }

    /**
     * 当消息模板仍被发布绑定引用时返回引用数量提示，否则允许删除。
     *
     * @param row - 需要检查发布绑定引用数的消息模板。
     * @returns 模板被发布绑定引用时返回引用数量提示；未被引用时返回 undefined。
     */
    function getDeleteDisabledReason(
      row: QqbotMessagePushApi.MessageTemplateView,
    ) {
      if (row.referenceCount > 0) {
        return `已有 ${row.referenceCount} 个发布绑定引用，无法删除`;
      }
      return undefined;
    }

    /**
     * 切换消息模板启用状态，并重新加载当前列表。
     *
     * @param row - 要切换启用状态的消息模板记录。
     * @param context - 切换完成后用于重新加载列表的 KtTable 行操作上下文。
     */
    async function handleToggle(
      row: QqbotMessagePushApi.MessageTemplateView,
      context: KtTableContext<QqbotMessagePushApi.MessageTemplateView>,
    ) {
      await setMessageTemplateEnabled(row.id, !row.enabled);
      await context.reload();
    }

    /**
     * 删除选中消息模板，并重新加载当前列表。
     *
     * @param row - 要删除的消息模板记录。
     * @param context - 删除完成后用于重新加载列表的 KtTable 行操作上下文。
     */
    async function handleDelete(
      row: QqbotMessagePushApi.MessageTemplateView,
      context: KtTableContext<QqbotMessagePushApi.MessageTemplateView>,
    ) {
      await deleteMessageTemplate(row.id);
      await context.reload();
    }

    /**
     * 当消息模板保存后重新加载列表。
     */
    async function handleModalSaved() {
      await tableApi.reload();
    }

    /**
     * 加载可用于消息模板的推送来源并更新来源选项。
     */
    async function loadSources() {
      sources.value = await getMessagePushSources();
    }

    /**
     * 恢复当前标签页的 keep-alive 激活状态，并执行注册的页面激活回调。
     */
    async function activatePage() {
      if (!canList) return;
      await Promise.all([tableApi.reload(), loadSources()]);
    }

    /**
     * 根据列键渲染消息来源、内容摘要或启用状态；其他列返回 undefined。
     *
     * @param slot - KtTable 提供的消息模板记录及当前列定义。
     * @returns 消息来源、内容摘要或启用状态节点；其他列返回 undefined。
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
          <Tag
            color={(() => {
              if (record.enabled) {
                return 'success';
              }
              return 'default';
            })()}
          >
            {(() => {
              if (record.enabled) {
                return '启用';
              }
              return '停用';
            })()}
          </Tag>
        );
      }
      return undefined;
    }

    onMounted(activatePage);

    return () => (
      <Page autoContentHeight>
        {(() => {
          if (canList) {
            return (
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
            );
          }
          return null;
        })()}
      </Page>
    );
  },
});
