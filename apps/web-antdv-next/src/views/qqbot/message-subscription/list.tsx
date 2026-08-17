import type { TableColumnType } from 'antdv-next';

import type { MessageSubscriptionModalExposed } from './components/MessageSubscriptionModal';

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

import { Tag } from 'antdv-next';

import {
  deleteMessageSubscription,
  getMessagePushSources,
  getMessageSubscriptionList,
  setMessageSubscriptionEnabled,
} from '#/api/qqbot/message-push';
import { KtTable, useKtTable } from '#/components/kt-table';

import MessageSubscriptionModal from './components/MessageSubscriptionModal';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'QqBotMessageSubscriptionList',
  setup() {
    const { hasAccessByCodes } = useAccess();
    const canList = hasAccessByCodes(['QqBot:MessageSubscription:List']);
    const modalRef = ref<MessageSubscriptionModalExposed>();
    const sources = ref<QqbotMessagePushApi.SystemMessageSourceDefinition[]>(
      [],
    );
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
        rowKey: 'id',
        tableTitle: '消息订阅',
      });

    /**
     * 通过订阅弹窗 API 打开无初始记录的新建模式。
     */
    function openCreate() {
      modalRef.value?.openCreate();
    }

    /**
     * 把目标订阅传入弹窗 API 并打开编辑模式。
     *
     * @param row - 要编辑、切换或删除的消息订阅记录。
     */
    function openEdit(row: QqbotMessagePushApi.MessageSubscriptionView) {
      modalRef.value?.openEdit(row);
    }

    /**
     * 根据订阅名称生成删除确认标题与正文。
     *
     * @param row - 要编辑、切换或删除的消息订阅记录。
     * @returns 包含订阅名称的删除确认标题与正文。
     */
    function getDeleteConfirm(
      row: QqbotMessagePushApi.MessageSubscriptionView,
    ) {
      return `确认删除消息订阅「${row.name}」吗？`;
    }

    /**
     * 切换订阅启用状态并刷新当前表格上下文。
     *
     * @param row - 要编辑、切换或删除的消息订阅记录。
     * @param context - 启用状态更新后用来重新加载订阅列表的 KtTable 上下文。
     */
    async function handleToggle(
      row: QqbotMessagePushApi.MessageSubscriptionView,
      context: KtTableContext<QqbotMessagePushApi.MessageSubscriptionView>,
    ) {
      await setMessageSubscriptionEnabled(row.id, !row.enabled);
      await context.reload();
    }

    /**
     * 在后端删除目标订阅后刷新当前 KtTable 页面。
     *
     * @param row - 要编辑、切换或删除的消息订阅记录。
     * @param context - 删除成功后用来重新加载订阅列表的 KtTable 上下文。
     */
    async function handleDelete(
      row: QqbotMessagePushApi.MessageSubscriptionView,
      context: KtTableContext<QqbotMessagePushApi.MessageSubscriptionView>,
    ) {
      await deleteMessageSubscription(row.id);
      await context.reload();
    }

    /**
     * 在弹窗保存成功后刷新订阅列表。
     */
    async function handleModalSaved() {
      await tableApi.reload();
    }

    /**
     * 从后端加载系统消息源目录，并更新弹窗与表格展示依赖。
     */
    async function loadSources() {
      sources.value = await getMessagePushSources();
    }

    /**
     * 首次进入页面时并行加载列表与消息源目录。
     */
    async function activatePage() {
      if (!canList) return;
      await Promise.all([tableApi.reload(), loadSources()]);
    }

    /**
     * 根据列键渲染订阅来源、状态或操作单元格，其他列交还默认插槽。
     *
     * @param slot - KtTable 单元格插槽提供的列配置与订阅记录。
     * @returns 来源、启用状态或操作列的自定义节点；其他列返回 undefined。
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
      if (column.key === 'remark') {
        return record.remark || '-';
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
                <MessageSubscriptionModal
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
