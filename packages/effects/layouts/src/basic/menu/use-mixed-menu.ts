import type { MenuRecordRaw } from '@vben/types';

import { computed, onBeforeMount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { preferences, usePreferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';
import { findRootMenuByPath } from '@vben/utils';

import { useNavigation } from './use-navigation';

/**
 * 在混合导航模式下同步头部根菜单与侧栏子菜单，并在路由变化时修正激活项。
 *
 * @returns 混合导航的头部菜单、侧栏菜单、激活项及同步方法。
 */
function useMixedMenu() {
  const { navigation, willOpenedByWindow } = useNavigation();
  const accessStore = useAccessStore();
  const route = useRoute();
  const splitSideMenus = ref<MenuRecordRaw[]>([]);
  const rootMenuPath = ref<string>('');
  const mixedRootMenuPath = ref<string>('');
  const mixExtraMenus = ref<MenuRecordRaw[]>([]);
  const defaultSubMap = new Map<string, string>();
  const { isMixedNav, isHeaderMixedNav } = usePreferences();

  const needSplit = computed(
    () =>
      (preferences.navigation.split && isMixedNav.value) ||
      isHeaderMixedNav.value,
  );

  const sidebarVisible = computed(() => {
    const enableSidebar = preferences.sidebar.enable;
    if (needSplit.value) {
      return enableSidebar && splitSideMenus.value.length > 0;
    }
    return enableSidebar;
  });
  const menus = computed(() => accessStore.accessMenus);

  const headerMenus = computed(() => {
    if (!needSplit.value) {
      return menus.value;
    }
    return menus.value.map((item) => {
      return {
        ...item,
        children: [],
      };
    });
  });

  const sidebarMenus = computed(() => {
    if (needSplit.value) {
      return splitSideMenus.value;
    }
    return menus.value;
  });

  const mixHeaderMenus = computed(() => {
    if (isHeaderMixedNav.value) {
      return sidebarMenus.value;
    }
    return headerMenus.value;
  });

  const sidebarActive = computed(() => {
    return (route?.meta?.activePath as string) ?? route.path;
  });

  const headerActive = computed(() => {
    if (!needSplit.value) {
      return route.meta?.activePath ?? route.path;
    }
    return rootMenuPath.value;
  });

  const handleMenuSelect = (key: string, mode?: string) => {
    if (!needSplit.value || mode === 'vertical') {
      navigation(key);
      return;
    }
    const rootMenu = menus.value.find((item) => item.path === key);
    const _splitSideMenus = rootMenu?.children ?? [];

    if (!willOpenedByWindow(key)) {
      rootMenuPath.value = rootMenu?.path ?? '';
      splitSideMenus.value = _splitSideMenus;
    }

    if (_splitSideMenus.length === 0) {
      navigation(key);
    } else if (rootMenu && preferences.sidebar.autoActivateChild) {
      navigation(
        (() => {
          if (defaultSubMap.has(rootMenu.path)) {
            return defaultSubMap.get(rootMenu.path) as string;
          }
          return rootMenu.path;
        })(),
      );
    }
  };

  const handleMenuOpen = (key: string, parentsPath: string[]) => {
    if (parentsPath.length <= 1 && preferences.sidebar.autoActivateChild) {
      navigation(
        (() => {
          if (defaultSubMap.has(key)) {
            return defaultSubMap.get(key) as string;
          }
          return key;
        })(),
      );
    }
  };

  /**
   * 根据当前路由路径与混合菜单层级计算侧边菜单。
   *
   * @param path - 用于定位混合菜单根节点与侧栏子树的路由路径；省略时使用当前路由。
   */
  function calcSideMenus(path: string = route.path) {
    let { rootMenu } = findRootMenuByPath(menus.value, path);
    if (!rootMenu) {
      rootMenu = menus.value.find((item) => item.path === path);
    }
    const result = findRootMenuByPath(rootMenu?.children || [], path, 1);
    mixedRootMenuPath.value = result.rootMenuPath ?? '';
    mixExtraMenus.value = result.rootMenu?.children ?? [];
    rootMenuPath.value = rootMenu?.path ?? '';
    splitSideMenus.value = rootMenu?.children ?? [];
  }

  watch(
    () => route.path,
    (path) => {
      const currentPath = route?.meta?.activePath ?? route?.meta?.link ?? path;
      if (willOpenedByWindow(currentPath)) {
        return;
      }
      calcSideMenus(currentPath);
      if (rootMenuPath.value)
        defaultSubMap.set(rootMenuPath.value, currentPath);
    },
    { immediate: true },
  );

  // 初始化计算侧边菜单
  onBeforeMount(() => {
    calcSideMenus(route.meta?.activePath || route.path);
  });

  return {
    handleMenuSelect,
    handleMenuOpen,
    headerActive,
    headerMenus,
    sidebarActive,
    sidebarMenus,
    mixHeaderMenus,
    mixExtraMenus,
    sidebarVisible,
  };
}

export { useMixedMenu };
