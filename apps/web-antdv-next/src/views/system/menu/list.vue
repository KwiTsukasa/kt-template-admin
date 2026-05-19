<script lang="ts" setup>
import type { TableColumnType } from 'antdv-next';

import type { SystemMenuApi } from '#/api/system/menu';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/ktTable';

import { h } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';
import { $t } from '@vben/locales';

import { MenuBadge } from '@vben-core/menu-ui';

import { message, Tag } from 'antdv-next';

import { deleteMenu, getMenuList } from '#/api/system/menu';
import { KtTable, useKtTable } from '#/components/ktTable';

import { getMenuTypeOptions } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const menuTypeOptions = getMenuTypeOptions();

const columns: Array<TableColumnType<SystemMenuApi.SystemMenu>> = [
  {
    dataIndex: ['meta', 'title'],
    fixed: 'left',
    key: 'title',
    title: $t('system.menu.menuTitle'),
    width: 250,
  },
  {
    align: 'center',
    dataIndex: 'type',
    key: 'type',
    title: $t('system.menu.type'),
    width: 100,
  },
  {
    dataIndex: 'authCode',
    key: 'authCode',
    title: $t('system.menu.authCode'),
    width: 200,
  },
  {
    dataIndex: 'path',
    key: 'path',
    title: $t('system.menu.path'),
    width: 200,
  },
  {
    dataIndex: 'component',
    key: 'component',
    title: $t('system.menu.component'),
    width: 220,
  },
  {
    align: 'center',
    dataIndex: 'status',
    key: 'status',
    title: $t('system.menu.status'),
    width: 100,
  },
];

const api: KtTableApi<SystemMenuApi.SystemMenu> = {
  list: getMenuList,
};

const buttons: Array<KtTableButton<SystemMenuApi.SystemMenu>> = [
  {
    icon: () => h(Plus, { class: 'kt-table__button-icon' }),
    key: 'create',
    label: $t('ui.actionTitle.create', [$t('system.menu.name')]),
    onClick: onCreate,
    permissionCodes: ['System:Menu:Create'],
    type: 'primary',
  },
];

const rowActions: Array<KtTableRowAction<SystemMenuApi.SystemMenu>> = [
  {
    key: 'append',
    label: '新增下级',
    onClick: onAppend,
    permissionCodes: ['System:Menu:Create'],
  },
  {
    key: 'edit',
    label: $t('common.edit'),
    onClick: onEdit,
    permissionCodes: ['System:Menu:Edit'],
  },
  {
    confirm: (row) => `确认删除「${row.name}」吗？`,
    danger: true,
    key: 'delete',
    label: $t('common.delete'),
    onClick: onDelete,
    permissionCodes: ['System:Menu:Delete'],
  },
];

const [registerTable, tableApi] = useKtTable<SystemMenuApi.SystemMenu>({
  api,
  buttons,
  columns,
  rowActions,
  showDefaultButtons: false,
  showFooter: false,
  showPagination: false,
});

function getMenuTypeOption(type: SystemMenuApi.SystemMenu['type']) {
  return menuTypeOptions.find((item) => item.value === type);
}

function readComponent(row: SystemMenuApi.SystemMenu) {
  switch (row.type) {
    case 'catalog':
    case 'menu': {
      return row.component ?? '';
    }
    case 'embedded': {
      return row.meta?.iframeSrc ?? '';
    }
    case 'link': {
      return row.meta?.link ?? '';
    }
    default: {
      return '';
    }
  }
}

function onRefresh() {
  tableApi.reload();
}

function onEdit(row: SystemMenuApi.SystemMenu) {
  formDrawerApi.setData(row).open();
}

function onCreate() {
  formDrawerApi.setData({}).open();
}

function onAppend(row: SystemMenuApi.SystemMenu) {
  formDrawerApi.setData({ pid: row.id }).open();
}

async function onDelete(
  row: SystemMenuApi.SystemMenu,
  context?: KtTableContext<SystemMenuApi.SystemMenu>,
) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });

  try {
    await deleteMenu(row.id);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.name]),
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
    <FormDrawer @success="onRefresh" />
    <KtTable @register="registerTable">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'title'">
          <div class="menu-title">
            <div class="menu-title__icon">
              <IconifyIcon
                v-if="record.type === 'button'"
                class="menu-title__icon-svg"
                icon="carbon:security"
              />
              <IconifyIcon
                v-else-if="record.meta?.icon"
                class="menu-title__icon-svg"
                :icon="record.meta?.icon || 'carbon:circle-dash'"
              />
            </div>
            <span class="menu-title__text">{{ $t(record.meta?.title) }}</span>
            <MenuBadge
              v-if="record.meta?.badgeType"
              class="menu-badge"
              :badge="record.meta.badge"
              :badge-type="record.meta.badgeType"
              :badge-variants="record.meta.badgeVariants"
            />
          </div>
        </template>
        <template v-else-if="column.key === 'type'">
          <Tag :color="getMenuTypeOption(record.type)?.color">
            {{ getMenuTypeOption(record.type)?.label || record.type }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'component'">
          {{ readComponent(record) || '-' }}
        </template>
        <template v-else-if="column.key === 'status'">
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

<style lang="scss" scoped>
.menu-title {
  position: relative;
  display: flex;
  gap: 4px;
  align-items: center;
  width: 100%;
  min-width: 0;

  &__icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
  }

  &__icon-svg {
    width: 100%;
    height: 100%;
  }

  &__text {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.menu-badge {
  top: 50%;
  right: 0;
  transform: translateY(-50%);

  & > :deep(div) {
    padding-top: 0;
    padding-bottom: 0;
  }
}
</style>
