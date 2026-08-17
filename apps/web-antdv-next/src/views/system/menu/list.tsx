import type { TableColumnType } from 'antdv-next';

import type { SystemMenuApi } from '#/api/system/menu';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/kt-table';

import { defineComponent } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';
import { $t } from '@vben/locales';

import { MenuBadge } from '@vben-core/menu-ui';

import { message, Tag } from 'antdv-next';

import { deleteMenu, getMenuList } from '#/api/system/menu';
import { KtTable, useKtTable } from '#/components/kt-table';

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

    /**
     * 从菜单类型选项中查找与类型匹配的标签颜色；未知类型返回 undefined。
     *
     * @param type - 需要匹配颜色和标签的目录、菜单、链接或按钮类型。
     * @returns 与菜单类型匹配的选项；未知类型回退为默认选项。
     */
    function getMenuTypeOption(type: SystemMenuApi.SystemMenu['type']) {
      return menuTypeOptions.find((item) => item.value === type);
    }

    /**
     * 从菜单组件字段读取可加载页面名，空字符串和布局占位返回 undefined。
     *
     * @param row - 需要解析动态页面组件名的系统菜单记录。
     * @returns 可动态加载的菜单页面名；空值或布局占位时返回 undefined。
     */
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

    /**
     * 触发系统菜单表格重新请求当前数据。
     */
    function onRefresh() {
      void tableApi.reload();
    }

    /**
     * 将选中菜单写入抽屉上下文并打开编辑表单。
     *
     * @param row - 要加载到菜单编辑抽屉的菜单节点。
     */
    function onEdit(row: SystemMenuApi.SystemMenu) {
      formDrawerApi.setData(row).open();
    }

    /**
     * 通过空菜单上下文打开顶级菜单新建抽屉。
     */
    function onCreate() {
      formDrawerApi.setData({}).open();
    }

    /**
     * 把选中菜单作为父级上下文并打开新增菜单抽屉。
     *
     * @param row - 作为新菜单父级的现有菜单记录。
     */
    function onAppend(row: SystemMenuApi.SystemMenu) {
      formDrawerApi.setData({ pid: row.id }).open();
    }

    /**
     * 删除选中菜单，成功后提示并刷新调用方或默认表格。
     *
     * @param row - 要删除的系统菜单记录。
     * @param context - 删除后优先用于重新加载列表的 KtTable 上下文；缺省时使用当前表格 API。
     */
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

    /**
     * 根据菜单类型与元数据选择权限图标或配置图标；没有图标时返回 null。
     *
     * @param row - 需要选择权限图标或元数据图标的菜单记录。
     * @returns 按钮权限图标或菜单配置图标；没有可用图标时返回 null。
     */
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

    /**
     * 把菜单图标、国际化标题与可选徽标组合成树表标题单元格。
     *
     * @param row - 需要渲染图标、标题和徽标的菜单记录。
     * @returns 包含图标、国际化标题与可选徽标的菜单标题节点。
     */
    function renderTitle(row: SystemMenuApi.SystemMenu) {
      return (
        <div class="menu-title">
          <div class="menu-title__icon">{renderMenuIcon(row)}</div>
          <span class="menu-title__text">{$t(row.meta?.title ?? '')}</span>
          {(() => {
            if (row.meta?.badgeType) {
              return (
                <MenuBadge
                  badge={row.meta.badge ?? ''}
                  badgeType={row.meta.badgeType}
                  badgeVariants={row.meta.badgeVariants}
                  class="menu-badge"
                />
              );
            }
            return null;
          })()}
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
                  <Tag
                    color={(() => {
                      if (row.status === 1) {
                        return 'success';
                      }
                      return 'default';
                    })()}
                  >
                    {(() => {
                      if (row.status === 1) {
                        return $t('common.enabled');
                      }
                      return $t('common.disabled');
                    })()}
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
