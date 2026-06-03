<script lang="ts" setup>
import type { TableColumnType } from 'antdv-next';
import type { DataNode } from 'antdv-next/dist/tree/index';

import type { SystemUserApi } from '#/api';
import type { SystemDeptApi } from '#/api/system/dept';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/ktTable';

import { computed, h, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Spin, Switch, Tag, Tree } from 'antdv-next';

import { deleteUser, getUserList, updateUser } from '#/api';
import { getDeptList } from '#/api/system/dept';
import { KtTable, useKtTable } from '#/components/ktTable';
import { $t } from '#/locales';

import { useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const { hasAccessByCodes } = useAccess();
const deptTree = ref<SystemDeptApi.SystemDept[]>([]);
const deptLoading = ref(false);
const selectedDeptId = ref<string>();
const selectedDeptKeys = computed(() =>
  selectedDeptId.value ? [selectedDeptId.value] : [],
);
const deptTreeData = computed<DataNode[]>(() => mapDeptTree(deptTree.value));

function hasPermission(code: string) {
  return hasAccessByCodes([code]);
}

const columns: Array<TableColumnType<SystemUserApi.SystemUser>> = [
  {
    dataIndex: 'username',
    fixed: 'left',
    key: 'username',
    title: $t('system.user.username'),
    width: 180,
  },
  {
    dataIndex: 'realName',
    key: 'realName',
    title: $t('system.user.realName'),
    width: 160,
  },
  {
    dataIndex: 'roleNames',
    key: 'roleNames',
    title: $t('system.user.roles'),
    width: 220,
  },
  {
    dataIndex: 'deptName',
    key: 'deptName',
    title: $t('system.user.dept'),
    width: 160,
  },
  {
    align: 'center',
    dataIndex: 'status',
    key: 'status',
    title: $t('system.user.status'),
    width: 100,
  },
  {
    dataIndex: 'homePath',
    key: 'homePath',
    title: $t('system.user.homePath'),
    width: 160,
  },
  {
    dataIndex: 'timezone',
    key: 'timezone',
    title: $t('system.user.timezone'),
    width: 180,
  },
  {
    dataIndex: 'createTime',
    key: 'createTime',
    title: $t('system.user.createTime'),
    width: 200,
  },
];

const api: KtTableApi<SystemUserApi.SystemUser> = {
  list: async (params) => {
    const { pageNo, pageSize, ...formValues } = params;

    return await getUserList({
      page: pageNo,
      pageSize,
      ...(selectedDeptId.value ? { deptId: selectedDeptId.value } : {}),
      ...formValues,
    });
  },
};

const buttons: Array<KtTableButton<SystemUserApi.SystemUser>> = [
  {
    icon: () => h(Plus, { class: 'kt-table__button-icon' }),
    key: 'create',
    label: $t('ui.actionTitle.create', [$t('system.user.name')]),
    onClick: onCreate,
    permissionCodes: ['System:User:Create'],
    type: 'primary',
  },
];

const rowActions: Array<KtTableRowAction<SystemUserApi.SystemUser>> = [
  {
    key: 'edit',
    label: $t('common.edit'),
    onClick: onEdit,
    permissionCodes: ['System:User:Edit'],
  },
  {
    confirm: (row) => `确认删除「${row.username}」吗？`,
    danger: true,
    disabled: (row) => row.username === 'admin',
    key: 'delete',
    label: $t('common.delete'),
    onClick: onDelete,
    permissionCodes: ['System:User:Delete'],
  },
];

const [registerTable, tableApi] = useKtTable<SystemUserApi.SystemUser>({
  api,
  buttons,
  columns,
  formOptions: {
    fieldMappingTime: [['createTime', ['startTime', 'endTime']]],
    schema: useGridFormSchema(),
  },
  rowActions,
  tableTitle: $t('system.user.list'),
});

onMounted(() => {
  loadDeptTree();
});

async function loadDeptTree() {
  deptLoading.value = true;
  try {
    deptTree.value = await getDeptList();
  } finally {
    deptLoading.value = false;
  }
}

function onDeptSelect(keys: Array<number | string>) {
  selectedDeptId.value = keys.length > 0 ? String(keys[0]) : undefined;
  tableApi.reload();
}

function clearDeptFilter() {
  selectedDeptId.value = undefined;
  tableApi.reload();
}

function mapDeptTree(depts: SystemDeptApi.SystemDept[]): DataNode[] {
  return depts.map((dept) => ({
    children: dept.children ? mapDeptTree(dept.children) : undefined,
    key: dept.id,
    title: dept.name,
  }));
}

async function onStatusSwitchChange(
  checked: boolean | number | string,
  row: SystemUserApi.SystemUser,
) {
  const nextStatus = Number(checked) as SystemUserApi.SystemUser['status'];
  if (nextStatus === row.status) return;

  await updateUser(row.id, { status: nextStatus });
  await tableApi.reload();
}

function onEdit(row: SystemUserApi.SystemUser) {
  formDrawerApi.setData(row).open();
}

async function onDelete(
  row: SystemUserApi.SystemUser,
  context?: KtTableContext<SystemUserApi.SystemUser>,
) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.username]),
    duration: 0,
    key: 'action_process_msg',
  });

  try {
    await deleteUser(row.id);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.username]),
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
  formDrawerApi.setData({ deptId: selectedDeptId.value }).open();
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <div class="system-user-page">
      <aside class="system-user-page__dept">
        <div class="system-user-page__dept-header">
          <span class="system-user-page__dept-title">
            {{ $t('system.user.deptTree') }}
          </span>
          <Button size="small" type="link" @click="clearDeptFilter">
            {{ $t('system.user.allDept') }}
          </Button>
        </div>
        <Spin :spinning="deptLoading">
          <Tree
            block-node
            :selected-keys="selectedDeptKeys"
            :tree-data="deptTreeData"
            default-expand-all
            @select="onDeptSelect"
          />
        </Spin>
      </aside>
      <main class="system-user-page__table">
        <KtTable @register="registerTable">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'roleNames'">
              <div class="system-user-list__roles">
                <Tag
                  v-for="roleName in record.roleNames || []"
                  :key="roleName"
                  color="processing"
                >
                  {{ roleName }}
                </Tag>
              </div>
            </template>
            <template v-if="column.key === 'deptName'">
              {{ record.deptName || '-' }}
            </template>
            <template v-if="column.key === 'status'">
              <Switch
                v-if="record && hasPermission('System:User:Edit')"
                :checked="record.status"
                :checked-value="1"
                :un-checked-value="0"
                @change="(checked) => onStatusSwitchChange(checked, record)"
              />
              <Tag v-else :color="record.status === 1 ? 'success' : 'default'">
                {{
                  record.status === 1
                    ? $t('common.enabled')
                    : $t('common.disabled')
                }}
              </Tag>
            </template>
          </template>
        </KtTable>
      </main>
    </div>
  </Page>
</template>

<style lang="scss" scoped>
.system-user-page {
  display: flex;
  gap: 12px;
  height: 100%;
  min-height: 0;

  &__dept {
    display: flex;
    flex: 0 0 240px;
    flex-direction: column;
    min-height: 0;
    padding: 12px;
    overflow: hidden;
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-radius: 6px;
  }

  &__dept-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 10px;
    margin-bottom: 10px;
    border-bottom: 1px solid hsl(var(--border));
  }

  &__dept-title {
    font-size: 14px;
    font-weight: 600;
    color: hsl(var(--foreground));
  }

  &__table {
    min-width: 0;
    min-height: 0;
    flex: 1;
  }

  :deep(.ant-spin-nested-loading),
  :deep(.ant-spin-container) {
    min-height: 0;
    flex: 1;
  }

  :deep(.ant-spin-container) {
    overflow: auto;
  }
}

.system-user-list {
  &__roles {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
}
</style>
