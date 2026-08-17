import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

import { isSupportedAdminMenuName } from '../core/menu';

export namespace SystemMenuApi {
  export const BadgeVariants = [
    'default',
    'destructive',
    'primary',
    'success',
    'warning',
  ] as const;
  export const BadgeTypes = ['dot', 'normal'] as const;
  export const MenuTypes = [
    'catalog',
    'menu',
    'embedded',
    'link',
    'button',
  ] as const;
  export interface SystemMenu {
    [key: string]: any;
    authCode: string;
    children?: SystemMenu[];
    component?: string;
    id: string;
    meta?: {
      activeIcon?: string;
      activePath?: string;
      affixTab?: boolean;
      affixTabOrder?: number;
      badge?: string;
      badgeType?: (typeof BadgeTypes)[number];
      badgeVariants?: (typeof BadgeVariants)[number];
      hideChildrenInMenu?: boolean;
      hideInBreadcrumb?: boolean;
      hideInMenu?: boolean;
      hideInTab?: boolean;
      icon?: string;
      iframeSrc?: string;
      keepAlive?: boolean;
      link?: string;
      maxNumOfOpenTab?: number;
      noBasicLayout?: boolean;
      openInNewWindow?: boolean;
      order?: number;
      query?: Recordable<any>;
      title?: string;
    };
    name: string;
    path: string;
    pid: string;
    redirect?: string;
    sort?: number;
    type: (typeof MenuTypes)[number];
  }
}

/**
 * 递归移除管理端不支持的菜单节点，并保留仍含有效子项的目录。
 *
 * @param menus - 后端返回、需要递归移除未实现页面的系统菜单树。
 * @returns 仅包含管理端支持节点的菜单树。
 */
function filterSupportedSystemMenus(
  menus: SystemMenuApi.SystemMenu[],
): SystemMenuApi.SystemMenu[] {
  return menus
    .map((menu) => {
      const children = (() => {
        if (menu.children) {
          return filterSupportedSystemMenus(menu.children);
        }
        return undefined;
      })();
      const menuWithoutChildren = { ...menu };
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
 * 从后端读取菜单树，并过滤管理端未支持的路由节点。
 *
 * @returns 仅包含管理端支持节点的系统菜单树。
 */
async function getMenuList() {
  const menus =
    await requestClient.get<Array<SystemMenuApi.SystemMenu>>(
      '/system/menu/list',
    );

  return filterSupportedSystemMenus(menus);
}

/**
 * 请求后端检查菜单名称是否已被占用，编辑时排除当前菜单标识。
 *
 * @param name - 要在菜单树中匹配或校验唯一性的菜单名称。
 * @param id - 编辑时要从重名检查中排除的当前菜单标识；新建时省略。
 * @returns 后端存在同名菜单时返回 true；编辑场景会排除传入的当前菜单标识。
 */
async function isMenuNameExists(
  name: string,
  id?: SystemMenuApi.SystemMenu['id'],
) {
  return requestClient.get<boolean>('/system/menu/name-exists', {
    params: { id, name },
  });
}

/**
 * 请求后端检查路由路径是否已被占用，编辑时排除当前菜单标识。
 *
 * @param path - 要向后端检查唯一性的菜单路由路径。
 * @param id - 编辑时要从路径冲突检查中排除的当前菜单标识；新建时省略。
 * @returns 后端存在同路径菜单时返回 true；编辑场景会排除传入的当前菜单标识。
 */
async function isMenuPathExists(
  path: string,
  id?: SystemMenuApi.SystemMenu['id'],
) {
  return requestClient.get<boolean>('/system/menu/path-exists', {
    params: { id, path },
  });
}

/**
 * 将路由、组件、权限和排序字段保存为新菜单。
 *
 * @param data - 菜单名称、路由、组件、权限和排序字段。
 * @returns 菜单创建请求的服务端响应。
 */
async function createMenu(
  data: Omit<SystemMenuApi.SystemMenu, 'children' | 'id'>,
) {
  return requestClient.post('/system/menu', data);
}

/**
 * 根据菜单标识保存路由、组件、权限和排序变更。
 *
 * @param id - 目标菜单的唯一标识。
 * @param data - 菜单名称、路由、组件、权限和排序字段。
 * @returns 菜单更新请求的服务端响应。
 */
async function updateMenu(
  id: string,
  data: Omit<SystemMenuApi.SystemMenu, 'children' | 'id'>,
) {
  return requestClient.put(`/system/menu/${id}`, data);
}

/**
 * 根据菜单标识删除对应菜单节点。
 *
 * @param id - 目标菜单的唯一标识。
 * @returns 菜单删除请求的服务端响应。
 */
async function deleteMenu(id: string) {
  return requestClient.delete(`/system/menu/${id}`);
}

export {
  createMenu,
  deleteMenu,
  getMenuList,
  isMenuNameExists,
  isMenuPathExists,
  updateMenu,
};
