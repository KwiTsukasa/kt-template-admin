import type { ComputedRef } from 'vue';
import type {
  RouteLocationNormalized,
  Router,
  RouteRecordNormalized,
} from 'vue-router';

import type { TabDefinition } from '@vben-core/typings';

import { toRaw } from 'vue';

import { preferences } from '@vben-core/preferences';
import {
  createStack,
  openRouteInNewWindow,
  Stack,
  startProgress,
  stopProgress,
} from '@vben-core/shared/utils';

import { acceptHMRUpdate, defineStore } from 'pinia';

interface TabbarState {
  cachedTabs: Set<string>;
  dragEndIndex: number;
  excludeCachedTabs: Set<string>;
  menuList: string[];
  renderRouteView?: boolean;
  tabs: TabDefinition[];
  updateTime?: number;
  visitHistory: Stack<string>;
}

const MAX_VISIT_HISTORY = 50;

export const useTabbarStore = defineStore('core-tabbar', {
  actions: {
    /**
     * 按标签键批量关闭可关闭页签，并保留固定页签与当前路由所需状态。
     *
     * @param keys - 要从标签栏批量关闭的页签键集合。
     */
    async _bulkCloseByKeys(keys: string[]) {
      const keySet = new Set(keys);
      this.tabs = this.tabs.filter(
        (item) => !keySet.has(getTabKeyFromTab(item)),
      );
      if (isVisitHistory()) {
        this.visitHistory.remove(...keys);
      }

      await this.updateCacheTabs();
    },
    /**
     * 从标签栏移除目标页签，并在关闭当前页时导航到相邻可用页签。
     *
     * @param tab - 要从标签栏移除的页签；固定页签不会被移除。
     */
    _close(tab: TabDefinition) {
      if (isAffixTab(tab)) {
        return;
      }
      const index = this.tabs.findIndex((item) => equalTab(item, tab));
      index !== -1 && this.tabs.splice(index, 1);
    },
    /**
     * 当没有可用相邻页签时导航到首页或首个固定页签。
     *
     * @param router - 在剩余页签之间执行替换导航的 Vue Router 实例。
     */
    async _goToDefaultTab(router: Router) {
      if (this.getTabs.length <= 0) {
        return;
      }
      const firstTab = this.getTabs[0];
      if (firstTab) {
        await this._goToTab(firstTab, router);
      }
    },
    /**
     * 根据目标页签解析路由位置并执行导航；缺少目标时回到默认页签。
     *
     * @param tab - 提供目标路径、查询参数与路由参数的页签记录。
     * @param router - 用目标页签位置替换当前地址的 Vue Router 实例。
     */
    async _goToTab(tab: TabDefinition, router: Router) {
      const { params, path, query } = tab;
      const toParams = {
        params: params || {},
        path,
        query: query || {},
      };
      await router.replace(toParams);
    },
    /**
     * 将路由页签规范化后加入标签栏；同键页签只更新现有记录。
     *
     * @param routeTab - 准备规范化并加入标签栏的路由页签。
     * @returns 加入或更新后的页签；隐藏页签只返回克隆而不写入 store。
     */
    addTab(routeTab: TabDefinition): TabDefinition {
      let tab = cloneTab(routeTab);
      if (!tab.key) {
        tab.key = getTabKey(routeTab);
      }
      if (!isTabShown(tab)) {
        return tab;
      }

      const tabIndex = this.tabs.findIndex((item) => {
        return equalTab(item, tab);
      });

      if (tabIndex === -1) {
        const maxCount = preferences.tabbar.maxCount;
        // 获取动态路由打开数，超过 0 即代表需要控制打开数
        const maxNumOfOpenTab = (routeTab?.meta?.maxNumOfOpenTab ??
          -1) as number;
        // 如果动态路由层级大于 0 了，那么就要限制该路由的打开数限制了
        // 获取到已经打开的动态路由数, 判断是否大于某一个值
        if (
          maxNumOfOpenTab > 0 &&
          this.tabs.filter((tab) => tab.name === routeTab.name).length >=
            maxNumOfOpenTab
        ) {
          // 关闭第一个
          const index = this.tabs.findIndex(
            (item) => item.name === routeTab.name,
          );
          index !== -1 && this.tabs.splice(index, 1);
        } else if (maxCount > 0 && this.tabs.length >= maxCount) {
          // 关闭第一个
          const index = this.tabs.findIndex(
            (item) =>
              !Reflect.has(item.meta, 'affixTab') || !item.meta.affixTab,
          );
          index !== -1 && this.tabs.splice(index, 1);
        }
        this.tabs.push(tab);
      } else {
        // 页面已经存在，不重复添加选项卡，只更新选项卡参数
        const currentTab = toRaw(this.tabs)[tabIndex];
        const mergedTab = {
          ...currentTab,
          ...tab,
          meta: { ...currentTab?.meta, ...tab.meta },
        };
        if (currentTab) {
          const curMeta = currentTab.meta;
          if (Reflect.has(curMeta, 'affixTab')) {
            mergedTab.meta.affixTab = curMeta.affixTab;
          }
          if (Reflect.has(curMeta, 'newTabTitle')) {
            mergedTab.meta.newTabTitle = curMeta.newTabTitle;
          }
        }
        tab = mergedTab;
        this.tabs.splice(tabIndex, 1, mergedTab);
      }
      this.updateCacheTabs();
      // 添加访问历史记录
      if (isVisitHistory()) {
        this.visitHistory.push(tab.key as string);
      }
      return tab;
    },
    /**
     * 在保留固定页签后关闭其余页签，并导航到仍有效的目标。
     *
     * @param router - 关闭后导航到首个保留页签的 Vue Router 实例。
     */
    async closeAllTabs(router: Router) {
      const newTabs = this.tabs.filter((tab) => isAffixTab(tab));
      if (newTabs.length > 0) {
        this.tabs = newTabs;
      } else {
        this.tabs = [...this.tabs].splice(0, 1);
      }
      // 设置访问历史记录
      if (isVisitHistory()) {
        this.visitHistory.retain(
          this.tabs.map((item) => getTabKeyFromTab(item)),
        );
      }
      await this._goToDefaultTab(router);
      this.updateCacheTabs();
    },
    /**
     * 关闭目标页签左侧全部可关闭页签；未传目标时以当前路由为基准。
     *
     * @param tab - 作为左侧关闭范围终点的页签记录。
     */
    async closeLeftTabs(tab: TabDefinition) {
      const index = this.tabs.findIndex((item) => equalTab(item, tab));

      if (index < 1) {
        return;
      }

      const leftTabs = this.tabs.slice(0, index);
      const keys: string[] = [];

      for (const item of leftTabs) {
        if (!isAffixTab(item)) {
          keys.push(item.key as string);
        }
      }
      await this._bulkCloseByKeys(keys);
    },
    /**
     * 仅保留目标页签与固定页签，关闭其余可关闭页签。
     *
     * @param tab - 要保留的页签记录；固定页签也始终保留。
     */
    async closeOtherTabs(tab: TabDefinition) {
      const closeKeys = this.tabs.map((item) => getTabKeyFromTab(item));

      const keys: string[] = [];

      for (const key of closeKeys) {
        if (key !== getTabKeyFromTab(tab)) {
          const closeTab = this.tabs.find(
            (item) => getTabKeyFromTab(item) === key,
          );
          if (!closeTab) {
            continue;
          }
          if (!isAffixTab(closeTab)) {
            keys.push(closeTab.key as string);
          }
        }
      }
      await this._bulkCloseByKeys(keys);
    },
    /**
     * 关闭目标页签右侧全部可关闭页签；未传目标时以当前路由为基准。
     *
     * @param tab - 作为右侧关闭范围起点的页签记录。
     */
    async closeRightTabs(tab: TabDefinition) {
      const index = this.tabs.findIndex((item) => equalTab(item, tab));

      if (index !== -1 && index < this.tabs.length - 1) {
        const rightTabs = this.tabs.slice(index + 1);

        const keys: string[] = [];
        for (const item of rightTabs) {
          if (!isAffixTab(item)) {
            keys.push(item.key as string);
          }
        }
        await this._bulkCloseByKeys(keys);
      }
    },

    /**
     * 从标签栏关闭指定页签，并在需要时同步路由到相邻页签。
     *
     * @param tab - 要关闭的页签记录；若为当前页签则还会选择后续导航目标。
     * @param router - 提供当前路由并执行关闭后导航的 Vue Router 实例。
     */
    async closeTab(tab: TabDefinition, router: Router) {
      const { currentRoute } = router;
      const currentTabKey = getTabKey(currentRoute.value);
      // 关闭不是激活选项卡
      if (currentTabKey !== getTabKeyFromTab(tab)) {
        this._close(tab);
        this.updateCacheTabs();
        // 移除访问历史记录
        if (isVisitHistory()) {
          this.visitHistory.remove(getTabKeyFromTab(tab));
        }
        return;
      }
      if (this.getTabs.length <= 1) {
        console.error('Failed to close the tab; only one tab remains open.');
        return;
      }
      // 从访问历史记录中移除当前关闭的tab
      if (isVisitHistory()) {
        this.visitHistory.remove(currentTabKey);
        this._close(tab);

        let previousTab: TabDefinition | undefined;
        let previousTabKey: string | undefined;
        while (true) {
          previousTabKey = this.visitHistory.pop();
          if (!previousTabKey) {
            break;
          }
          previousTab = this.getTabByKey(previousTabKey);
          if (previousTab) {
            break;
          }
        }
        await (() => {
          if (previousTab) {
            return this._goToTab(previousTab, router);
          }
          return this._goToDefaultTab(router);
        })();
        return;
      }
      // 未开启访问历史记录，直接跳转下一个或上一个tab
      const index = this.getTabs.findIndex(
        (item) => getTabKeyFromTab(item) === getTabKey(currentRoute.value),
      );

      const before = this.getTabs[index - 1];
      const after = this.getTabs[index + 1];

      // 下一个tab存在，跳转到下一个
      if (after) {
        this._close(tab);
        await this._goToTab(after, router);
        // 上一个tab存在，跳转到上一个
      } else if (before) {
        this._close(tab);
        await this._goToTab(before, router);
      }
    },

    /**
     * 根据稳定键查找并关闭目标页签；未找到时保持状态不变。
     *
     * @param key - 要查找或关闭的稳定页签键。
     * @param router - 找到目标页签后负责关闭与后续导航的 Vue Router 实例。
     */
    async closeTabByKey(key: string, router: Router) {
      const originKey = decodeURIComponent(key);
      const index = this.tabs.findIndex(
        (item) => getTabKeyFromTab(item) === originKey,
      );
      if (index === -1) {
        return;
      }

      const tab = this.tabs[index];
      if (tab) {
        await this.closeTab(tab, router);
      }
    },

    /**
     * 从标签栏按稳定键查找页签；未匹配时返回 undefined。
     *
     * @param key - 要查找或关闭的稳定页签键。
     * @returns 稳定键匹配的已打开页签；未找到时为 undefined。
     */
    getTabByKey(key: string) {
      return this.getTabs.find(
        (item) => getTabKeyFromTab(item) === key,
      ) as TabDefinition;
    },
    /**
     * 在新浏览器窗口打开指定或当前路由页签的地址。
     *
     * @param tab - 提供待打开完整路径或普通路径的页签记录。
     */
    async openTabInNewWindow(tab: TabDefinition) {
      openRouteInNewWindow(tab.fullPath || tab.path);
    },

    /**
     * 把目标标签标记为固定并写回标签 store，使其不再参与普通关闭操作。
     *
     * @param tab - 要标记为固定并移动到固定区的页签记录。
     */
    async pinTab(tab: TabDefinition) {
      const index = this.tabs.findIndex((item) => equalTab(item, tab));
      if (index === -1) {
        return;
      }
      const oldTab = this.tabs[index];
      tab.meta.affixTab = true;
      tab.meta.title = oldTab?.meta?.title as string;
      // this.addTab(tab);
      this.tabs.splice(index, 1, tab);
      // 过滤固定tabs，后面更改affixTabOrder的值的话可能会有问题，目前行464排序affixTabs没有设置值
      const affixTabs = this.tabs.filter((tab) => isAffixTab(tab));
      // 获得固定tabs的index
      const newIndex = affixTabs.findIndex((item) => equalTab(item, tab));
      // 交换位置重新排序
      await this.sortTabs(index, newIndex);
    },

    /**
     * 通过临时排除 keep-alive 缓存重新渲染当前路由页签。
     *
     * @param router - 提供当前路由名称并驱动页面重新渲染的 Vue Router 实例。
     * @returns 指定页签重新渲染完成后兑现的 Promise。
     */
    async refresh(router: Router | string) {
      // 如果是Router路由，那么就根据当前路由刷新
      // 如果是string字符串，为路由名称，则定向刷新指定标签页，不能是当前路由名称，否则不会刷新
      if (typeof router === 'string') {
        return await this.refreshByName(router);
      }

      const { currentRoute } = router;
      const { name } = currentRoute.value;

      this.excludeCachedTabs.add(name as string);
      this.renderRouteView = false;
      startProgress();

      await new Promise((resolve) => setTimeout(resolve, 200));

      this.excludeCachedTabs.delete(name as string);
      this.renderRouteView = true;
      stopProgress();
    },

    /**
     * 根据路由名称刷新指定标签页
     *
     * @param name - 需要刷新或更新标题的命名页签名称。
     */
    async refreshByName(name: string) {
      this.excludeCachedTabs.add(name);
      await new Promise((resolve) => setTimeout(resolve, 200));
      this.excludeCachedTabs.delete(name);
    },

    /**
     * 刷新标签更新时间并把当前路由页签标题恢复为路由元信息标题。
     *
     * @param tab - 要清除自定义标题的页签记录。
     */
    async resetTabTitle(tab: TabDefinition) {
      if (tab?.meta?.newTabTitle) {
        return;
      }
      const findTab = this.tabs.find((item) => equalTab(item, tab));
      if (findTab) {
        findTab.meta.newTabTitle = undefined;
        await this.updateCacheTabs();
      }
    },

    /**
     * 将路由生成的固定页签写入标签栏，并保持其不可关闭属性。
     *
     * @param tabs - 根据路由元信息生成、准备写入标签栏的固定页签集合。
     */
    setAffixTabs(tabs: RouteRecordNormalized[]) {
      for (const tab of tabs) {
        tab.meta.affixTab = true;
        this.addTab(routeToTab(tab));
      }
    },

    /**
     * 将调用方给出的操作标识及顺序写入页签右键菜单列表。
     *
     * @param list - 新的页签菜单操作标识及展示顺序。
     */
    setMenuList(list: string[]) {
      this.menuList = list;
    },

    /**
     * 为匹配页签设置自定义标题并刷新持久化缓存；找不到页签时保持现状。
     *
     * @param tab - 用于在标签栏中定位目标页签的路由记录。
     * @param title - 要保存到目标页签元信息中的文本或响应式计算值。
     */
    async setTabTitle(tab: TabDefinition, title: ComputedRef<string> | string) {
      const findTab = this.tabs.find((item) => equalTab(item, tab));

      if (findTab) {
        findTab.meta.newTabTitle = title;

        await this.updateCacheTabs();
      }
    },
    /**
     * 把标签 store 更新时间刷新为当前时间戳，触发依赖页签重新渲染。
     */
    setUpdateTime() {
      this.updateTime = Date.now();
    },
    /**
     * 把页签从源索引移动到目标索引，并递增拖拽结束标识以通知视图更新。
     *
     * @param oldIndex - 页签拖拽前的源零基索引。
     * @param newIndex - 页签拖拽后的目标零基索引。
     */
    async sortTabs(oldIndex: number, newIndex: number) {
      const currentTab = this.tabs[oldIndex];
      if (!currentTab) {
        return;
      }
      this.tabs.splice(oldIndex, 1);
      this.tabs.splice(newIndex, 0, currentTab);
      this.dragEndIndex = this.dragEndIndex + 1;
    },

    /**
     * 切换指定页签的固定状态；未传页签时操作当前路由页签。
     *
     * @param tab - 要在固定与普通状态之间切换的页签记录。
     */
    async toggleTabPin(tab: TabDefinition) {
      const affixTab = tab?.meta?.affixTab ?? false;

      await (() => {
        if (affixTab) {
          return this.unpinTab(tab);
        }
        return this.pinTab(tab);
      })();
    },

    /**
     * 取消目标标签的固定状态并写回标签 store，使其恢复普通关闭能力。
     *
     * @param tab - 要取消固定并移到普通页签区起始位置的页签记录。
     */
    async unpinTab(tab: TabDefinition) {
      const index = this.tabs.findIndex((item) => equalTab(item, tab));
      if (index === -1) {
        return;
      }
      const oldTab = this.tabs[index];
      tab.meta.affixTab = false;
      tab.meta.title = oldTab?.meta?.title as string;
      // this.addTab(tab);
      this.tabs.splice(index, 1, tab);
      // 过滤固定tabs，后面更改affixTabOrder的值的话可能会有问题，目前行464排序affixTabs没有设置值
      const affixTabs = this.tabs.filter((tab) => isAffixTab(tab));
      // 获得固定tabs的index,使用固定tabs的下一个位置也就是活动tabs的第一个位置
      const newIndex = affixTabs.length;
      // 交换位置重新排序
      await this.sortTabs(index, newIndex);
    },
    /**
     * 根据当前打开的选项卡更新缓存
     */
    async updateCacheTabs() {
      const cacheMap = new Set<string>();

      for (const tab of this.tabs) {
        // 跳过不需要持久化的标签页
        const keepAlive = tab.meta?.keepAlive;
        if (!keepAlive) {
          continue;
        }
        (tab.matched || []).forEach((t, i) => {
          if (i > 0) {
            cacheMap.add(t.name as string);
          }
        });

        const name = tab.name as string;
        cacheMap.add(name);
      }
      this.cachedTabs = cacheMap;
    },
  },
  getters: {
    /**
     * 根据路由元信息固定不可关闭的标签页，避免刷新后丢失常驻入口。
     *
     * @returns 按 `affixTabOrder` 升序排列的固定页签副本。
     */
    affixTabs(): TabDefinition[] {
      const affixTabs = this.tabs.filter((tab) => isAffixTab(tab));

      return affixTabs.toSorted((a, b) => {
        const orderA = (a.meta?.affixTabOrder ?? 0) as number;
        const orderB = (b.meta?.affixTabOrder ?? 0) as number;
        return orderA - orderB;
      });
    },
    /**
     * 返回缓存页签键集合的副本，避免调用方直接修改 store 内部 Set。
     *
     * @returns 缓存页签键数组；修改该数组不会影响 store 内部集合。
     */
    getCachedTabs(): string[] {
      return [...this.cachedTabs];
    },
    /**
     * 从页签状态中提取显式排除 keep-alive 缓存的标签名称集合。
     *
     * @returns 明确排除 keep-alive 缓存的页签名称数组。
     */
    getExcludeCachedTabs(): string[] {
      return [...this.excludeCachedTabs];
    },
    /**
     * 读取 store 当前生成的菜单数组，供布局渲染现有权限菜单。
     *
     * @returns store 当前保存的菜单列表。
     */
    getMenuList(): string[] {
      return this.menuList;
    },
    /**
     * 先排列固定页签再追加普通页签，并过滤无效记录后返回完整页签列表。
     *
     * @returns 固定页签优先、普通页签随后排列的有效页签列表。
     */
    getTabs(): TabDefinition[] {
      const normalTabs = this.tabs.filter((tab) => !isAffixTab(tab));
      return [...this.affixTabs, ...normalTabs].filter(Boolean);
    },
  },
  persist: [
    // tabs不需要保存在localStorage
    {
      pick: ['tabs', 'visitHistory'],
      storage: sessionStorage,
    },
  ],
  state: (): TabbarState => ({
    visitHistory: createStack<string>(true, MAX_VISIT_HISTORY),
    cachedTabs: new Set(),
    dragEndIndex: 0,
    excludeCachedTabs: new Set(),
    menuList: [
      'close',
      'affix',
      'maximize',
      'reload',
      'open-in-new-window',
      'close-left',
      'close-right',
      'close-other',
      'close-all',
    ],
    renderRouteView: true,
    tabs: [],
    updateTime: Date.now(),
  }),
});

