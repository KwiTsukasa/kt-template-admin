import type { MenuProvider, SubMenuProvider } from '../types';

import { getCurrentInstance, inject, provide } from 'vue';

import { findComponentUpward } from '../utils';

const menuContextKey = Symbol('menuContext');

/**
 * 向当前 Vue 后代组件提供菜单状态与操作上下文。
 *
 * @param injectMenuData - 父级提供的菜单上下文数据。
 */
function createMenuContext(injectMenuData: MenuProvider) {
  provide(menuContextKey, injectMenuData);
}

/**
 * 按当前组件实例标识提供独立子菜单上下文，避免嵌套菜单相互覆盖。
 *
 * @param injectSubMenuData - 父级提供的子菜单上下文数据。
 */
function createSubMenuContext(injectSubMenuData: SubMenuProvider) {
  const instance = getCurrentInstance();

  provide(`subMenu:${instance?.uid}`, injectSubMenuData);
}

/**
 * 读取父级菜单上下文；组件树未提供上下文时立即抛出。
 *
 * @returns 父级提供的菜单上下文数据。
 * @throws 函数在 Vue 组件实例之外调用时抛出。
 */
function useMenuContext() {
  const instance = getCurrentInstance();
  if (!instance) {
    throw new Error('instance is required');
  }
  const rootMenu = inject(menuContextKey) as MenuProvider;
  return rootMenu;
}

/**
 * 按当前组件实例读取独立子菜单上下文；组件外调用或未提供时抛出。
 *
 * @returns 当前组件实例对应的子菜单上下文数据。
 * @throws 函数在 Vue 组件实例之外调用时抛出。
 */
function useSubMenuContext() {
  const instance = getCurrentInstance();
  if (!instance) {
    throw new Error('instance is required');
  }
  const parentMenu = findComponentUpward(instance, ['Menu', 'SubMenu']);
  const subMenu = inject(`subMenu:${parentMenu?.uid}`) as SubMenuProvider;
  return subMenu;
}

export {
  createMenuContext,
  createSubMenuContext,
  useMenuContext,
  useSubMenuContext,
};
