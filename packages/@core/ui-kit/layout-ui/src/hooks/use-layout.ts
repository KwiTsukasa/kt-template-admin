import type { LayoutType } from '@vben-core/typings';

import type { VbenLayoutProps } from '../vben-layout';

import { computed } from 'vue';

/**
 * 提供布局内容、头部、侧栏和移动端抽屉元素引用，并向后代注入布局上下文。
 *
 * @param props - 包含布局类型和移动端标志的页面布局属性。
 * @returns 布局各区域元素引用、移动端抽屉状态及更新方法。
 */
export function useLayout(props: VbenLayoutProps) {
  const currentLayout = computed(() => {
    if (props.isMobile) {
      return 'sidebar-nav';
    }
    return props.layout as LayoutType;
  });

  const isFullContent = computed(() => currentLayout.value === 'full-content');

  const isSidebarMixedNav = computed(
    () => currentLayout.value === 'sidebar-mixed-nav',
  );

  const isHeaderNav = computed(() => currentLayout.value === 'header-nav');

  const isMixedNav = computed(
    () =>
      currentLayout.value === 'mixed-nav' ||
      currentLayout.value === 'header-sidebar-nav',
  );

  const isHeaderMixedNav = computed(
    () => currentLayout.value === 'header-mixed-nav',
  );

  return {
    currentLayout,
    isFullContent,
    isHeaderMixedNav,
    isHeaderNav,
    isMixedNav,
    isSidebarMixedNav,
  };
}
