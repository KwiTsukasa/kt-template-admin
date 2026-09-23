import type { TableColumnType } from 'antdv-next';

import type { SystemLogApi } from '#/api/system/log';
import type {
  KtTableApi,
  KtTablePageResult,
  KtTableRowAction,
} from '#/components/kt-table';

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Drawer, Popover, Tag } from 'antdv-next';

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
const AButton = Button as any;
const APopover = Popover as any;
const AKtTable = KtTable as any;

interface LogPageSnapshot extends SystemLogApi.PageResult<SystemLogApi.LogItem> {
  summary: null | SystemLogApi.LogSummary[];
  summaryFailed: boolean;
}

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
    const summary = ref<null | SystemLogApi.LogSummary[]>(null);
    const summaryError = ref('');
    const status = ref<SystemLogApi.LogStatus>();
    const statusLoading = ref(true);
    const statusError = ref('');
    let statusGeneration = 0;
    let disposed = false;
    const detailOpen = ref(false);
    const detailRecord = ref<SystemLogApi.LogItem>();

    const summarySnapshot = computed(() => {
      if (!summary.value) return null;
      const counts = new Map<string, number>();
      let total = 0;
      for (const item of summary.value) {
        const count = Number(item.count || 0);
        total += count;
        if (!counts.has(item.level)) counts.set(item.level, count);
      }
      return { counts, total };
    });

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
      list: async (params) => {
        const summaryParams = { ...params };
        delete summaryParams.pageNo;
        delete summaryParams.pageSize;
        delete summaryParams.sortField;
        delete summaryParams.sortOrder;
        const summaryRequest = getSystemLogSummary(summaryParams)
          .then((value) => ({ summary: value, summaryFailed: false }))
          .catch(() => ({ summary: null, summaryFailed: true }));
        const [page, summaryResult] = await Promise.all([
          getSystemLogList(params),
          summaryRequest,
        ]);
        const snapshot: LogPageSnapshot = {
          ...page,
          ...summaryResult,
        };
        return snapshot;
      },
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
      hooks: [{ name: 'log-summary', onAfterFetch: applySummarySnapshot }],
      pageSize: 20,
      rowActions,
      rowKey: 'id',
      showSelection: false,
      tableTitle: $t('system.log.title'),
    });

    onMounted(() => {
      void loadStatus();
      void loadLevels();
    });
    onBeforeUnmount(() => {
      disposed = true;
      statusGeneration += 1;
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
     * 按日志级别读取汇总数量；汇总未知时保留未知状态，已知汇总缺项才按零处理。
     *
     * @param level - 要从汇总列表中匹配的日志级别名称。
     * @returns 汇总未知时返回 null；已知汇总中的匹配数量，缺项时返回零。
     */
    function getSummaryCount(level: string) {
      if (!summarySnapshot.value) return null;
      return summarySnapshot.value.counts.get(level) ?? 0;
    }

    /**
     * 读取日志源配置事实，失败或卸载后不推断为“未配置”。
     */
    async function loadStatus() {
      const request = ++statusGeneration;
      statusLoading.value = true;
      statusError.value = '';
      try {
        const next = await getSystemLogStatus();
        if (disposed || request !== statusGeneration) return;
        status.value = next;
      } catch {
        if (disposed || request !== statusGeneration) return;
        status.value = undefined;
        statusError.value = '日志源状态读取失败，请重试。';
      } finally {
        if (!disposed && request === statusGeneration)
          statusLoading.value = false;
      }
    }

    /**
     * 读取日志级别目录，空结果或失败时沿用内置级别，卸载后不写状态。
     */
    async function loadLevels() {
      try {
        const options = await getSystemLogLevels();
        if (disposed) return;
        if (options.length > 0) {
          levelOptions.value = options;
        } else {
          levelOptions.value = fallbackLevelOptions;
        }
      } catch {
        if (disposed) return;
        levelOptions.value = fallbackLevelOptions;
      }
    }

    /**
     * 只在 KtTable 接纳本轮行数据后提交同源摘要，失败时保留未知状态。
     * @param result - 已通过 KtTable 请求身份检查的列表与摘要快照。
     */
    function applySummarySnapshot(
      result: KtTablePageResult<SystemLogApi.LogItem> | SystemLogApi.LogItem[],
    ) {
      if (Array.isArray(result)) return;
      const snapshot = result as LogPageSnapshot;
      summary.value = snapshot.summary;
      summaryError.value = '';
      if (snapshot.summaryFailed) {
        summaryError.value = '统计暂不可用，刷新表格重试。';
      }
    }

    /**
     * 把未读取或读取失败的统计数量显示为未知，成功空集合才显示零。
     * @param count - 从同一轮日志摘要得到的数量或未知值。
     * @returns 数量文本；未知时使用占位符。
     */
    function displayCount(count: null | number) {
      if (count === null) return '—';
      return String(count);
    }

    /**
     * 区分日志源读取中、读取失败与已配置或未配置的真实事实。
     * @returns 当前日志源状态标签或可重试错误。
     */
    function renderSourceStatus() {
      if (statusLoading.value) return <Tag>状态读取中</Tag>;
      if (statusError.value)
        return (
          <span
            class="system-log-page__status-error"
            role="status"
            title={statusError.value}
          >
            状态读取失败
            <AButton onClick={() => void loadStatus()} size="small" type="link">
              重试
            </AButton>
          </span>
        );
      if (!status.value) return <Tag>状态待确认</Tag>;
      if (status.value.configured)
        return <Tag color="success">{$t('system.log.configured')}</Tag>;
      return <Tag color="warning">{$t('system.log.unconfigured')}</Tag>;
    }

    /**
     * 在按需打开的弹层中展示各级别统计和日志源字段，未知统计保留占位。
     * @returns 日志级别数量及已读取的源应用、环境、选择器和主机。
     */
    function renderSummaryDetails() {
      return (
        <div class="system-log-page__summary-details">
          <div class="system-log-page__level-counts">
            {levelOptions.value.map((item) => (
              <span key={item.value}>
                <Tag color={getLevelColor(item.value)}>{item.label}</Tag>
                {displayCount(getSummaryCount(item.value))}
              </span>
            ))}
          </div>
          {status.value && (
            <div class="system-log-page__source-details">
              <span>{status.value.app || '-'}</span>
              <span>{status.value.env || '-'}</span>
              <span>{status.value.selector || '-'}</span>
              <span>{status.value.host || '-'}</span>
            </div>
          )}
        </div>
      );
    }

    /**
     * 把标题、源状态和总量放在同一行，失败提示保留在可见标题区域。
     * @returns 供 KtTable 标题插槽承载的紧凑状态与按需统计入口。
     */
    function renderOverview() {
      return (
        <span class="system-log-page__overview">
          <strong>{$t('system.log.title')}</strong>
          {renderSourceStatus()}
          <span>
            {$t('system.log.total')}{' '}
            {displayCount(summarySnapshot.value?.total ?? null)}
          </span>
          <APopover
            placement="bottomLeft"
            trigger="click"
            v-slots={{ content: () => renderSummaryDetails() }}
          >
            <AButton size="small" type="link">
              级别与来源
            </AButton>
          </APopover>
          {summaryError.value && (
            <span
              class="system-log-page__summary-error"
              role="status"
              title={summaryError.value}
            >
              统计暂不可用
            </span>
          )}
        </span>
      );
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
          <AKtTable
            onRegister={registerTable}
            v-slots={{
              title: () => renderOverview(),
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
