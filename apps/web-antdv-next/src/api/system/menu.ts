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

function filterSupportedSystemMenus(
  menus: SystemMenuApi.SystemMenu[],
): SystemMenuApi.SystemMenu[] {
  return menus
    .map((menu) => {
      const children = menu.children
        ? filterSupportedSystemMenus(menu.children)
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
 * 获取菜单数据列表
 */
async function getMenuList() {
  const menus =
    await requestClient.get<Array<SystemMenuApi.SystemMenu>>(
      '/system/menu/list',
    );

  return filterSupportedSystemMenus(menus);
}

async function isMenuNameExists(
  name: string,
  id?: SystemMenuApi.SystemMenu['id'],
) {
  return requestClient.get<boolean>('/system/menu/name-exists', {
    params: { id, name },
  });
}

async function isMenuPathExists(
  path: string,
  id?: SystemMenuApi.SystemMenu['id'],
) {
  return requestClient.get<boolean>('/system/menu/path-exists', {
    params: { id, path },
  });
}

/**
 * 创建菜单
 * @param data 菜单数据
 */
async function createMenu(
  data: Omit<SystemMenuApi.SystemMenu, 'children' | 'id'>,
) {
  return requestClient.post('/system/menu', data);
}

/**
 * 更新菜单
 *
 * @param id 菜单 ID
 * @param data 菜单数据
 */
async function updateMenu(
  id: string,
  data: Omit<SystemMenuApi.SystemMenu, 'children' | 'id'>,
) {
  return requestClient.put(`/system/menu/${id}`, data);
}

/**
 * 删除菜单
 * @param id 菜单 ID
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
