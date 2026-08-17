import type { TableColumnType } from 'antdv-next';

import type { SystemNoticeApi } from '#/api/system/notice';
import type {
  KtTableApi,
  KtTableContext,
  KtTableRowAction,
} from '#/components/kt-table';

import { defineComponent } from 'vue';

import { Page } from '@vben/common-ui';

import { message, Tag } from 'antdv-next';

import {
  deleteNotice,
  getNoticeList,
  toggleNoticeStatus,
  toggleNoticeTop,
} from '#/api/system/notice';
import { KtTable, useKtTable } from '#/components/kt-table';
import { $t } from '#/locales';

import {
  getNoticeSeverityOptions,
  getNoticeSourceOptions,
  getNoticeStatusOptions,
  useSearchSchema,
} from './data';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'SystemNoticeList',
  setup() {
    const noticeSeverityOptions = getNoticeSeverityOptions();
    const noticeSourceOptions = getNoticeSourceOptions();
    const noticeStatusOptions = getNoticeStatusOptions();

    const columns: Array<TableColumnType<SystemNoticeApi.NoticeItem>> = [
      {
        dataIndex: 'isTop',
        fixed: 'left',
        key: 'isTop',
        title: $t('system.notice.top'),
        width: 82,
      },
      {
        dataIndex: 'severity',
        fixed: 'left',
        key: 'severity',
        title: $t('system.notice.severity'),
        width: 96,
      },
      {
        dataIndex: 'status',
        key: 'status',
        title: $t('system.notice.status'),
        width: 96,
      },
      {
        dataIndex: 'title',
        key: 'title',
        title: $t('system.notice.eventTitle'),
        width: 260,
      },
      {
        dataIndex: 'source',
        key: 'source',
        title: $t('system.notice.source'),
        width: 110,
      },
      {
        dataIndex: 'eventType',
        key: 'eventType',
        title: $t('system.notice.eventType'),
        width: 180,
      },
      {
        dataIndex: 'occurrenceCount',
        key: 'occurrenceCount',
        title: $t('system.notice.occurrenceCount'),
        width: 110,
      },
      {
        dataIndex: 'lastSeenAt',
        key: 'lastSeenAt',
        title: $t('system.notice.lastSeenAt'),
        width: 190,
      },
      {
        align: 'left',
        dataIndex: 'summary',
        key: 'summary',
        title: $t('system.notice.summary'),
        width: 320,
      },
    ];

    const api: KtTableApi<SystemNoticeApi.NoticeItem> = {
      list: async (params) => await getNoticeList(params),
    };

    const rowActions: Array<KtTableRowAction<SystemNoticeApi.NoticeItem>> = [
      {
        confirm: (row) => $t('system.notice.handleConfirm', [row.title]),
        key: 'handle',
        label: $t('system.notice.markHandled'),
        onClick: onToggleStatus,
        permissionCodes: ['System:Notice:Edit'],
        rowVisible: (row) => row.status === 1,
      },
      {
        confirm: (row) => $t('system.notice.reopenConfirm', [row.title]),
        key: 'reopen',
        label: $t('system.notice.reopen'),
        onClick: onToggleStatus,
        permissionCodes: ['System:Notice:Edit'],
        rowVisible: (row) => row.status !== 1,
      },
      {
        confirm: (row) => $t('system.notice.toggleTopConfirm', [row.title]),
        key: 'markTop',
        label: $t('system.notice.markTop'),
        onClick: onToggleTop,
        permissionCodes: ['System:Notice:Edit'],
        rowVisible: (row) => !row.isTop,
      },
      {
        confirm: (row) => $t('system.notice.toggleTopConfirm', [row.title]),
        key: 'cancelTop',
        label: $t('system.notice.cancelTop'),
        onClick: onToggleTop,
        permissionCodes: ['System:Notice:Edit'],
        rowVisible: (row) => row.isTop,
      },
      {
        confirm: (row) => $t('system.notice.deleteConfirm', [row.title]),
        danger: true,
        key: 'delete',
        label: $t('common.delete'),
        onClick: onDelete,
        permissionCodes: ['System:Notice:Delete'],
      },
    ];

    /**
     * 从严重程度选项中查找匹配标签颜色；未知值返回 undefined。
     *
     * @param severity - 系统通知的严重程度。
     * @returns 与严重程度匹配的选项；未知值回退为默认选项。
     */
    function getNoticeSeverityOption(
      severity: SystemNoticeApi.NoticeItem['severity'],
    ) {
      return noticeSeverityOptions.find((item) => item.value === severity);
    }

    /**
     * 从通知来源选项中查找匹配标签颜色；未知值返回 undefined。
     *
     * @param source - 通知来源代码；未知来源会原样生成展示选项。
     * @returns 与通知来源匹配的选项；未知值回退为默认选项。
     */
    function getNoticeSourceOption(source?: string) {
      return noticeSourceOptions.find((item) => item.value === source);
    }

    /**
     * 从通知状态选项中查找匹配标签颜色；未知值返回 undefined。
     *
     * @param status - 通知的 0 或 1 状态，用于匹配禁用或启用选项。
     * @returns 与通知状态匹配的选项；未知值回退为默认选项。
     */
    function getNoticeStatusOption(
      status: SystemNoticeApi.NoticeItem['status'],
    ) {
      return noticeStatusOptions.find((item) => item.value === status);
    }

    const [registerTable, tableApi] = useKtTable<SystemNoticeApi.NoticeItem>({
      api,
      columns,
      formOptions: {
        schema: useSearchSchema(),
      },
      rowActions,
      rowKey: 'id',
      showSelection: false,
      tableTitle: $t('system.notice.title'),
    });

    /**
     * 切换系统通知启停状态，显示对应成功提示并刷新列表。
     *
     * @param row - 需要切换处理状态的系统通知。
     * @param context - 状态更新成功后用来重新加载通知列表的 KtTable 上下文。
     */
    async function onToggleStatus(
      row: SystemNoticeApi.NoticeItem,
      context: KtTableContext<SystemNoticeApi.NoticeItem>,
    ) {
      const nextStatus = (() => {
        if (row.status === 1) {
          return 0;
        }
        return 1;
      })();
      await toggleNoticeStatus(row.id, nextStatus);
      message.success(
        (() => {
          if (nextStatus === 0) {
            return $t('system.notice.handleSuccess');
          }
          return $t('system.notice.reopenSuccess');
        })(),
      );
      await context.reload();
    }

    /**
     * 切换系统通知置顶状态，显示对应成功提示并刷新列表。
     *
     * @param row - 需要置顶或取消置顶的系统通知。
     * @param context - 置顶状态更新成功后用来重新加载通知列表的 KtTable 上下文。
     */
    async function onToggleTop(
      row: SystemNoticeApi.NoticeItem,
      context: KtTableContext<SystemNoticeApi.NoticeItem>,
    ) {
      await toggleNoticeTop(row.id, !row.isTop);
      message.success(
        (() => {
          if (row.isTop) {
            return $t('system.notice.cancelTopSuccess');
          }
          return $t('system.notice.topSuccess');
        })(),
      );
      await context.reload();
    }

    /**
     * 删除选中通知，成功后提示并刷新调用方或默认表格。
     *
     * @param row - 要删除的系统通知记录。
     * @param context - 删除后优先用于重新加载列表的 KtTable 上下文；缺省时使用当前表格 API。
     */
    async function onDelete(
      row: SystemNoticeApi.NoticeItem,
      context?: KtTableContext<SystemNoticeApi.NoticeItem>,
    ) {
      const hideLoading = message.loading({
        content: $t('ui.actionMessage.deleting', [row.title]),
        duration: 0,
        key: 'action_process_msg',
      });

      try {
        await deleteNotice(row.id);
        message.success({
          content: $t('ui.actionMessage.deleteSuccess', [row.title]),
          key: 'action_process_msg',
        });
        await (context || tableApi).reload();
      } catch {
        hideLoading();
      }
    }

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as SystemNoticeApi.NoticeItem;
              if (column.key === 'isTop') {
                return (
                  <Tag
                    color={(() => {
                      if (row.isTop) {
                        return 'warning';
                      }
                      return 'default';
                    })()}
                  >
                    {(() => {
                      if (row.isTop) {
                        return $t('system.notice.topYes');
                      }
                      return $t('system.notice.topNo');
                    })()}
                  </Tag>
                );
              }
              if (column.key === 'severity') {
                return (
                  <Tag
                    color={
                      getNoticeSeverityOption(row.severity)?.color || 'default'
                    }
                  >
                    {getNoticeSeverityOption(row.severity)?.label ||
                      row.severity ||
                      '-'}
                  </Tag>
                );
              }
              if (column.key === 'source') {
                return (
                  <Tag
                    color={getNoticeSourceOption(row.source)?.color || 'blue'}
                  >
                    {getNoticeSourceOption(row.source)?.label ||
                      row.source ||
                      '-'}
                  </Tag>
                );
              }
              if (column.key === 'status') {
                return (
                  <Tag
                    color={
                      getNoticeStatusOption(row.status)?.color || 'default'
                    }
                  >
                    {getNoticeStatusOption(row.status)?.label || row.status}
                  </Tag>
                );
              }
              if (column.key === 'occurrenceCount') {
                return row.occurrenceCount || 1;
              }
              if (column.key === 'summary') {
                return row.summary || row.content || '-';
              }
              return undefined;
            },
          }}
        />
      </Page>
    );
  },
});
