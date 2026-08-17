import type { SubMenuProvider } from '../types';

import { computed, getCurrentInstance } from 'vue';

import { findComponentUpward } from '../utils';

/**
 * 维护菜单展开、选中与活动路径，并把点击、展开和选择变化派发给父组件。
 *
 * @returns 菜单展开、选中、激活状态及对应事件处理方法。
 * @throws 函数在 Vue 组件实例之外调用时抛出。
 */
function useMenu() {
  const instance = getCurrentInstance();
  if (!instance) {
    throw new Error('instance is required');
  }

  const parentPaths = computed(() => {
    let parent = instance.parent;
    const paths: string[] = [instance.props.path as string];
    while (parent?.type.name !== 'Menu') {
      if (parent?.props.path) {
        paths.unshift(parent.props.path as string);
      }
      parent = parent?.parent ?? null;
    }

    return paths;
  });

  const parentMenu = computed(() => {
    return findComponentUpward(instance, ['Menu', 'SubMenu']);
  });

  return {
    parentMenu,
    parentPaths,
  };
}

/**
 * 根据菜单层级、模式和折叠状态计算缩进、图标及标签的 CSS 变量。
 *
 * @param menu - 可选父级子菜单上下文；缺省时菜单层级 CSS 变量为零。
 * @returns 菜单缩进、图标与标签使用的响应式样式变量。
 */
function useMenuStyle(menu?: SubMenuProvider) {
  const subMenuStyle = computed(() => {
    return {
      '--menu-level': (() => {
        if (menu) {
          return menu?.level ?? 0 + 1;
        }
        return 0;
      })(),
    };
  });
  return subMenuStyle;
}

export { useMenu, useMenuStyle };
