<script lang="ts" setup>
import type { TableColumnType } from 'antdv-next';

import type { SystemDictApi } from '#/api/system/dict';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTablePageResult,
  KtTableRegisterApi,
  KtTableRowAction,
} from '#/components/ktTable';

import { h, nextTick, ref, watch } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Tag } from 'antdv-next';

import {
  deleteDict,
  getDictGroups,
  getDictList,
  toggleDictStatus,
} from '#/api/system/dict';
import { KtTable, useKtTable } from '#/components/ktTable';
import { clearDictCache } from '#/hooks/useDict';
import { $t } from '#/locales';

import {
  getStatusOptions,
  useGridFormSchema,
  useGroupFormSchema,
} from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const statusOptions = getStatusOptions();
const selectedDictCode = ref('');
const itemTableRegistered = ref(false);

const groupColumns: Array<TableColumnType<SystemDictApi.DictGroup>> = [
  {
    dataIndex: 'dictCode',
    key: 'dictCode',
    title: $t('system.dict.dictCode'),
    width: 220,
  },
  {
    align: 'right',
    dataIndex: 'itemCount',
    key: 'itemCount',
    title: '项数',
    width: 88,
  },
];

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

const groupApi: KtTableApi<SystemDictApi.DictGroup> = {
  list: async (params) => await getDictGroups(params),
};

const api: KtTableApi<SystemDictApi.DictItem> = {
  list: async (params) => {
    if (!selectedDictCode.value) {
      return {
        items: [],
        total: 0,
      };
    }

    return await getDictList({
      ...params,
      dictCode: selectedDictCode.value,
    });
  },
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

const [registerGroupTable, groupTableApi] = useKtTable<SystemDictApi.DictGroup>(
  {
    activeRowKey: selectedDictCode.value,
    afterFetch: onGroupAfterFetch,
    api: groupApi,
    columns: groupColumns,
    formOptions: {
      formGrid: {
        actionMinWidth: 180,
        actionSpan: 8,
        contentSpan: 16,
        fieldSpan: 16,
      },
      schema: useGroupFormSchema(),
    },
    onRowClick: onGroupRowClick,
    pageSize: 20,
    rowKey: 'dictCode',
    showIndex: false,
    showSelection: false,
    showTableSetting: false,
    tableTitle: '字典编码',
  },
);

const [registerItemTable, tableApi] = useKtTable<SystemDictApi.DictItem>({
  api,
  buttons,
  columns,
  formOptions: {
    schema: useGridFormSchema().filter((item) => item.fieldName !== 'dictCode'),
  },
  immediate: false,
  rowActions,
  rowKey: 'id',
  showPagination: true,
  tableTitle: getItemTableTitle(),
});

watch(selectedDictCode, (dictCode) => {
  groupTableApi.setProps({
    activeRowKey: dictCode,
  });
  tableApi.setProps({
    tableTitle: getItemTableTitle(),
  });
});

function getItemTableTitle() {
  return selectedDictCode.value
    ? `字典项：${selectedDictCode.value}`
    : '字典项';
}

function getStatusOption(status: SystemDictApi.DictItem['status']) {
  return statusOptions.find((item) => item.value === status);
}

function normalizeGroupRows(
  result:
    | KtTablePageResult<SystemDictApi.DictGroup>
    | SystemDictApi.DictGroup[],
) {
  if (Array.isArray(result)) return result;

  return result.items || result.list || result.records || [];
}

async function onGroupAfterFetch(
  result:
    | KtTablePageResult<SystemDictApi.DictGroup>
    | SystemDictApi.DictGroup[],
) {
  const rows = normalizeGroupRows(result);
  const selectedExists = rows.some(
    (item) => item.dictCode === selectedDictCode.value,
  );
  if (!selectedExists) {
    selectedDictCode.value = rows[0]?.dictCode || '';
  }

  await reloadItemTable();
  return result;
}

async function onGroupRowClick(row: SystemDictApi.DictGroup) {
  if (selectedDictCode.value === row.dictCode) return;

  selectedDictCode.value = row.dictCode;
  await reloadItemTable();
}

function onItemTableRegister(api: KtTableRegisterApi<SystemDictApi.DictItem>) {
  registerItemTable(api);
  itemTableRegistered.value = true;
  reloadItemTable();
}

async function reloadItemTable() {
  if (!itemTableRegistered.value) return;

  await nextTick();
  await tableApi.search();
}

function onCreate() {
  formModalApi
    .setData(
      selectedDictCode.value
        ? {
            dictCode: selectedDictCode.value,
          }
        : undefined,
    )
    .open();
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
    await groupTableApi.reload();
  } catch {
    hideLoading();
  }
}

async function onRefresh() {
  await groupTableApi.reload();
  await tableApi.reload();
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="onRefresh" />
    <div class="dict-page">
      <section class="dict-page__groups">
        <KtTable @register="registerGroupTable" />
      </section>
      <section class="dict-page__items">
        <KtTable @register="onItemTableRegister">
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
      </section>
    </div>
  </Page>
</template>

<style scoped>
.dict-page {
  display: grid;
  grid-template-columns: minmax(460px, 520px) minmax(0, 1fr);
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.dict-page__groups,
.dict-page__items {
  min-width: 0;
  min-height: 0;
}

@media (max-width: 1024px) {
  .dict-page {
    grid-template-columns: 1fr;
  }
}
</style>
