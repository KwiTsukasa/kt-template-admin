import type { TableColumnType } from 'antdv-next';

import type { MessageSubscriptionModalExposed } from './components/MessageSubscriptionModal';

import type { MessageManagementApi } from '#/api/message-management';
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

import { Space, Tag } from 'antdv-next';

import {
  deleteMessageSubscription,
  getMessageSources,
  getMessageSubscribers,
  getMessageSubscriptionList,
  getMessageTemplateList,
  setMessageSubscriptionEnabled,
} from '#/api/message-management';
import { KtTable, useKtTable } from '#/components/kt-table';

import MessageSubscriptionModal from './components/MessageSubscriptionModal';

const AKtTable = KtTable as any;
const CATALOG_PAGE_SIZE = 100;
const CATALOG_MAX_PAGES = 100;

type MessageSubscriptionBodyCellSlot = {
  column: TableColumnType<MessageManagementApi.MessageSubscriptionView>;
  record: MessageManagementApi.MessageSubscriptionView;
};

export default defineComponent({
  name: 'MessageManagementSubscriptionList',
  setup() {
    const { hasAccessByCodes } = useAccess();
    const canList = hasAccessByCodes(['MessageManagement:Subscription:List']);
    const modalRef = ref<MessageSubscriptionModalExposed>();
    const sources = ref<MessageManagementApi.SystemMessageSourceDefinition[]>(
      [],
    );
    const subscribers = ref<MessageManagementApi.MessageSubscriberDefinition[]>(
      [],
    );
    const templates = ref<MessageManagementApi.MessageTemplateView[]>([]);
    const columns: Array<
      TableColumnType<MessageManagementApi.MessageSubscriptionView>
    > = [
      { dataIndex: 'name', key: 'name', title: '订阅名称', width: 180 },
      { key: 'templates', title: '消息模板', width: 300 },
      { key: 'subscriber', title: '消息订阅者', width: 150 },
      { key: 'source', title: '消息源', width: 240 },
      {
        dataIndex: 'sourceSummary',
        key: 'sourceSummary',
        title: '来源配置',
        width: 240,
      },
      { dataIndex: 'enabled', key: 'enabled', title: '状态', width: 90 },
      { dataIndex: 'remark', key: 'remark', title: '备注', width: 200 },
      {
        dataIndex: 'updateTime',
        key: 'updateTime',
        title: '更新时间',
        width: 180,
      },
    ];
    const api: KtTableApi<MessageManagementApi.MessageSubscriptionView> = {
      list: async (params) => getMessageSubscriptionList(params),
    };
    const buttons: Array<
      KtTableButton<MessageManagementApi.MessageSubscriptionView>
    > = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: '新建订阅',
        onClick: openCreate,
        permissionCodes: ['MessageManagement:Subscription:Create'],
        type: 'primary',
      },
    ];
    const rowActions: Array<
      KtTableRowAction<MessageManagementApi.MessageSubscriptionView>
    > = [
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        permissionCodes: ['MessageManagement:Subscription:Update'],
      },
      {
        key: 'toggle',
        label: '启停',
        onClick: handleToggle,
        permissionCodes: ['MessageManagement:Subscription:Toggle'],
      },
      {
        confirm: getDeleteConfirm,
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: handleDelete,
        permissionCodes: ['MessageManagement:Subscription:Delete'],
      },
    ];
    const [registerTable, tableApi] =
      useKtTable<MessageManagementApi.MessageSubscriptionView>({
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
                options: templates.value.map((template) => ({
                  label: template.name,
                  value: template.id,
                })),
                showSearch: true,
              }),
              fieldName: 'templateId',
              label: '消息模板',
            },
            {
              component: 'Select',
              componentProps: () => ({
                allowClear: true,
                options: subscribers.value.map((subscriber) => ({
                  label: subscriber.displayName,
                  value: subscriber.subscriberKey,
                })),
              }),
              fieldName: 'subscriberKey',
              label: '消息订阅者',
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
     * 新建入口保持模板与订阅者为空，让用户显式确定来源和接收方。
     */
    function openCreate() {
      modalRef.value?.openCreate();
    }

    /**
     * 把目标统一消息订阅交给弹窗进入编辑模式。
     *
     * @param row - 待编辑的多模板消息订阅。
     */
    function openEdit(row: MessageManagementApi.MessageSubscriptionView) {
      modalRef.value?.openEdit(row);
    }

    /**
     * 把订阅名称写入二次确认文案，降低误删相邻统一路由规则的风险。
     *
     * @param row - 待删除的消息订阅。
     * @returns 消息订阅删除确认文本。
     */
    function getDeleteConfirm(
      row: MessageManagementApi.MessageSubscriptionView,
    ) {
      return `确认删除消息订阅「${row.name}」吗？`;
    }

    /**
     * 切换统一消息订阅状态并刷新当前 KtTable。
     *
     * @param row - 待切换状态的消息订阅。
     * @param context - 行操作完成后使用的 KtTable 上下文。
     */
    async function handleToggle(
      row: MessageManagementApi.MessageSubscriptionView,
      context: KtTableContext<MessageManagementApi.MessageSubscriptionView>,
    ) {
      await setMessageSubscriptionEnabled(row.id, !row.enabled);
      await context.reload();
    }

    /**
     * 删除未被订阅者私有配置引用的消息订阅并刷新列表。
     *
     * @param row - 待删除的消息订阅。
     * @param context - 行操作完成后使用的 KtTable 上下文。
     */
    async function handleDelete(
      row: MessageManagementApi.MessageSubscriptionView,
      context: KtTableContext<MessageManagementApi.MessageSubscriptionView>,
    ) {
      await deleteMessageSubscription(row.id);
      await context.reload();
    }

    /**
     * 保存成功后丢弃页面旧快照并重新读取后端计算的来源、模板顺序和可用性。
     */
    async function handleModalSaved() {
      await tableApi.reload();
    }

    /**
     * 分页读取全部消息模板，供多选弹窗和列表筛选使用。
     *
     * @returns 在页数上限内合并得到的消息模板目录。
     */
    async function loadAllTemplates(): Promise<
      MessageManagementApi.MessageTemplateView[]
    > {
      const rows: MessageManagementApi.MessageTemplateView[] = [];
      for (let pageNo = 1; pageNo <= CATALOG_MAX_PAGES; pageNo += 1) {
        const page = await getMessageTemplateList({
          pageNo,
          pageSize: CATALOG_PAGE_SIZE,
        });
        rows.push(...page.items);
        if (
          rows.length >= page.total ||
          page.items.length < CATALOG_PAGE_SIZE
        ) {
          break;
        }
      }
      return rows;
    }

    /**
     * 并行加载模板、订阅者和来源目录，使弹窗只从协议元数据构造表单。
     */
    async function loadCatalogs() {
      const [sourceRows, subscriberRows, templateRows] = await Promise.all([
        getMessageSources(),
        getMessageSubscribers(),
        loadAllTemplates(),
      ]);
      sources.value = sourceRows;
      subscribers.value = subscriberRows;
      templates.value = templateRows;
    }

    /**
     * 首次进入页面时并行加载订阅列表和消息协议目录。
     */
    async function activatePage() {
      if (!canList) return;
      await Promise.all([tableApi.reload(), loadCatalogs()]);
    }

    /**
     * 将统一路由规则投影为模板集合、唯一订阅者、来源和协议可用状态。
     *
     * @param slot - KtTable 提供的列配置与订阅记录。
     * @returns 当前协议字段的自定义节点；其他列返回 undefined。
     */
    function renderBodyCell(slot: MessageSubscriptionBodyCellSlot) {
      const { column, record } = slot;
      if (column.key === 'templates') {
        return (
          <Space wrap>
            {record.templates.map((template) => (
              <Tag key={template.id}>{template.name}</Tag>
            ))}
          </Space>
        );
      }
      if (column.key === 'subscriber') {
        return `${record.subscriberName} · ${record.subscriberKey}`;
      }
      if (column.key === 'source') {
        return `${record.sourceName} · ${record.sourceKey}`;
      }
      if (column.key === 'enabled') {
        let color = 'warning';
        let label = record.invalidReasonCode || '不可用';
        if (record.valid) {
          if (record.enabled) {
            color = 'success';
            label = '启用';
          } else {
            color = 'default';
            label = '停用';
          }
        }
        return <Tag color={color}>{label}</Tag>;
      }
      if (column.key === 'remark') return record.remark || '-';
      return undefined;
    }

    onMounted(activatePage);

    return () => (
      <Page autoContentHeight>
        {(() => {
          if (!canList) return null;
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
                subscribers={subscribers.value}
                templates={templates.value}
              />
            </>
          );
        })()}
      </Page>
    );
  },
});