// 解决热更新问题
const hot = import.meta.hot;
if (hot) {
  hot.accept(acceptHMRUpdate(useTabbarStore, hot));
}

/**
 * 把路由记录克隆为可持久化的页签对象，并移除不可序列化字段。
 *
 * @param route - 要转换成可缓存页签副本的路由记录。
 * @returns 移除不可序列化 matched 字段并浅克隆 meta 的页签对象。
 */
function cloneTab(route: TabDefinition): TabDefinition {
  if (!route) {
    return route;
  }
  const { matched, meta, ...opt } = route;
  return {
    ...opt,
    matched: (() => {
      if (matched) {
        return matched.map((item) => ({
          meta: item.meta,
          name: item.name,
          path: item.path,
        }));
      }
      return undefined;
    })() as RouteRecordNormalized[],
    meta: {
      ...meta,
      newTabTitle: meta.newTabTitle,
    },
  };
}

/**
 * 仅在页签元信息明确设置 affixTab 时判定为固定页签。
 *
 * @param tab - 要检查固定标记的页签记录。
 * @returns 页签标记为固定时为 true，缺少标记时为 false。
 */
function isAffixTab(tab: TabDefinition) {
  return tab?.meta?.affixTab ?? false;
}

/**
 * 仅当页签本身及全部匹配路由都未隐藏标签栏入口时允许展示。
 *
 * @param tab - 要检查标签栏可见性的页签及其匹配路由记录。
 * @returns 页签及其匹配路由均未设置 hideInTab 时为 true。
 */
