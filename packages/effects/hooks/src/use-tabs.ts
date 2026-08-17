import type { ComputedRef } from 'vue';
import type { RouteLocationNormalized } from 'vue-router';

import { useRoute, useRouter } from 'vue-router';

import { useTabbarStore } from '@vben/stores';

/**
 * 封装标签 store 的刷新、关闭、固定、切换和批量操作，并默认使用当前路由。
 *
 * @returns 当前标签状态以及刷新、关闭、固定和切换等操作方法。
 */
export function useTabs() {
  const router = useRouter();
  const route = useRoute();
  const tabbarStore = useTabbarStore();

  /**
   * 关闭目标页签左侧全部可关闭页签；未传目标时以当前路由为基准。
   *
   * @param tab - 作为分界点的路由页签；省略时使用当前路由。
   */
  async function closeLeftTabs(tab?: RouteLocationNormalized) {
    await tabbarStore.closeLeftTabs(tab || route);
  }

  /**
   * 关闭全部可关闭页签，并让路由回到保留的有效页签。
   */
  async function closeAllTabs() {
    await tabbarStore.closeAllTabs(router);
  }

  /**
   * 关闭目标页签右侧全部可关闭页签；未传目标时以当前路由为基准。
   *
   * @param tab - 作为分界点的路由页签；省略时使用当前路由。
   */
  async function closeRightTabs(tab?: RouteLocationNormalized) {
    await tabbarStore.closeRightTabs(tab || route);
  }

  /**
   * 仅保留目标页签与固定页签，关闭其余可关闭页签。
   *
   * @param tab - 需要保留的路由页签；省略时保留当前路由。
   */
  async function closeOtherTabs(tab?: RouteLocationNormalized) {
    await tabbarStore.closeOtherTabs(tab || route);
  }

  /**
   * 关闭指定或当前路由页签，并导航到仍可用的相邻页签。
   *
   * @param tab - 需要关闭的路由页签；省略时关闭当前路由对应页签。
   */
  async function closeCurrentTab(tab?: RouteLocationNormalized) {
    await tabbarStore.closeTab(tab || route, router);
  }

  /**
   * 把目标标签标记为固定并写回标签 store，使其不再参与普通关闭操作。
   *
   * @param tab - 需要设为固定的路由页签；省略时使用当前路由。
   */
  async function pinTab(tab?: RouteLocationNormalized) {
    await tabbarStore.pinTab(tab || route);
  }

  /**
   * 取消目标标签的固定状态并写回标签 store，使其恢复普通关闭能力。
   *
   * @param tab - 需要取消固定的路由页签；省略时使用当前路由。
   */
  async function unpinTab(tab?: RouteLocationNormalized) {
    await tabbarStore.unpinTab(tab || route);
  }

  /**
   * 切换指定页签的固定状态；未传页签时操作当前路由页签。
   *
   * @param tab - 需要切换固定状态的路由页签；省略时使用当前路由。
   */
  async function toggleTabPin(tab?: RouteLocationNormalized) {
    await tabbarStore.toggleTabPin(tab || route);
  }

  /**
   * 刷新指定名称对应的标签页；未传名称时刷新当前路由页签。
   *
   * @param name - 要刷新的页签名称；为空时改用当前路由。
   */
  async function refreshTab(name?: string) {
    await tabbarStore.refresh(name || router);
  }

  /**
   * 在新浏览器窗口打开指定或当前路由页签的地址。
   *
   * @param tab - 需要在独立浏览器窗口打开的路由页签；省略时使用当前路由。
   */
  async function openTabInNewWindow(tab?: RouteLocationNormalized) {
    await tabbarStore.openTabInNewWindow(tab || route);
  }

  /**
   * 按稳定页签键关闭目标页签，并同步后续路由。
   *
   * @param key - 需要关闭的页签稳定键，关闭后由路由器选择可用页面。
   */
  async function closeTabByKey(key: string) {
    await tabbarStore.closeTabByKey(key, router);
  }

  /**
   * 更新时间戳并为当前路由页签写入自定义标题，同时刷新页签缓存。
   *
   * @param title - 要保存到当前路由页签元信息中的文本或响应式计算值。
   */
  async function setTabTitle(title: ComputedRef<string> | string) {
    tabbarStore.setUpdateTime();
    await tabbarStore.setTabTitle(route, title);
  }

  /**
   * 刷新标签更新时间并把当前路由页签标题恢复为路由元信息标题。
   */
  async function resetTabTitle() {
    tabbarStore.setUpdateTime();
    await tabbarStore.resetTabTitle(route);
  }

  /**
   * 根据页签固定状态、数量与当前位置计算各关闭操作的禁用状态。
   *
   * @param tab - 作为关闭能力计算基准的路由页签；省略时使用当前路由。
   * @returns 关闭当前、左侧、右侧、其他及全部页签的禁用状态。
   */
  function getTabDisableState(tab: RouteLocationNormalized = route) {
    const tabs = tabbarStore.getTabs;
    const affixTabs = tabbarStore.affixTabs;
    const index = tabs.findIndex((item) => item.path === tab.path);

    const disabled = tabs.length <= 1;

    const { meta } = tab;
    const affixTab = meta?.affixTab ?? false;
    const isCurrentTab = route.path === tab.path;

    // 当前处于最左侧或者减去固定标签页的数量等于0
    const disabledCloseLeft =
      index === 0 || index - affixTabs.length <= 0 || !isCurrentTab;

    const disabledCloseRight = !isCurrentTab || index === tabs.length - 1;

    const disabledCloseOther =
      disabled || !isCurrentTab || tabs.length - affixTabs.length <= 1;
    return {
      disabledCloseAll: disabled,
      disabledCloseCurrent: !!affixTab || disabled,
      disabledCloseLeft,
      disabledCloseOther,
      disabledCloseRight,
      disabledRefresh: !isCurrentTab,
    };
  }

  return {
    closeAllTabs,
    closeCurrentTab,
    closeLeftTabs,
    closeOtherTabs,
    closeRightTabs,
    closeTabByKey,
    getTabDisableState,
    openTabInNewWindow,
    pinTab,
    refreshTab,
    resetTabTitle,
    setTabTitle,
    toggleTabPin,
    unpinTab,
  };
}
