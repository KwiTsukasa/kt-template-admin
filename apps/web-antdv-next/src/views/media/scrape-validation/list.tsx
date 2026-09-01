import type { TableColumnType } from 'antdv-next';

import type { MediaScrapeValidationApi } from '#/api/media-scrape-validation';
import type { KtTableApi, KtTableRowAction } from '#/components/kt-table';

import { defineComponent } from 'vue';

import { Page } from '@vben/common-ui';

import { message, Tag } from 'antdv-next';

import {
  getMediaScrapeValidationPage,
  recheckMediaScrapeValidation,
} from '#/api/media-scrape-validation';
import { KtTable, useKtTable } from '#/components/kt-table';

const AKtTable = KtTable as any;
const ATag = Tag as any;

const STATUS_COLORS: Record<MediaScrapeValidationApi.Status, string> = {
  healthy: 'success',
  issues: 'error',
  pending: 'warning',
  running: 'processing',
};

export default defineComponent({
  name: 'MediaScrapeValidationList',
  setup() {
    const columns: Array<TableColumnType<MediaScrapeValidationApi.RecordItem>> =
      [
        {
          dataIndex: 'title',
          key: 'title',
          minWidth: 280,
          title: '作品 / 治理任务',
        },
        {
          dataIndex: 'mediaType',
          key: 'mediaType',
          title: '类型',
          width: 110,
        },
        {
          dataIndex: 'status',
          key: 'status',
          title: '刮削校验',
          width: 160,
        },
        {
          dataIndex: 'issues',
          key: 'issues',
          title: '缺项',
          width: 100,
        },
        {
          dataIndex: 'reason',
          ellipsis: false,
          key: 'reason',
          minWidth: 320,
          title: '校验结论',
        },
        {
          dataIndex: 'requestedAt',
          key: 'requestedAt',
          title: '最近请求',
          width: 190,
        },
      ];
    const api: KtTableApi<
      MediaScrapeValidationApi.RecordItem,
      MediaScrapeValidationApi.PageQuery
    > = {
      list: async (params) => await getMediaScrapeValidationPage(params),
    };
    const rowActions: Array<
      KtTableRowAction<
        MediaScrapeValidationApi.RecordItem,
        MediaScrapeValidationApi.PageQuery
      >
    > = [
      {
        key: 'recheck',
        label: '重新校验',
        onClick: recheck,
        permissionCodes: ['Media:Governance:Run'],
        rowVisible: (row) => row.status !== 'running',
      },
    ];
    const [registerTable, tableApi] = useKtTable<
      MediaScrapeValidationApi.RecordItem,
      MediaScrapeValidationApi.PageQuery
    >({
      api,
      columns,
      formOptions: {
        schema: [
          {
            component: 'Input',
            componentProps: {
              allowClear: true,
              placeholder: '搜索作品名或治理任务编号',
            },
            fieldName: 'keyword',
            label: '关键词',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: [
                { label: '等待校验', value: 'pending' },
                { label: '校验中', value: 'running' },
                { label: '正常', value: 'healthy' },
                { label: '有缺项', value: 'issues' },
              ],
            },
            fieldName: 'status',
            label: '校验状态',
          },
        ],
      },
      pageSize: 20,
      rowActions,
      rowKey: 'id',
      tableTitle: 'NAS 刮削校验',
    });

    /**
     * 把指定记录重新排入独立校验队列并刷新列表。
     * @param row - 当前刮削校验记录。
     */
    async function recheck(row: MediaScrapeValidationApi.RecordItem) {
      await recheckMediaScrapeValidation(row.id, row.revision);
      message.success('已重新排入 NAS 刮削校验队列');
      await tableApi.reload();
    }

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) =>
              renderBodyCell(
                column.key,
                record as MediaScrapeValidationApi.RecordItem,
              ),
          }}
        />
      </Page>
    );
  },
});

/**
 * 渲染刮削校验列表中的状态、缺项和任务身份单元格。
 * @param key - 当前列键。
 * @param record - 当前刮削校验记录。
 * @returns 当前列的业务节点；普通列返回 `undefined`。
 */
function renderBodyCell(
  key: string,
  record: MediaScrapeValidationApi.RecordItem,
) {
  if (key === 'title') {
    return (
      <div class="grid gap-1">
        <span class="font-medium">{record.title}</span>
        <span class="break-all text-xs text-muted-foreground">
          {record.taskId}
        </span>
      </div>
    );
  }
  if (key === 'status') {
    return (
      <ATag color={STATUS_COLORS[record.status]}>{record.statusLabel}</ATag>
    );
  }
  if (key === 'issues') {
    let color = 'default';
    if (record.issues.length > 0) color = 'error';
    return <ATag color={color}>{record.issues.length}</ATag>;
  }
  if (key === 'reason') {
    return record.reason || '等待 NAS 执行器校验 NFO、海报与资料库关联';
  }
  if (key === 'requestedAt') {
    return new Date(record.requestedAt).toLocaleString();
  }
  return undefined;
}