function isTabShown(tab: TabDefinition) {
  const matched = tab?.matched ?? [];
  return !tab.meta.hideInTab && matched.every((item) => !item.meta.hideInTab);
}

/**
 * 根据路由名称、路径与参数生成稳定页签键。
 *
 * @param tab - 提供 pageKey、完整路径与普通路径的路由记录。
 * @returns 由 pageKey、fullPath 或 path 规范化得到的稳定页签键。
 */
function getTabKey(tab: RouteLocationNormalized | RouteRecordNormalized) {
  const {
    fullPath,
    path,
    meta: { fullPathKey } = {},
    query = {},
  } = tab as RouteLocationNormalized;
  // pageKey可能是数组（查询参数重复时可能出现）
  const pageKey = (() => {
    if (Array.isArray(query.pageKey)) {
      return query.pageKey[0];
    }
    return query.pageKey;
  })();
  let rawKey;
  if (pageKey) {
    rawKey = pageKey;
  } else {
    if (fullPathKey === false) {
      rawKey = path;
    } else {
      rawKey = fullPath ?? path;
    }
  }
  try {
    return decodeURIComponent(rawKey);
  } catch {
    return rawKey;
  }
}

/**
 * 根据标签栏偏好设置判断是否需要记录页签访问历史。
 *
 * @returns 偏好设置启用页签访问历史时为 true。
 */
function isVisitHistory() {
  return preferences.tabbar.visitHistory;
}

/**
 * 优先读取页签已有键；缺失时根据路由路径与参数生成稳定键。
 *
 * @param tab - 需要取得稳定键的页签记录。
 * @returns 页签已有 key，缺失时根据路由字段生成的稳定键。
 */
function getTabKeyFromTab(tab: TabDefinition): string {
  return tab.key ?? getTabKey(tab);
}

/**
 * 通过稳定页签键判断两个页签是否指向同一页面实例。
 *
 * @param a - 页签比较左值。
 * @param b - 页签比较右值。
 * @returns 两个页签稳定键相同时为 true。
 */
function equalTab(a: TabDefinition, b: TabDefinition) {
  return getTabKeyFromTab(a) === getTabKeyFromTab(b);
}

/**
 * 把路由标准化为标签页记录，并复用已有同地址标签。
 *
 * @param route - 需要提取 meta、name、path 和稳定键的规范化路由记录。
 * @returns 与路由对应且可写入标签 store 的标签页记录。
 */
function routeToTab(route: RouteRecordNormalized) {
  return {
    meta: route.meta,
    name: route.name,
    path: route.path,
    key: getTabKey(route),
  } as TabDefinition;
}

export { getTabKey };
