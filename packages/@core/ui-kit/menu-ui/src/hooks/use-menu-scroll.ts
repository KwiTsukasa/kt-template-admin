import type { Ref } from 'vue';

import { watch } from 'vue';

import { useDebounceFn } from '@vueuse/core';

interface UseMenuScrollOptions {
  delay?: number;
  enable?: boolean | Ref<boolean>;
}

/**
 * 根据活动菜单路径定位 DOM 节点并控制菜单容器滚动，支持居中或最近边界对齐。
 *
 * @param activePath - 当前活动菜单路径的响应式引用；变化后触发防抖滚动。
 * @param options - 控制活动菜单滚动是否启用及防抖延迟；默认启用且延迟 320 毫秒；未传入时使用 `{}`。
 * @returns 菜单滚动容器引用以及滚动到活动项的方法。
 */
export function useMenuScroll(
  activePath: Ref<string | undefined>,
  options: UseMenuScrollOptions = {},
) {
  const { enable = true, delay = 320 } = options;

  /**
   * 定位当前活动菜单项，并让对应元素滚动到菜单可视区域。
   */
  function scrollToActiveItem() {
    const isEnabled = (() => {
      if (typeof enable === 'boolean') {
        return enable;
      }
      return enable.value;
    })();
    if (!isEnabled) return;

    const activeElement = document.querySelector(
      `aside li[role=menuitem].is-active`,
    );
    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }
  }

  const debouncedScroll = useDebounceFn(scrollToActiveItem, delay);

  watch(activePath, () => {
    const isEnabled = (() => {
      if (typeof enable === 'boolean') {
        return enable;
      }
      return enable.value;
    })();
    if (!isEnabled) return;

    debouncedScroll();
  });

  return {
    scrollToActiveItem,
  };
}
