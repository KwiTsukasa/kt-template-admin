import type { TableColumnType } from 'antdv-next';

import type { SystemLogApi } from '#/api/system/log';
import type {
  KtTableApi,
  KtTableContext,
  KtTablePageResult,
  KtTableRowAction,
} from '#/components/kt-table';

import { computed, defineComponent, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Drawer, Tag } from 'antdv-next';

import {
  getSystemLogLevels,
  getSystemLogList,
  getSystemLogStatus,
  getSystemLogSummary,
} from '#/api/system/log';
import { KtTable, useKtTable } from '#/components/kt-table';
import { $t } from '#/locales';

import './list.scss';

const ADrawer = Drawer as any;
const AKtTable = KtTable as any;

const levelColorMap: Record<string, string> = {
  critical: 'magenta',
  debug: 'default',
  error: 'error',
  info: 'processing',
  warning: 'warning',
};

const fallbackLevelOptions: Array<{
  label: string;
  value: SystemLogApi.LogLevel;
}> = [
  { label: 'debug', value: 'debug' },
  { label: 'info', value: 'info' },
  { label: 'warning', value: 'warning' },
  { label: 'error', value: 'error' },
  { label: 'critical', value: 'critical' },
];

export default defineComponent({
  name: 'SystemLogList',
  setup() {
    const levelOptions = ref(fallbackLevelOptions);
    const summary = ref<SystemLogApi.LogSummary[]>([]);
    const status = ref<SystemLogApi.LogStatus>();
    const detailOpen = ref(false);
    const detailRecord = ref<SystemLogApi.LogItem>();

    const summaryTotal = computed(() =>
      summary.value.reduce((total, item) => total + Number(item.count || 0), 0),
    );

    const columns: Array<TableColumnType<SystemLogApi.LogItem>> = [
      {
        dataIndex: 'timestamp',
        fixed: 'left',
        key: 'timestamp',
        title: $t('system.log.time'),
        width: 190,
      },
      {
        align: 'center',
        dataIndex: 'level',
        key: 'level',
        title: $t('system.log.level'),
        width: 110,
      },
      {
        dataIndex: 'message',
        key: 'message',
        title: $t('system.log.message'),
        width: 420,
      },
      {
        dataIndex: 'context',
        key: 'context',
        title: $t('system.log.context'),
        width: 180,
      },
      {
        align: 'center',
        dataIndex: 'method',
        key: 'method',
        title: $t('system.log.method'),
        width: 100,
      },
      {
        dataIndex: 'path',
        key: 'path',
        title: $t('system.log.path'),
        width: 260,
      },
      {
        align: 'center',
        dataIndex: 'statusCode',
        key: 'statusCode',
        title: $t('system.log.statusCode'),
        width: 110,
      },
      {
        align: 'right',
        dataIndex: 'durationMs',
        key: 'durationMs',
        title: $t('system.log.durationMs'),
        width: 110,
      },
      {
        dataIndex: 'requestId',
        key: 'requestId',
        title: $t('system.log.requestId'),
        width: 220,
      },
    ];

    const api: KtTableApi<SystemLogApi.LogItem> = {
      list: async (params) => await getSystemLogList(params),
    };

    const rowActions: Array<KtTableRowAction<SystemLogApi.LogItem>> = [
      {
        key: 'detail',
        label: $t('system.log.detail'),
        onClick: onDetail,
        permissionCodes: ['System:Log:List'],
      },
    ];

    const [registerTable] = useKtTable<SystemLogApi.LogItem>({
      afterFetch: onAfterFetch,
      api,
      columns,
      formOptions: {
        fieldMappingTime: [
          ['logTime', ['startTime', 'endTime'], 'YYYY-MM-DD HH:mm:ss'],
        ],
        schema: [
          {
            component: 'Select',
            componentProps: () => ({
              allowClear: true,
              options: levelOptions.value,
            }),
            fieldName: 'level',
            label: $t('system.log.level'),
          },
          {
            component: 'Input',
            componentProps: {
              allowClear: true,
            },
            fieldName: 'keyword',
            label: $t('system.log.keyword'),
          },
          {
            component: 'Input',
            componentProps: {
              allowClear: true,
            },
            fieldName: 'context',
            label: $t('system.log.context'),
          },
          {
            component: 'Input',
            componentProps: {
              allowClear: true,
            },
            fieldName: 'path',
            label: $t('system.log.path'),
          },
          {
            component: 'Input',
            componentProps: {
              allowClear: true,
            },
            fieldName: 'requestId',
            label: $t('system.log.requestId'),
          },
          {
            component: 'RangePicker',
            fieldName: 'logTime',
            label: $t('system.log.timeRange'),
          },
          {
            component: 'InputNumber',
            componentProps: {
              class: 'w-full',
              min: 1,
              precision: 0,
            },
            defaultValue: 60,
            fieldName: 'rangeMinutes',
            label: $t('system.log.rangeMinutes'),
          },
        ],
      },
      pageSize: 20,
      rowActions,
      rowKey: 'id',
      showSelection: false,
      tableTitle: $t('system.log.title'),
    });

    onMounted(async () => {
      await Promise.all([loadStatus(), loadLevels(), refreshSummary()]);
    });

    /**
     * 将日志级别映射为标签颜色，未收录级别使用默认色。
     *
     * @param level - 后端返回的日志级别名称。
     * @returns 日志级别对应的标签颜色；未收录级别返回 default。
     */
    function getLevelColor(level: string) {
      return levelColorMap[level] || 'default';
    }

    /**
     * 根据 HTTP 状态码区间选择成功、重定向、客户端错误或服务端错误颜色。
     *
     * @param statusCode - HTTP 或业务响应状态码。
     * @returns 状态码区间对应的标签颜色；状态码缺失时返回 default。
     */
    function getStatusColor(statusCode?: number) {
      if (!statusCode) return 'default';
      if (statusCode >= 500) return 'error';
      if (statusCode >= 400) return 'warning';
      if (statusCode >= 300) return 'processing';
      return 'success';
    }

    /**
     * 按日志级别从汇总数据中读取数量，缺少该级别时返回零。
     *
     * @param level - 要从汇总列表中匹配的日志级别名称。
     * @returns 指定日志级别或状态的汇总数量；汇总中没有该键时返回零。
     */
    function getSummaryCount(level: string) {
      return summary.value.find((item) => item.level === level)?.count || 0;
    }

    /**
     * 从后端加载系统日志采集状态，并更新页面状态卡片。
     */
    async function loadStatus() {
      status.value = await getSystemLogStatus();
    }

    /**
     * 从后端加载日志级别选项；接口返回空数组时保留内置级别。
     */
    async function loadLevels() {
      const options = await getSystemLogLevels();
      if (options.length > 0) {
        levelOptions.value = options;
      } else {
        levelOptions.value = fallbackLevelOptions;
      }
    }

    /**
     * 按当前日志筛选条件重新加载统计摘要。
     *
     * @param params - 与日志表格相同的级别、关键词、状态和时间筛选；省略时聚合全部日志。
     */
    async function refreshSummary(params: Record<string, any> = {}) {
      summary.value = await getSystemLogSummary(params);
    }

    /**
     * 日志列表加载后用相同筛选条件刷新统计摘要，并把列表结果原样交还表格。
     *
     * @param result - KtTable 本次加载得到、需要原样返回的列表结果。
     * @param context - 提供本次列表筛选值的 KtTable 请求上下文。
     * @returns 表格原始加载结果，供 KtTable 继续完成列表写入。
     */
    async function onAfterFetch(
      result: KtTablePageResult<SystemLogApi.LogItem> | SystemLogApi.LogItem[],
      context: KtTableContext<SystemLogApi.LogItem>,
    ) {
      await refreshSummary(await context.getSearchValues());
      return result;
    }

    /**
     * 把选中日志记录写入详情状态并打开详情面板。
     *
     * @param row - 要在详情抽屉中展示的系统日志记录。
     */
    function onDetail(row: SystemLogApi.LogItem) {
      detailRecord.value = row;
      detailOpen.value = true;
    }

    return () => (
      <Page autoContentHeight>
        <div class="system-log-page">
          <section class="system-log-page__status">
            <div class="system-log-page__status-main">
              <Tag
                color={(() => {
                  if (status.value?.configured) {
                    return 'success';
                  }
                  return 'warning';
                })()}
              >
                {(() => {
                  if (status.value?.configured) {
                    return $t('system.log.configured');
                  }
                  return $t('system.log.unconfigured');
                })()}
              </Tag>
              <span>{status.value?.app || '-'}</span>
              <span>{status.value?.env || '-'}</span>
              <span class="system-log-page__muted">
                {status.value?.selector || $t('system.log.emptyStatus')}
              </span>
            </div>
            <div class="system-log-page__host">{status.value?.host || '-'}</div>
          </section>

          <section class="system-log-page__summary">
            <div class="system-log-page__summary-item">
              <span>{$t('system.log.total')}</span>
              <strong>{summaryTotal.value}</strong>
            </div>
            {levelOptions.value.map((item) => (
              <div class="system-log-page__summary-item" key={item.value}>
                <Tag color={getLevelColor(item.value)}>{item.label}</Tag>
                <strong>{getSummaryCount(item.value)}</strong>
              </div>
            ))}
          </section>

          <AKtTable
            onRegister={registerTable}
            v-slots={{
              bodyCell: ({ column, record }: any) => {
                const row = record as SystemLogApi.LogItem;
                if (column.key === 'level') {
                  return (
                    <Tag color={getLevelColor(row.level)}>{row.level}</Tag>
                  );
                }
                if (column.key === 'statusCode') {
                  return (
                    <Tag color={getStatusColor(row.statusCode)}>
                      {row.statusCode || '-'}
                    </Tag>
                  );
                }
                if (column.key === 'durationMs') {
                  if (row.durationMs === undefined) {
                    return '-';
                  }
                  return `${row.durationMs} ms`;
                }
                if (column.key === 'message') {
                  return (
                    <span class="system-log-page__message" title={row.message}>
                      {row.message}
                    </span>
                  );
                }
                return undefined;
              },
            }}
          />
        </div>

        <ADrawer
          onUpdate:open={(open: boolean) => {
            detailOpen.value = open;
          }}
          open={detailOpen.value}
          size={720}
          title={$t('system.log.raw')}
        >
          {(() => {
            if (detailRecord.value) {
              return (
                <dl class="system-log-page__detail">
                  <dt>{$t('system.log.time')}</dt>
                  <dd>{detailRecord.value.timestamp}</dd>
                  <dt>{$t('system.log.level')}</dt>
                  <dd>
                    <Tag color={getLevelColor(detailRecord.value.level)}>
                      {detailRecord.value.level}
                    </Tag>
                  </dd>
                  <dt>{$t('system.log.context')}</dt>
                  <dd>{detailRecord.value.context || '-'}</dd>
                  <dt>{$t('system.log.requestId')}</dt>
                  <dd>{detailRecord.value.requestId || '-'}</dd>
                  <dt>{$t('system.log.path')}</dt>
                  <dd>{detailRecord.value.path || '-'}</dd>
                </dl>
              );
            }
            return null;
          })()}
          <pre class="system-log-page__raw">
            {detailRecord.value?.raw || ''}
          </pre>
        </ADrawer>
      </Page>
    );
  },
});
