<script lang="ts" setup>
import type { TableColumnType } from 'antdv-next';

import type { SystemLogApi } from '#/api/system/log';
import type {
  KtTableApi,
  KtTableContext,
  KtTablePageResult,
  KtTableRowAction,
} from '#/components/ktTable';

import { computed, onMounted, ref } from 'vue';

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
</script>

<template>
  <Page auto-content-height>
    <div class="system-log-page">
      <section class="system-log-page__status">
        <div class="system-log-page__status-main">
          <Tag :color="status?.configured ? 'success' : 'warning'">
            {{
              status?.configured
                ? $t('system.log.configured')
                : $t('system.log.unconfigured')
            }}
          </Tag>
          <span>{{ status?.app || '-' }}</span>
          <span>{{ status?.env || '-' }}</span>
          <span class="system-log-page__muted">
            {{ status?.selector || $t('system.log.emptyStatus') }}
          </span>
        </div>
        <div class="system-log-page__host">
          {{ status?.host || '-' }}
        </div>
      </section>

      <section class="system-log-page__summary">
        <div class="system-log-page__summary-item">
          <span>{{ $t('system.log.total') }}</span>
          <strong>{{ summaryTotal }}</strong>
        </div>
        <div
          v-for="item in levelOptions"
          :key="item.value"
          class="system-log-page__summary-item"
        >
          <Tag :color="getLevelColor(item.value)">
            {{ item.label }}
          </Tag>
          <strong>{{ getSummaryCount(item.value) }}</strong>
        </div>
      </section>

      <KtTable @register="registerTable">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'level'">
            <Tag :color="getLevelColor(record.level)">
              {{ record.level }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'statusCode'">
            <Tag :color="getStatusColor(record.statusCode)">
              {{ record.statusCode || '-' }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'durationMs'">
            {{
              record.durationMs === undefined ? '-' : `${record.durationMs} ms`
            }}
          </template>
          <template v-else-if="column.key === 'message'">
            <span class="system-log-page__message" :title="record.message">
              {{ record.message }}
            </span>
          </template>
        </template>
      </KtTable>
    </div>

    <Drawer v-model:open="detailOpen" :size="720" :title="$t('system.log.raw')">
      <dl v-if="detailRecord" class="system-log-page__detail">
        <dt>{{ $t('system.log.time') }}</dt>
        <dd>{{ detailRecord.timestamp }}</dd>
        <dt>{{ $t('system.log.level') }}</dt>
        <dd>
          <Tag :color="getLevelColor(detailRecord.level)">
            {{ detailRecord.level }}
          </Tag>
        </dd>
        <dt>{{ $t('system.log.context') }}</dt>
        <dd>{{ detailRecord.context || '-' }}</dd>
        <dt>{{ $t('system.log.requestId') }}</dt>
        <dd>{{ detailRecord.requestId || '-' }}</dd>
        <dt>{{ $t('system.log.path') }}</dt>
        <dd>{{ detailRecord.path || '-' }}</dd>
      </dl>
      <pre class="system-log-page__raw">{{ detailRecord?.raw || '' }}</pre>
    </Drawer>
  </Page>
</template>

<style scoped>
.system-log-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.system-log-page__status,
.system-log-page__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.system-log-page__status {
  justify-content: space-between;
}

.system-log-page__status-main {
  display: flex;
  flex: 1;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.system-log-page__host,
.system-log-page__muted {
  min-width: 0;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-log-page__summary-item {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-right: 1px solid hsl(var(--border));
}

.system-log-page__summary-item:last-child {
  border-right: 0;
}

.system-log-page__summary-item strong {
  font-variant-numeric: tabular-nums;
}

.system-log-page__message {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-log-page__detail {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 10px 12px;
  margin: 0 0 12px;
}

.system-log-page__detail dt {
  color: hsl(var(--muted-foreground));
}

.system-log-page__detail dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.system-log-page__raw {
  min-height: 280px;
  padding: 12px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}
</style>
