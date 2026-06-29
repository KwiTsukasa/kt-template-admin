import type { RouteRecordStringComponent } from '@vben/types';

import { requestClient } from '#/api/request';

const SUPPORTED_ADMIN_MENU_NAMES = new Set([
  'Analytics',
  'Blog',
  'BlogArticle',
  'BlogArticleCreate',
  'BlogArticleDelete',
  'BlogArticleEdit',
  'BlogArticleImport',
  'BlogCategory',
  'BlogCategoryCreate',
  'BlogCategoryDelete',
  'BlogCategoryEdit',
  'BlogTag',
  'BlogTagCreate',
  'BlogTagDelete',
  'BlogTagEdit',
  'BlogTheme',
  'BlogThemeImport',
  'BlogThemeSave',
  'Dashboard',
  'Profile',
  'QqBot',
  'QqBotAccount',
  'QqBotAccountConfig',
  'QqBotAccountConfigButton',
  'QqBotAccountCreate',
  'QqBotAccountDelete',
  'QqBotAccountEdit',
  'QqBotAccountKick',
  'QqBotAccountNapcatWebui',
  'QqBotAccountRefreshLogin',
  'QqBotAccountWebUI',
  'QqBotCommand',
  'QqBotCommandCreate',
  'QqBotCommandDelete',
  'QqBotCommandEdit',
  'QqBotCommandTest',
  'QqBotCommandToggle',
  'QqBotConversation',
  'QqBotDashboard',
  'QqBotMessage',
  'QqBotPermission',
  'QqBotPermissionCreate',
  'QqBotPermissionDelete',
  'QqBotPermissionEdit',
  'QqBotPlugin',
  'QqBotPluginTask',
  'QqBotPluginTaskDisable',
  'QqBotPluginTaskEnable',
  'QqBotPluginTaskRun',
  'QqBotPluginTaskRunLog',
  'QqBotPluginTaskUpdateCron',
  'QqBotRule',
  'QqBotRuleCreate',
  'QqBotRuleDelete',
  'QqBotRuleEdit',
  'QqBotRuleToggle',
  'QqBotSendGroup',
  'QqBotSendLog',
  'QqBotSendPrivate',
  'System',
  'SystemDept',
  'SystemDeptCreate',
  'SystemDeptDelete',
  'SystemDeptEdit',
  'SystemDict',
  'SystemDictCreate',
  'SystemDictDelete',
  'SystemDictEdit',
  'SystemKtTableDemo',
  'SystemKtTableDemoCreate',
  'SystemKtTableDemoDelete',
  'SystemKtTableDemoEdit',
  'SystemLog',
  'SystemMenu',
  'SystemMenuCreate',
  'SystemMenuDelete',
  'SystemMenuEdit',
  'SystemNotice',
  'SystemNoticeDelete',
  'SystemNoticeEdit',
  'SystemRole',
  'SystemRoleCreate',
  'SystemRoleDelete',
  'SystemRoleEdit',
  'SystemUser',
  'SystemUserCreate',
  'SystemUserDelete',
  'SystemUserEdit',
]);

export function isSupportedAdminMenuName(name?: null | string | symbol) {
  return typeof name === 'string' && SUPPORTED_ADMIN_MENU_NAMES.has(name);
}

/**
 * 将后端数据库排序字段对齐到 Vben 菜单生成器实际读取的 `meta.order`。
 * @param menu - `/menu/all` 返回的后端菜单节点；节点可能同时带有历史路由 `meta.order` 和 DB `sort`。
 * @returns 克隆后的菜单节点；当后端提供有限数字 `sort` 时以 DB 排序为准，否则保留原节点。
 */
function normalizeBackendMenuOrder(
  menu: RouteRecordStringComponent,
): RouteRecordStringComponent {
  const sortOrder =
    typeof menu.sort === 'number' && Number.isFinite(menu.sort)
      ? menu.sort
      : undefined;

  if (sortOrder === undefined) {
    return menu;
  }

  const meta = menu.meta ?? { title: String(menu.name ?? '') };

  return {
    ...menu,
    meta: {
      ...meta,
      order: sortOrder,
    },
  };
}

/**
 * 过滤当前 Admin 已实现的后端菜单，并保留后端排序语义给路由菜单生成器使用。
 * @param menus - `/menu/all` 返回的后端菜单树；包含页面节点、隐藏路由节点和按钮权限节点。
 * @returns 仅含当前前端支持节点的菜单树，且每个节点的 DB `sort` 已映射为权威 `meta.order`。
 */
function filterSupportedAdminMenus(
  menus: RouteRecordStringComponent[],
): RouteRecordStringComponent[] {
  return menus
    .map((menu) => {
      const normalizedMenu = normalizeBackendMenuOrder(menu);
      const children = normalizedMenu.children
        ? filterSupportedAdminMenus(normalizedMenu.children)
        : undefined;
      const menuWithoutChildren = { ...normalizedMenu };
      delete menuWithoutChildren.children;

      return {
        ...menuWithoutChildren,
        ...(children && children.length > 0 ? { children } : {}),
      };
    })
    .filter(
      (menu) => isSupportedAdminMenuName(menu.name) || !!menu.children?.length,
    );
}

/**
 * 获取用户所有菜单
 */
export async function getAllMenusApi() {
  const menus =
    await requestClient.get<RouteRecordStringComponent[]>('/menu/all');

  // 只暴露当前前端页面和后端接口已经支撑的后台菜单。
  return filterSupportedAdminMenus(menus);
}
