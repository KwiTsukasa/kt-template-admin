<script lang="ts" setup>
import type { TableColumnType } from 'antdv-next';

import type { SystemDictApi } from '#/api/system/dict';
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

import { deleteDict, getDictList, toggleDictStatus } from '#/api/system/dict';
import { KtTable, useKtTable } from '#/components/ktTable';
import { clearDictCache } from '#/hooks/useDict';
import { $t } from '#/locales';

import { getStatusOptions, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const statusOptions = getStatusOptions();

const columns: Array<TableColumnType<SystemDictApi.DictItem>> = [
  {
    dataIndex: 'dictCode',
    fixed: 'left',
    key: 'dictCode',
    title: $t('system.dict.dictCode'),
    width: 220,
  },
  {
    dataIndex: 'label',
    key: 'label',
    title: $t('system.dict.label'),
    width: 180,
  },
  {
    dataIndex: 'value',
    key: 'value',
    title: $t('system.dict.value'),
    width: 180,
  },
  {
    dataIndex: 'childrenCode',
    key: 'childrenCode',
    title: $t('system.dict.childrenCode'),
    width: 180,
  },
  {
    align: 'center',
    dataIndex: 'sort',
    key: 'sort',
    title: $t('system.dict.sort'),
    width: 100,
  },
  {
    align: 'center',
    dataIndex: 'status',
    key: 'status',
    title: $t('system.dict.status'),
    width: 100,
  },
  {
    dataIndex: 'updateTime',
    key: 'updateTime',
    title: $t('system.dict.updateTime'),
    width: 200,
  },
];

const api: KtTableApi<SystemDictApi.DictItem> = {
  list: async (params) => await getDictList(params),
};

const buttons: Array<KtTableButton<SystemDictApi.DictItem>> = [
  {
    icon: () => h(Plus, { class: 'kt-table__button-icon' }),
    key: 'create',
    label: $t('ui.actionTitle.create', [$t('system.dict.name')]),
    onClick: onCreate,
    permissionCodes: ['System:Dict:Create'],
    type: 'primary',
  },
];

const rowActions: Array<KtTableRowAction<SystemDictApi.DictItem>> = [
  {
    key: 'toggle',
    label: $t('system.dict.toggle'),
    onClick: onToggle,
    permissionCodes: ['System:Dict:Edit'],
  },
  {
    key: 'edit',
    label: $t('common.edit'),
    onClick: onEdit,
    permissionCodes: ['System:Dict:Edit'],
  },
  {
    confirm: (row) =>
      $t('system.dict.deleteConfirm', [row.dictCode, row.label]),
    danger: true,
    key: 'delete',
    label: $t('common.delete'),
    onClick: onDelete,
    permissionCodes: ['System:Dict:Delete'],
  },
];

const [registerTable, tableApi] = useKtTable<SystemDictApi.DictItem>({
  api,
  buttons,
  columns,
  formOptions: {
    schema: useGridFormSchema(),
  },
  rowActions,
  tableTitle: $t('system.dict.list'),
});

function getStatusOption(status: SystemDictApi.DictItem['status']) {
  return statusOptions.find((item) => item.value === status);
}

function onCreate() {
  formModalApi.setData(undefined).open();
}

function onEdit(row: SystemDictApi.DictItem) {
  formModalApi.setData(row).open();
}

async function onToggle(
  row: SystemDictApi.DictItem,
  context: KtTableContext<SystemDictApi.DictItem>,
) {
  const nextStatus = row.status === 1 ? 0 : 1;
  await toggleDictStatus(row.id, nextStatus);
  clearDictCache(row.dictCode);
  message.success(
    nextStatus === 1
      ? $t('system.dict.enableSuccess')
      : $t('system.dict.disableSuccess'),
  );
  await context.reload();
}

async function onDelete(
  row: SystemDictApi.DictItem,
  context?: KtTableContext<SystemDictApi.DictItem>,
) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.label]),
    duration: 0,
    key: 'action_process_msg',
  });

  try {
    await deleteDict(row.id);
    clearDictCache(row.dictCode);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.label]),
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
        <template v-if="column.key === 'childrenCode'">
          {{ record.childrenCode || '-' }}
        </template>
        <template v-else-if="column.key === 'status'">
          <Tag :color="getStatusOption(record.status)?.color">
            {{ getStatusOption(record.status)?.label || record.status }}
          </Tag>
        </template>
      </template>
    </KtTable>
  </Page>
</template>
