import type { TableColumnType } from 'antdv-next';

import type { SystemLogApi } from '#/api/system/log';
import type {
  KtTableApi,
  KtTableContext,
  KtTablePageResult,
  KtTableRowAction,
} from '#/components/ktTable';

import { computed, defineComponent, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Drawer, Tag } from 'antdv-next';

import {
  getSystemLogLevels,
  getSystemLogList,
  getSystemLogStatus,
  getSystemLogSummary,
} from '#/api/system/log';
import { KtTable, useKtTable } from '#/components/ktTable';
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

    function getLevelColor(level: string) {
      return levelColorMap[level] || 'default';
    }

    function getStatusColor(statusCode?: number) {
      if (!statusCode) return 'default';
      if (statusCode >= 500) return 'error';
      if (statusCode >= 400) return 'warning';
      if (statusCode >= 300) return 'processing';
      return 'success';
    }

    function getSummaryCount(level: string) {
      return summary.value.find((item) => item.level === level)?.count || 0;
    }

    async function loadStatus() {
      status.value = await getSystemLogStatus();
    }

    async function loadLevels() {
      const options = await getSystemLogLevels();
      levelOptions.value = options.length > 0 ? options : fallbackLevelOptions;
    }

    async function refreshSummary(params: Record<string, any> = {}) {
      summary.value = await getSystemLogSummary(params);
    }

    async function onAfterFetch(
      result: KtTablePageResult<SystemLogApi.LogItem> | SystemLogApi.LogItem[],
      context: KtTableContext<SystemLogApi.LogItem>,
    ) {
      await refreshSummary(await context.getSearchValues());
      return result;
    }

    function onDetail(row: SystemLogApi.LogItem) {
      detailRecord.value = row;
      detailOpen.value = true;
    }

    return () => (
      <Page autoContentHeight>
        <div class="system-log-page">
          <section class="system-log-page__status">
            <div class="system-log-page__status-main">
              <Tag color={status.value?.configured ? 'success' : 'warning'}>
                {status.value?.configured
                  ? $t('system.log.configured')
                  : $t('system.log.unconfigured')}
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
                  return row.durationMs === undefined
                    ? '-'
                    : `${row.durationMs} ms`;
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
          {detailRecord.value ? (
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
          ) : null}
          <pre class="system-log-page__raw">
            {detailRecord.value?.raw || ''}
          </pre>
        </ADrawer>
      </Page>
    );
  },
});
