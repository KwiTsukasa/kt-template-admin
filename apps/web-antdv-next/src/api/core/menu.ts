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
  'BlogArticlePreview',
  'BlogArticlePreviewButton',
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
  'MediaGovernance',
  'MediaGovernanceAgentOperate',
  'MediaGovernanceAgentQueue',
  'MediaGovernanceAgentStart',
  'MediaGovernanceDownload',
  'MediaGovernanceEvidence',
  'MediaGovernanceOperatorDecision',
  'MediaGovernanceRun',
  'MediaGovernanceSourceUpload',
  'MediaGovernanceTaskCreate',
  'MediaGovernanceTaskList',
  'MediaGovernanceTasks',
  'Profile',
  'QqBot',
  'QqBotAccount',
  'QqBotAccountConfig',
  'QqBotAccountConfigButton',
  'QqBotAccountCreate',
  'QqBotAccountDelete',
  'QqBotAccountEdit',
  'QqBotAccountKick',
  'QqBotAccountMessagePushCreate',
  'QqBotAccountMessagePushDelete',
  'QqBotAccountMessagePushList',
  'QqBotAccountMessagePushToggle',
  'QqBotAccountMessagePushUpdate',
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
  'QqBotMessageSubscription',
  'QqBotMessageSubscriptionCreate',
  'QqBotMessageSubscriptionDelete',
  'QqBotMessageSubscriptionList',
  'QqBotMessageSubscriptionToggle',
  'QqBotMessageSubscriptionUpdate',
  'QqBotMessageTemplate',
  'QqBotMessageTemplateCreate',
  'QqBotMessageTemplateDelete',
  'QqBotMessageTemplateList',
  'QqBotMessageTemplatePreview',
  'QqBotMessageTemplateToggle',
  'QqBotMessageTemplateUpdate',
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
  'SystemLog',
  'SystemMenu',
  'SystemMenuCreate',
  'SystemMenuDelete',
  'SystemMenuEdit',
  'SystemNetwork',
  'SystemNetworkDdnsCreate',
  'SystemNetworkDdnsDelete',
  'SystemNetworkDdnsList',
  'SystemNetworkDdnsRetry',
  'SystemNetworkDdnsUpdate',
  'SystemNetworkPortForwardCreate',
  'SystemNetworkPortForwardDelete',
  'SystemNetworkPortForwardHistory',
  'SystemNetworkPortForwardKeeper',
  'SystemNetworkPortForwardList',
  'SystemNetworkPortForwardProbe',
  'SystemNetworkPortForwardRetry',
  'SystemNetworkPortForwardUpdate',
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

/**
 * 通过检查菜单组件名是否属于管理端允许动态加载的页面白名单。
 *
 * @param name - 要在菜单树中匹配或校验唯一性的菜单名称。
 * @returns 名称属于管理端动态页面白名单时返回 true；非字符串或未收录名称返回 false。
 */
export function isSupportedAdminMenuName(name?: null | string | symbol) {
  return typeof name === 'string' && SUPPORTED_ADMIN_MENU_NAMES.has(name);
}

/**
 * 将后端数据库排序字段对齐到 Vben 菜单生成器实际读取的 `meta.order`。
 *
 * @param menu - 需要把数据库 sort 字段映射到 meta.order 的后端菜单节点。
 * @returns 写入权威 meta.order 的菜单克隆；sort 无效时返回原节点。
 */
function normalizeBackendMenuOrder(
  menu: RouteRecordStringComponent,
): RouteRecordStringComponent {
  const sortOrder = (() => {
    if (typeof menu.sort === 'number' && Number.isFinite(menu.sort)) {
      return menu.sort;
    }
    return undefined;
  })();

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
 *
 * @param menus - 后端返回、尚未过滤页面支持范围的菜单树。
 * @returns 仅包含管理端已实现页面的菜单树，并保留后端排序。
 */
function filterSupportedAdminMenus(
  menus: RouteRecordStringComponent[],
): RouteRecordStringComponent[] {
  return menus
    .map((menu) => {
      const normalizedMenu = normalizeBackendMenuOrder(menu);
      const children = (() => {
        if (normalizedMenu.children) {
          return filterSupportedAdminMenus(normalizedMenu.children);
        }
        return undefined;
      })();
      const menuWithoutChildren = { ...normalizedMenu };
      delete menuWithoutChildren.children;

      return {
        ...menuWithoutChildren,
        ...(() => {
          if (children && children.length > 0) {
            return { children };
          }
          return {};
        })(),
      };
    })
    .filter(
      (menu) => isSupportedAdminMenuName(menu.name) || !!menu.children?.length,
    );
}

/**
 * 从后端读取当前用户菜单，并递归过滤管理端尚未实现的页面节点。
 *
 * @returns 过滤并规范化后的当前用户菜单树。
 */
export async function getAllMenusApi() {
  const menus =
    await requestClient.get<RouteRecordStringComponent[]>('/menu/all');

  // 只暴露当前前端页面和后端接口已经支撑的后台菜单。
  return filterSupportedAdminMenus(menus);
}
