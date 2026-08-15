import type { TableColumnType } from 'antdv-next';

import type { SystemMenuApi } from '#/api/system/menu';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/ktTable';

import { defineComponent } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';
import { $t } from '@vben/locales';

import { MenuBadge } from '@vben-core/menu-ui';

import { message, Tag } from 'antdv-next';

import { deleteMenu, getMenuList } from '#/api/system/menu';
import { KtTable, useKtTable } from '#/components/ktTable';

import { getMenuTypeOptions } from './data';
import Form from './modules/form.vue';

import './list.scss';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'SystemMenuList',
  setup() {
    const [FormDrawer, formDrawerApi] = useVbenDrawer<{
      onSuccess?: () => void;
      title?: string;
    }>({
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
        dataIndex: 'sort',
        key: 'sort',
        title: $t('system.menu.sort'),
        width: 90,
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
        icon: <Plus class="kt-table__button-icon" />,
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
      void tableApi.reload();
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

    function renderMenuIcon(row: SystemMenuApi.SystemMenu) {
      if (row.type === 'button') {
        return (
          <IconifyIcon class="menu-title__icon-svg" icon="carbon:security" />
        );
      }
      if (row.meta?.icon) {
        return (
          <IconifyIcon
            class="menu-title__icon-svg"
            icon={row.meta.icon || 'carbon:circle-dash'}
          />
        );
      }
      return null;
    }

    function renderTitle(row: SystemMenuApi.SystemMenu) {
      return (
        <div class="menu-title">
          <div class="menu-title__icon">{renderMenuIcon(row)}</div>
          <span class="menu-title__text">{$t(row.meta?.title ?? '')}</span>
          {row.meta?.badgeType ? (
            <MenuBadge
              badge={row.meta.badge ?? ''}
              badgeType={row.meta.badgeType}
              badgeVariants={row.meta.badgeVariants}
              class="menu-badge"
            />
          ) : null}
        </div>
      );
    }

    return () => (
      <Page autoContentHeight>
        <FormDrawer onSuccess={onRefresh} />
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as SystemMenuApi.SystemMenu;
              if (column.key === 'title') return renderTitle(row);
              if (column.key === 'type') {
                return (
                  <Tag color={getMenuTypeOption(row.type)?.color}>
                    {getMenuTypeOption(row.type)?.label || row.type}
                  </Tag>
                );
              }
              if (column.key === 'component') {
                return readComponent(row) || '-';
              }
              if (column.key === 'status') {
                return (
                  <Tag color={row.status === 1 ? 'success' : 'default'}>
                    {row.status === 1
                      ? $t('common.enabled')
                      : $t('common.disabled')}
                  </Tag>
                );
              }
              return undefined;
            },
          }}
        />
      </Page>
    );
  },
});
