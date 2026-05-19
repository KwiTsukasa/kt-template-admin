<script lang="ts" setup>
import type { TableColumnType } from 'antdv-next';

import type { Recordable } from '@vben/types';

import type { SystemRoleApi } from '#/api';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/ktTable';

import { h } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Modal, Switch, Tag } from 'antdv-next';

import { deleteRole, getRoleList, updateRole } from '#/api';
import { KtTable, useKtTable } from '#/components/ktTable';
import { $t } from '#/locales';

import { useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const { hasAccessByCodes } = useAccess();

function hasPermission(code: string) {
  return hasAccessByCodes([code]);
}

const columns: Array<TableColumnType<SystemRoleApi.SystemRole>> = [
  {
    dataIndex: 'name',
    key: 'name',
    title: $t('system.role.roleName'),
    width: 200,
  },
  {
    dataIndex: 'id',
    key: 'id',
    title: $t('system.role.id'),
    width: 200,
  },
  {
    dataIndex: 'status',
    key: 'status',
    title: $t('system.role.status'),
    width: 100,
  },
  {
    dataIndex: 'remark',
    key: 'remark',
    title: $t('system.role.remark'),
    width: 180,
  },
  {
    dataIndex: 'createTime',
    key: 'createTime',
    title: $t('system.role.createTime'),
    width: 200,
  },
];

const api: KtTableApi<SystemRoleApi.SystemRole> = {
  list: async (params) => {
    const { pageNo, pageSize, ...formValues } = params;

    return await getRoleList({
      page: pageNo,
      pageSize,
      ...formValues,
    });
  },
};

const buttons: Array<KtTableButton<SystemRoleApi.SystemRole>> = [
  {
    icon: () => h(Plus, { class: 'kt-table__button-icon' }),
    key: 'create',
    label: $t('ui.actionTitle.create', [$t('system.role.name')]),
    onClick: onCreate,
    permissionCodes: ['System:Role:Create'],
    type: 'primary',
  },
];

const rowActions: Array<KtTableRowAction<SystemRoleApi.SystemRole>> = [
  {
    key: 'edit',
    label: $t('common.edit'),
    onClick: onEdit,
    permissionCodes: ['System:Role:Edit'],
  },
  {
    confirm: (row) => `确认删除「${row.name}」吗？`,
    danger: true,
    key: 'delete',
    label: $t('common.delete'),
    onClick: onDelete,
    permissionCodes: ['System:Role:Delete'],
  },
];

const [registerTable, tableApi] = useKtTable<SystemRoleApi.SystemRole>({
  api,
  buttons,
  columns,
  formOptions: {
    fieldMappingTime: [['createTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
  },
  rowActions,
  tableTitle: $t('system.role.list'),
});

/**
 * 将Antd的Modal.confirm封装为promise，方便在异步函数中调用。
 * @param content 提示内容
 * @param title 提示标题
 */
function confirm(content: string, title: string) {
  return new Promise((reslove, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('已取消'));
      },
      onOk() {
        reslove(true);
      },
      title,
    });
  });
}

/**
 * 状态开关即将改变
 * @param newStatus 期望改变的状态值
 * @param row 行数据
 * @returns 返回false则中止改变，返回其他值（undefined、true）则允许改变
 */
async function onStatusChange(
  newStatus: number,
  row: SystemRoleApi.SystemRole,
) {
  const status: Recordable<string> = {
    0: '禁用',
    1: '启用',
  };
  try {
    await confirm(
      `你要将${row.name}的状态切换为 【${status[newStatus.toString()]}】 吗？`,
      `切换状态`,
    );
    await updateRole(row.id, { status: newStatus });
    await tableApi.reload();
    return true;
  } catch {
    return false;
  }
}

async function onStatusSwitchChange(
  checked: boolean | number | string,
  row: SystemRoleApi.SystemRole,
) {
  const nextStatus = Number(checked) as SystemRoleApi.SystemRole['status'];
  if (nextStatus === row.status) return;

  await onStatusChange(nextStatus, row);
}

function onEdit(row: SystemRoleApi.SystemRole) {
  formDrawerApi.setData(row).open();
}

async function onDelete(
  row: SystemRoleApi.SystemRole,
  context?: KtTableContext<SystemRoleApi.SystemRole>,
) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });

  try {
    await deleteRole(row.id);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.name]),
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

function onCreate() {
  formDrawerApi.setData({}).open();
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <KtTable @register="registerTable">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <Switch
            v-if="record && hasPermission('System:Role:Edit')"
            :checked="record.status"
            :checked-value="1"
            :un-checked-value="0"
            @change="(checked) => onStatusSwitchChange(checked, record)"
          />
          <Tag v-else :color="record.status === 1 ? 'success' : 'default'">
            {{
              record.status === 1 ? $t('common.enabled') : $t('common.disabled')
            }}
          </Tag>
        </template>
      </template>
    </KtTable>
  </Page>
</template>
