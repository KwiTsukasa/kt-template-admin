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

function filterSupportedAdminMenus(
  menus: RouteRecordStringComponent[],
): RouteRecordStringComponent[] {
  return menus
    .map((menu) => {
      const children = menu.children
        ? filterSupportedAdminMenus(menu.children)
        : undefined;
      const menuWithoutChildren = { ...menu };
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
