import type { RouteLocationRaw } from 'vue-router';

import { useRouter } from 'vue-router';

import { useTabs } from '@vben/hooks';
import { getTabKey, useTabbarStore } from '@vben/stores';

const originsByStore = new WeakMap<
  ReturnType<typeof useTabbarStore>,
  Map<string, unknown>
>();

/**
 * 返回进入二级页前的内部页面，并在导航成功后关闭原页签；深链缺少来源时使用所属模块入口。
 * @param fallback - 直接打开二级页时可返回的模块路由。
 * @returns 遵守离开守卫、返回来源并关闭当前页签的操作。
 */
export function usePageReturn(fallback: RouteLocationRaw) {
  const router = useRouter();
  const { closeCurrentTab } = useTabs();
  const tabs = useTabbarStore();
  let origins = originsByStore.get(tabs);
  if (!origins) {
    origins = new Map();
    originsByStore.set(tabs, origins);
    const trackedOrigins = origins;
    tabs.$subscribe(
      (_mutation, state) => {
        const openKeys = new Set(state.tabs.map((tab) => getTabKey(tab)));
        for (const key of trackedOrigins.keys()) {
          if (!openKeys.has(key)) trackedOrigins.delete(key);
        }
      },
      { detached: true, flush: 'sync' },
    );
  }
  const entryKey = getTabKey(router.currentRoute.value);
  if (!origins.has(entryKey))
    origins.set(entryKey, router.options.history.state.back);
  const enteredFrom = origins.get(entryKey);
  return async () => {
    const closingTab = { ...router.currentRoute.value };
    const candidates = [closingTab.query.returnTo, enteredFrom];
    let target = fallback;
    for (const candidate of candidates) {
      if (
        typeof candidate !== 'string' ||
        !candidate.startsWith('/') ||
        candidate.startsWith('//') ||
        candidate.includes('\\')
      )
        continue;
      const resolved = router.resolve(candidate);
      if (
        resolved.path === closingTab.path ||
        resolved.path.startsWith('/auth') ||
        resolved.matched.length === 0
      )
        continue;
      target = candidate;
      break;
    }
    const destination = router.resolve(target);
    const failure = await router.push(target);
    if (!failure && router.currentRoute.value.path === destination.path) {
      await closeCurrentTab(closingTab);
      origins.delete(entryKey);
    }
  };
}
