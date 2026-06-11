<script lang="ts" setup>
import type { TableColumnType } from 'antdv-next';

import type { SystemNoticeApi } from '#/api/system/notice';
import type {
  KtTableApi,
  KtTableContext,
  KtTableRowAction,
} from '#/components/ktTable';

import { Page } from '@vben/common-ui';

import { message, Tag } from 'antdv-next';

import {
  deleteNotice,
  getNoticeList,
  toggleNoticeStatus,
  toggleNoticeTop,
} from '#/api/system/notice';
import { KtTable, useKtTable } from '#/components/ktTable';
import { $t } from '#/locales';

import {
  getNoticeSeverityOptions,
  getNoticeSourceOptions,
  getNoticeStatusOptions,
  useSearchSchema,
} from './data';

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

function getNoticeSeverityOption(
  severity: SystemNoticeApi.NoticeItem['severity'],
) {
  return noticeSeverityOptions.find((item) => item.value === severity);
}

function getNoticeSourceOption(source?: string) {
  return noticeSourceOptions.find((item) => item.value === source);
}

function getNoticeStatusOption(status: SystemNoticeApi.NoticeItem['status']) {
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

async function onToggleStatus(
  row: SystemNoticeApi.NoticeItem,
  context: KtTableContext<SystemNoticeApi.NoticeItem>,
) {
  const nextStatus = row.status === 1 ? 0 : 1;
  await toggleNoticeStatus(row.id, nextStatus);
  message.success(
    nextStatus === 0
      ? $t('system.notice.handleSuccess')
      : $t('system.notice.reopenSuccess'),
  );
  await context.reload();
}

async function onToggleTop(
  row: SystemNoticeApi.NoticeItem,
  context: KtTableContext<SystemNoticeApi.NoticeItem>,
) {
  await toggleNoticeTop(row.id, !row.isTop);
  message.success(
    row.isTop
      ? $t('system.notice.cancelTopSuccess')
      : $t('system.notice.topSuccess'),
  );
  await context.reload();
}

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
</script>

<template>
  <Page auto-content-height>
    <KtTable @register="registerTable">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'isTop'">
          <Tag :color="record.isTop ? 'warning' : 'default'">
            {{
              record.isTop
                ? $t('system.notice.topYes')
                : $t('system.notice.topNo')
            }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'severity'">
          <Tag
            :color="
              getNoticeSeverityOption(record.severity)?.color || 'default'
            "
          >
            {{
              getNoticeSeverityOption(record.severity)?.label ||
              record.severity ||
              '-'
            }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'source'">
          <Tag :color="getNoticeSourceOption(record.source)?.color || 'blue'">
            {{
              getNoticeSourceOption(record.source)?.label ||
              record.source ||
              '-'
            }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'status'">
          <Tag
            :color="getNoticeStatusOption(record.status)?.color || 'default'"
          >
            {{ getNoticeStatusOption(record.status)?.label || record.status }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'occurrenceCount'">
          {{ record.occurrenceCount || 1 }}
        </template>
        <template v-else-if="column.key === 'summary'">
          {{ record.summary || record.content || '-' }}
        </template>
      </template>
    </KtTable>
  </Page>
</template>
