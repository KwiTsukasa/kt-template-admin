import type { RouteLocationNormalizedGeneric } from 'vue-router';

import type { TabDefinition } from '@vben/types';

import type { IContextMenuItem } from '@vben-core/tabs-ui';

import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useContentMaximize, useTabs } from '@vben/hooks';
import {
  ArrowLeftToLine,
  ArrowRightLeft,
  ArrowRightToLine,
  ExternalLink,
  FoldHorizontal,
  Fullscreen,
  Minimize2,
  Pin,
  PinOff,
  RotateCw,
  X,
} from '@vben/icons';
import { $t, useI18n } from '@vben/locales';
import { getTabKey, useAccessStore, useTabbarStore } from '@vben/stores';
import { filterTree } from '@vben/utils';

/**
 * 组合页签列表、激活路由、拖拽排序和滚动控制，并把关闭与刷新操作接入标签 store。
 *
 * @returns 页签列表、激活状态、拖拽滚动状态及操作处理器。
 */
export function useTabbar() {
  const router = useRouter();
  const route = useRoute();
  const accessStore = useAccessStore();
  const tabbarStore = useTabbarStore();
  const { contentIsMaximize, toggleMaximize } = useContentMaximize();
  const {
    closeAllTabs,
    closeCurrentTab,
    closeLeftTabs,
    closeOtherTabs,
    closeRightTabs,
    closeTabByKey,
    getTabDisableState,
    openTabInNewWindow,
    refreshTab,
    toggleTabPin,
  } = useTabs();

  const currentActive = computed(() => {
    return getTabKey(route);
  });

  const { locale } = useI18n();
  const currentTabs = ref<RouteLocationNormalizedGeneric[]>();
  watch(
    [
      () => tabbarStore.getTabs,
      () => tabbarStore.updateTime,
      () => locale.value,
    ],
    ([tabs]) => {
      currentTabs.value = tabs.map((item) => wrapperTabLocale(item));
    },
  );

  const initAffixTabs = () => {
    const affixTabs = filterTree(router.getRoutes(), (route) => {
      return !!route.meta?.affixTab;
    });
    tabbarStore.setAffixTabs(affixTabs);
  };

  // 点击tab,跳转路由
  const handleClick = (key: string) => {
    const { fullPath, path } = tabbarStore.getTabByKey(key);
    router.push(fullPath || path);
  };

  // 关闭tab
  const handleClose = async (key: string) => {
    await closeTabByKey(key);
  };

  /**
   * 通过解析标签页标题的国际化键与参数，缺少翻译时回退到原始标题。
   *
   * @param tab - 需要把 meta.title 国际化、同时保留其他路由字段的页签记录。
   * @returns 解析国际化后的标签标题；缺少映射时为原始标题。
   */
  function wrapperTabLocale(tab: RouteLocationNormalizedGeneric) {
    return {
      ...tab,
      meta: {
        ...tab?.meta,
        title: $t(tab?.meta?.title as string),
      },
    };
  }

  watch(
    () => accessStore.accessMenus,
    () => {
      initAffixTabs();
    },
    { immediate: true },
  );

  watch(
    () => route.fullPath,
    () => {
      const meta = route.matched?.[route.matched.length - 1]?.meta;
      tabbarStore.addTab({
        ...route,
        meta: meta || route.meta,
      });
    },
    { immediate: true },
  );

  const createContextMenus = (tab: TabDefinition) => {
    const {
      disabledCloseAll,
      disabledCloseCurrent,
      disabledCloseLeft,
      disabledCloseOther,
      disabledCloseRight,
      disabledRefresh,
    } = getTabDisableState(tab);

    const affixTab = tab?.meta?.affixTab ?? false;

    const menus: IContextMenuItem[] = [
      {
        disabled: disabledCloseCurrent,
        handler: async () => {
          await closeCurrentTab(tab);
        },
        icon: X,
        key: 'close',
        text: $t('preferences.tabbar.contextMenu.close'),
      },
      {
        handler: async () => {
          await toggleTabPin(tab);
        },
        icon: (() => {
          if (affixTab) {
            return PinOff;
          }
          return Pin;
        })(),
        key: 'affix',
        text: (() => {
          if (affixTab) {
            return $t('preferences.tabbar.contextMenu.unpin');
          }
          return $t('preferences.tabbar.contextMenu.pin');
        })(),
      },
      {
        handler: async () => {
          if (!contentIsMaximize.value) {
            await router.push(tab.fullPath);
          }
          toggleMaximize();
        },
        icon: (() => {
          if (contentIsMaximize.value) {
            return Minimize2;
          }
          return Fullscreen;
        })(),
        key: (() => {
          if (contentIsMaximize.value) {
            return 'restore-maximize';
          }
          return 'maximize';
        })(),
        text: (() => {
          if (contentIsMaximize.value) {
            return $t('preferences.tabbar.contextMenu.restoreMaximize');
          }
          return $t('preferences.tabbar.contextMenu.maximize');
        })(),
      },
      {
        disabled: disabledRefresh,
        handler: () => refreshTab(),
        icon: RotateCw,
        key: 'reload',
        text: $t('preferences.tabbar.contextMenu.reload'),
      },
      {
        handler: async () => {
          await openTabInNewWindow(tab);
        },
        icon: ExternalLink,
        key: 'open-in-new-window',
        separator: true,
        text: $t('preferences.tabbar.contextMenu.openInNewWindow'),
      },

      {
        disabled: disabledCloseLeft,
        handler: async () => {
          await closeLeftTabs(tab);
        },
        icon: ArrowLeftToLine,
        key: 'close-left',
        text: $t('preferences.tabbar.contextMenu.closeLeft'),
      },
      {
        disabled: disabledCloseRight,
        handler: async () => {
          await closeRightTabs(tab);
        },
        icon: ArrowRightToLine,
        key: 'close-right',
        separator: true,
        text: $t('preferences.tabbar.contextMenu.closeRight'),
      },
      {
        disabled: disabledCloseOther,
        handler: async () => {
          await closeOtherTabs(tab);
        },
        icon: FoldHorizontal,
        key: 'close-other',
        text: $t('preferences.tabbar.contextMenu.closeOther'),
      },
      {
        disabled: disabledCloseAll,
        handler: closeAllTabs,
        icon: ArrowRightLeft,
        key: 'close-all',
        text: $t('preferences.tabbar.contextMenu.closeAll'),
      },
    ];

    return menus.filter((item) => tabbarStore.getMenuList.includes(item.key));
  };

  return {
    createContextMenus,
    currentActive,
    currentTabs,
    handleClick,
    handleClose,
  };
}
