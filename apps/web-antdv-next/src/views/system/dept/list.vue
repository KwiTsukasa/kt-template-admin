<script lang="ts" setup>
import type { TableColumnType } from 'antdv-next';

import type { SystemDeptApi } from '#/api/system/dept';
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

import { deleteDept, getDeptList } from '#/api/system/dept';
import { KtTable, useKtTable } from '#/components/ktTable';
import { $t } from '#/locales';

import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const columns: Array<TableColumnType<SystemDeptApi.SystemDept>> = [
  {
    dataIndex: 'name',
    fixed: 'left',
    key: 'name',
    title: $t('system.dept.deptName'),
    width: 180,
  },
  {
    align: 'center',
    dataIndex: 'status',
    key: 'status',
    title: $t('system.dept.status'),
    width: 100,
  },
  {
    dataIndex: 'createTime',
    key: 'createTime',
    title: $t('system.dept.createTime'),
    width: 180,
  },
  {
    dataIndex: 'remark',
    key: 'remark',
    title: $t('system.dept.remark'),
    width: 260,
  },
];

const api: KtTableApi<SystemDeptApi.SystemDept> = {
  list: async () => {
    return await getDeptList();
  },
};

const buttons: Array<KtTableButton<SystemDeptApi.SystemDept>> = [
  {
    icon: () => h(Plus, { class: 'kt-table__button-icon' }),
    key: 'create',
    label: $t('ui.actionTitle.create', [$t('system.dept.name')]),
    onClick: onCreate,
    permissionCodes: ['System:Dept:Create'],
    type: 'primary',
  },
];

const rowActions: Array<KtTableRowAction<SystemDeptApi.SystemDept>> = [
  {
    key: 'append',
    label: '新增下级',
    onClick: onAppend,
    permissionCodes: ['System:Dept:Create'],
  },
  {
    key: 'edit',
    label: $t('common.edit'),
    onClick: onEdit,
    permissionCodes: ['System:Dept:Edit'],
  },
  {
    confirm: (row) => `确认删除「${row.name}」吗？`,
    danger: true,
    disabled: (row) => !!row.children?.length,
    key: 'delete',
    label: $t('common.delete'),
    onClick: onDelete,
    permissionCodes: ['System:Dept:Delete'],
  },
];

const [registerTable, tableApi] = useKtTable<SystemDeptApi.SystemDept>({
  api,
  buttons,
  columns,
  rowActions,
  showDefaultButtons: false,
  showFooter: false,
  showPagination: false,
  tableTitle: '部门列表',
});

function onEdit(row: SystemDeptApi.SystemDept) {
  formModalApi.setData(row).open();
}

function onAppend(row: SystemDeptApi.SystemDept) {
  formModalApi.setData({ pid: row.id }).open();
}

function onCreate() {
  formModalApi.setData(null).open();
}

async function onDelete(
  row: SystemDeptApi.SystemDept,
  context?: KtTableContext<SystemDeptApi.SystemDept>,
) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });

  try {
    await deleteDept(row.id);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.name]),
      key: 'action_process_msg',
    });
    await (context || tableApi).reload();
  } catch {
    hideLoading();
  }
}

function refreshTable() {
  tableApi.reload();
}
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="refreshTable" />
    <KtTable @register="registerTable">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <Tag :color="record.status === 1 ? 'success' : 'default'">
            {{
              record.status === 1 ? $t('common.enabled') : $t('common.disabled')
            }}
          </Tag>
        </template>
      </template>
    </KtTable>
  </Page>
</template>
