<script lang="ts" setup>
import type { TableColumnType } from 'antdv-next';

import type { SystemNoticeApi } from '#/api/system/notice';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/ktTable';

import { h } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Tag } from 'antdv-next';

import {
  deleteNotice,
  getNoticeList,
  toggleNoticeStatus,
  toggleNoticeTop,
} from '#/api/system/notice';
import { KtTable, useKtTable } from '#/components/ktTable';
import { $t } from '#/locales';

import { getNoticeStatusOptions, useSearchSchema } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const noticeStatusOptions = getNoticeStatusOptions();

const columns: Array<TableColumnType<SystemNoticeApi.NoticeItem>> = [
  {
    dataIndex: 'isTop',
    fixed: 'left',
    key: 'isTop',
    title: $t('system.notice.top'),
    width: 90,
  },
  {
    dataIndex: 'title',
    fixed: 'left',
    key: 'title',
    title: $t('system.notice.title'),
    width: 260,
  },
  {
    dataIndex: 'level',
    key: 'level',
    title: $t('system.notice.level'),
    width: 100,
  },
  {
    dataIndex: 'status',
    key: 'status',
    title: $t('system.notice.status'),
    width: 100,
  },
  {
    dataIndex: 'notifyUsers',
    key: 'notifyUsers',
    title: $t('system.notice.notifyUsers'),
    width: 180,
  },
  {
    dataIndex: 'createTime',
    key: 'createTime',
    title: $t('system.notice.createTime'),
    width: 190,
  },
  {
    align: 'left',
    dataIndex: 'summary',
    key: 'summary',
    title: $t('system.notice.summary'),
    width: 280,
  },
];

const api: KtTableApi<SystemNoticeApi.NoticeItem> = {
  list: async (params) => await getNoticeList(params),
};

const buttons: Array<KtTableButton<SystemNoticeApi.NoticeItem>> = [
  {
    icon: () => h(Plus, { class: 'kt-table__button-icon' }),
    key: 'create',
    label: $t('ui.actionTitle.create', [$t('system.notice.name')]),
    onClick: onCreate,
    permissionCodes: ['System:Notice:Create'],
    type: 'primary',
  },
];

const rowActions: Array<KtTableRowAction<SystemNoticeApi.NoticeItem>> = [
  {
    key: 'edit',
    label: $t('common.edit'),
    onClick: onEdit,
    permissionCodes: ['System:Notice:Edit'],
  },
  {
    confirm: (row) => $t('system.notice.toggleStatusConfirm', [row.title]),
    key: 'toggle',
    label: $t('system.notice.toggle'),
    onClick: onToggleStatus,
    permissionCodes: ['System:Notice:Edit'],
  },
  {
    confirm: (row) => $t('system.notice.toggleTopConfirm', [row.title]),
    key: 'top',
    label: $t('system.notice.topToggle'),
    onClick: onToggleTop,
    permissionCodes: ['System:Notice:Edit'],
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

function getNoticeStatusOption(status: SystemNoticeApi.NoticeItem['status']) {
  return noticeStatusOptions.find((item) => item.value === status);
}

function getNoticeLevelColor(level: SystemNoticeApi.NoticeItem['level']) {
  if (level === 3) return 'red';
  if (level === 2) return 'orange';
  return 'blue';
}

const [registerTable, tableApi] = useKtTable<SystemNoticeApi.NoticeItem>({
  api,
  buttons,
  columns,
  formOptions: {
    schema: useSearchSchema(),
  },
  rowActions,
  rowKey: 'id',
  showSelection: false,
  tableTitle: $t('system.notice.title'),
});

function onCreate() {
  formModalApi.setData(undefined).open();
}

function onEdit(row: SystemNoticeApi.NoticeItem) {
  formModalApi.setData(row).open();
}

async function onToggleStatus(
  row: SystemNoticeApi.NoticeItem,
  context: KtTableContext<SystemNoticeApi.NoticeItem>,
) {
  const nextStatus = row.status === 1 ? 0 : 1;
  await toggleNoticeStatus(row.id, nextStatus);
  message.success(
    nextStatus === 1
      ? $t('system.notice.enableSuccess')
      : $t('system.notice.disableSuccess'),
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

function onRefresh() {
  tableApi.reload();
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="onRefresh" />
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
        <template v-else-if="column.key === 'level'">
          <Tag :color="getNoticeLevelColor(record.level)">
            {{ $t('system.notice.levelText', { level: record.level }) }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'status'">
          <Tag
            :color="getNoticeStatusOption(record.status)?.color || 'default'"
          >
            {{ getNoticeStatusOption(record.status)?.label || record.status }}
          </Tag>
        </template>
      </template>
    </KtTable>
  </Page>
</template>
