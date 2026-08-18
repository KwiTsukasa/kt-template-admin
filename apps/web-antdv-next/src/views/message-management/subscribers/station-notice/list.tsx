import type { TableColumnType } from 'antdv-next';

import type { StationNoticeBindingModalExposed } from './components/StationNoticeBindingModal';

import type { MessageManagementApi } from '#/api/message-management';
import type { StationNoticeMessageSubscriberApi } from '#/api/message-management/subscribers/station-notice';
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

import { getMessageSubscriptionList } from '#/api/message-management';
import {
  deleteStationNoticeMessageBinding,
  getStationNoticeMessageBindings,
  setStationNoticeMessageBindingEnabled,
} from '#/api/message-management/subscribers/station-notice';
import { KtTable, useKtTable } from '#/components/kt-table';

import StationNoticeBindingModal from './components/StationNoticeBindingModal';

const AKtTable = KtTable as any;
const CATALOG_MAX_PAGES = 100;
const CATALOG_PAGE_SIZE = 100;

type StationNoticeBodyCellSlot = {
  column: TableColumnType<StationNoticeMessageSubscriberApi.BindingView>;
  record: StationNoticeMessageSubscriberApi.BindingView;
};

export default defineComponent({
  name: 'StationNoticeMessageSubscriberList',
  setup() {
    const { hasAccessByCodes } = useAccess();
    const canList = hasAccessByCodes(['MessageManagement:Push:List']);
    const modalRef = ref<StationNoticeBindingModalExposed>();
    const subscriptions = ref<MessageManagementApi.MessageSubscriptionView[]>(
      [],
    );
    const columns: Array<
      TableColumnType<StationNoticeMessageSubscriberApi.BindingView>
    > = [
      {
        dataIndex: 'subscriptionName',
        key: 'subscription',
        title: '消息订阅',
        width: 200,
      },
      { key: 'templates', title: '消息模板（全部）', width: 300 },
      { key: 'source', title: '消息源', width: 240 },
      { dataIndex: 'title', key: 'title', title: '站内信标题', width: 220 },
      {
        dataIndex: 'notifyRoleCode',
        key: 'notifyRoleCode',
        title: '接收角色编码',
        width: 150,
      },
      { dataIndex: 'enabled', key: 'enabled', title: '状态', width: 90 },
      {
        dataIndex: 'updateTime',
        key: 'updateTime',
        title: '更新时间',
        width: 180,
      },
    ];
    const api: KtTableApi<StationNoticeMessageSubscriberApi.BindingView> = {
      list: async () => {
        const items = await getStationNoticeMessageBindings();
        return { items, total: items.length };
      },
    };
    const buttons: Array<
      KtTableButton<StationNoticeMessageSubscriberApi.BindingView>
    > = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: '新增站内信投递',
        onClick: openCreate,
        permissionCodes: ['MessageManagement:Push:Create'],
        type: 'primary',
      },
    ];
    const rowActions: Array<
      KtTableRowAction<StationNoticeMessageSubscriberApi.BindingView>
    > = [
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        permissionCodes: ['MessageManagement:Push:Update'],
      },
      {
        key: 'toggle',
        label: '启停',
        onClick: handleToggle,
        permissionCodes: ['MessageManagement:Push:Toggle'],
      },
      {
        confirm: getDeleteConfirm,
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: handleDelete,
        permissionCodes: ['MessageManagement:Push:Delete'],
      },
    ];
    const [registerTable, tableApi] =
      useKtTable<StationNoticeMessageSubscriberApi.BindingView>({
        api,
        buttons,
        columns,
        immediate: false,
        rowActions,
        rowKey: 'id',
        showIndex: false,
        showPagination: false,
        tableTitle: '站内信订阅者',
      });

    /**
     * 新建入口只配置统一订阅、标题和角色，模板集合保持只读展示。
     */
    function openCreate() {
      modalRef.value?.openCreate();
    }

    /**
     * 将当前站内信订阅者配置交给弹窗进入编辑模式。
     *
     * @param row - 待编辑的站内信订阅者配置。
     */
    function openEdit(row: StationNoticeMessageSubscriberApi.BindingView) {
      modalRef.value?.openEdit(row);
    }

    /**
     * 把订阅名称写入二次确认文案，降低误删相邻站内信绑定的风险。
     *
     * @param row - 待删除的站内信订阅者配置。
     * @returns 站内信订阅者配置删除确认文本。
     */
    function getDeleteConfirm(
      row: StationNoticeMessageSubscriberApi.BindingView,
    ): string {
      return `确认删除消息订阅「${row.subscriptionName}」的站内信投递吗？`;
    }

    /**
     * 切换站内信订阅者配置状态并刷新列表。
     *
     * @param row - 待切换状态的站内信订阅者配置。
     * @param context - 行操作完成后使用的 KtTable 上下文。
     */
    async function handleToggle(
      row: StationNoticeMessageSubscriberApi.BindingView,
      context: KtTableContext<StationNoticeMessageSubscriberApi.BindingView>,
    ) {
      await setStationNoticeMessageBindingEnabled(row.id, !row.enabled);
      await context.reload();
    }

    /**
     * 等待后端移除私有绑定后刷新权威列表，已物化站内信由后端保留。
     *
     * @param row - 待删除的站内信订阅者配置。
     * @param context - 行操作完成后使用的 KtTable 上下文。
     */
    async function handleDelete(
      row: StationNoticeMessageSubscriberApi.BindingView,
      context: KtTableContext<StationNoticeMessageSubscriberApi.BindingView>,
    ) {
      await deleteStationNoticeMessageBinding(row.id);
      await context.reload();
    }

    /**
     * 保存成功后丢弃页面旧快照并重新读取后端计算的模板和可用状态。
     */
    async function handleModalSaved() {
      await tableApi.reload();
    }

    /**
     * 分页读取归属站内信订阅者的全部统一订阅。
     *
     * @returns 在页数上限内合并的站内信统一订阅目录。
     */
    async function loadStationNoticeSubscriptions(): Promise<
      MessageManagementApi.MessageSubscriptionView[]
    > {
      const rows: MessageManagementApi.MessageSubscriptionView[] = [];
      for (let pageNo = 1; pageNo <= CATALOG_MAX_PAGES; pageNo += 1) {
        const page = await getMessageSubscriptionList({
          pageNo,
          pageSize: CATALOG_PAGE_SIZE,
          subscriberKey: 'station-notice',
        });
        rows.push(
          ...page.items.filter(
            (subscription) => subscription.subscriberKey === 'station-notice',
          ),
        );
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
     * 首次进入页面时并行加载站内信私有配置和可选统一订阅。
     */
    async function activatePage() {
      if (!canList) return;
      const [, subscriptionRows] = await Promise.all([
        tableApi.reload(),
        loadStationNoticeSubscriptions(),
      ]);
      subscriptions.value = subscriptionRows;
    }

    /**
     * 用统一订阅快照展示全部模板与来源，并把协议失效原因投影为状态标签。
     *
     * @param slot - KtTable 提供的列配置与站内信订阅者记录。
     * @returns 当前协议字段的自定义节点；其他列返回 undefined。
     */
    function renderBodyCell(slot: StationNoticeBodyCellSlot) {
      const { column, record } = slot;
      if (column.key === 'templates') {
        return (
          <Space wrap>
            {record.templates.map((template) => (
              <Tag key={template.id}>
                {template.sortOrder + 1}. {template.name}
              </Tag>
            ))}
          </Space>
        );
      }
      if (column.key === 'source') {
        return `${record.sourceName} · ${record.sourceKey}`;
      }
      if (column.key === 'enabled') {
        let color = 'warning';
        let label = record.invalidReasonCode || '不可用';
        if (record.available) {
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
              <StationNoticeBindingModal
                onSaved={handleModalSaved}
                ref={modalRef}
                subscriptions={subscriptions.value}
              />
            </>
          );
        })()}
      </Page>
    );
  },
});
