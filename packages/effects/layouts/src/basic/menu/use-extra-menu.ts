import type { ComputedRef } from 'vue';

import type { MenuRecordRaw } from '@vben/types';

import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { preferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';
import { findRootMenuByPath } from '@vben/utils';

import { useNavigation } from './use-navigation';

/**
 * 根据当前路由与根菜单计算额外侧栏菜单，并维护其显示、折叠与激活状态。
 *
 * @param useRootMenus - 是否直接使用根菜单而不按当前路由截取子树。
 * @returns 额外菜单列表、激活状态、折叠状态及控制方法。
 */
function useExtraMenu(useRootMenus?: ComputedRef<MenuRecordRaw[]>) {
  const accessStore = useAccessStore();
  const { navigation, willOpenedByWindow } = useNavigation();

  const menus = computed(() => useRootMenus?.value ?? accessStore.accessMenus);

  const defaultSubMap = new Map<string, string>();
  const extraRootMenus = ref<MenuRecordRaw[]>([]);
  const route = useRoute();
  const extraMenus = ref<MenuRecordRaw[]>([]);
  const sidebarExtraVisible = ref<boolean>(false);
  const extraActiveMenu = ref('');
  const parentLevel = computed(() => {
    if (preferences.app.layout === 'header-mixed-nav') {
      return 1;
    }
    return 0;
  });

  const handleMixedMenuSelect = async (menu: MenuRecordRaw) => {
    const _extraMenus = menu?.children ?? [];
    const hasChildren = _extraMenus.length > 0;

    if (!willOpenedByWindow(menu.path)) {
      extraMenus.value = _extraMenus ?? [];
      extraActiveMenu.value = menu.parents?.[parentLevel.value] ?? menu.path;
      sidebarExtraVisible.value = hasChildren;
    }

    if (!hasChildren) {
      await navigation(menu.path);
    } else if (preferences.sidebar.autoActivateChild) {
      await navigation(
        (() => {
          if (defaultSubMap.has(menu.path)) {
            return defaultSubMap.get(menu.path) as string;
          }
          return menu.path;
        })(),
      );
    }
  };

  const handleDefaultSelect = async (
    menu: MenuRecordRaw,
    rootMenu?: MenuRecordRaw,
  ) => {
    extraMenus.value = rootMenu?.children ?? extraRootMenus.value ?? [];
    extraActiveMenu.value = menu.parents?.[parentLevel.value] ?? menu.path;

    if (preferences.sidebar.expandOnHover) {
      sidebarExtraVisible.value = extraMenus.value.length > 0;
    }
  };

  const handleSideMouseLeave = () => {
    if (preferences.sidebar.expandOnHover) {
      return;
    }

    const { findMenu, rootMenu, rootMenuPath } = findRootMenuByPath(
      menus.value,
      route.path,
    );
    extraActiveMenu.value = rootMenuPath ?? findMenu?.path ?? '';
    extraMenus.value = rootMenu?.children ?? [];
  };

  const handleMenuMouseEnter = (menu: MenuRecordRaw) => {
    if (!preferences.sidebar.expandOnHover) {
      const { findMenu } = findRootMenuByPath(menus.value, menu.path);
      extraMenus.value = findMenu?.children ?? [];
      extraActiveMenu.value = menu.parents?.[parentLevel.value] ?? menu.path;
      sidebarExtraVisible.value = extraMenus.value.length > 0;
    }
  };

  /**
   * 根据当前路由和菜单模式计算侧栏需要展示的附加菜单集合。
   *
   * @param path - 用于定位根菜单、父路径与附加子菜单的当前路由路径。
   */
  function calcExtraMenus(path: string) {
    const currentPath = route.meta?.activePath || path;
    const { findMenu, rootMenu, rootMenuPath } = findRootMenuByPath(
      menus.value,
      currentPath,
      parentLevel.value,
    );
    extraRootMenus.value = rootMenu?.children ?? [];
    if (rootMenuPath) defaultSubMap.set(rootMenuPath, currentPath);
    extraActiveMenu.value = rootMenuPath ?? findMenu?.path ?? '';
    extraMenus.value = rootMenu?.children ?? [];
    if (preferences.sidebar.expandOnHover) {
      sidebarExtraVisible.value = extraMenus.value.length > 0;
    }
  }

  watch(
    () => [route.path, preferences.app.layout],
    ([path]) => {
      calcExtraMenus(path || '');
    },
    { immediate: true },
  );

  return {
    extraActiveMenu,
    extraMenus,
    handleDefaultSelect,
    handleMenuMouseEnter,
    handleMixedMenuSelect,
    handleSideMouseLeave,
    sidebarExtraVisible,
  };
}

export { useExtraMenu };
