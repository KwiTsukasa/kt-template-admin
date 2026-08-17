import type { CSSProperties } from 'vue';

import type { VisibleDomRect } from '@vben-core/shared/utils';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import {
  CSS_VARIABLE_LAYOUT_CONTENT_HEIGHT,
  CSS_VARIABLE_LAYOUT_CONTENT_WIDTH,
  CSS_VARIABLE_LAYOUT_FOOTER_HEIGHT,
  CSS_VARIABLE_LAYOUT_HEADER_HEIGHT,
} from '@vben-core/shared/constants';
import { getElementVisibleRect } from '@vben-core/shared/utils';

import { useCssVar, useDebounceFn } from '@vueuse/core';

/**
 * 观测布局内容可见区域并同步宽高 CSS 变量，同时提供覆盖层定位样式；卸载时断开观察器。
 *
 * @returns 包含内容元素引用、可见矩形和覆盖层样式的响应式布局数据。
 */
export function useLayoutContentStyle() {
  let resizeObserver: null | ResizeObserver = null;
  const contentElement = ref<HTMLDivElement | null>(null);
  const visibleDomRect = ref<null | VisibleDomRect>(null);
  const contentHeight = useCssVar(CSS_VARIABLE_LAYOUT_CONTENT_HEIGHT);
  const contentWidth = useCssVar(CSS_VARIABLE_LAYOUT_CONTENT_WIDTH);

  const overlayStyle = computed((): CSSProperties => {
    const { height, left, top, width } = visibleDomRect.value ?? {};
    return {
      height: `${height}px`,
      left: `${left}px`,
      position: 'fixed',
      top: `${top}px`,
      width: `${width}px`,
      zIndex: 150,
    };
  });

  const debouncedCalcHeight = useDebounceFn(
    (_entries: ResizeObserverEntry[]) => {
      visibleDomRect.value = getElementVisibleRect(contentElement.value);
      contentHeight.value = `${visibleDomRect.value.height}px`;
      contentWidth.value = `${visibleDomRect.value.width}px`;
    },
    16,
  );

  onMounted(() => {
    if (contentElement.value && !resizeObserver) {
      resizeObserver = new ResizeObserver(debouncedCalcHeight);
      resizeObserver.observe(contentElement.value);
    }
  });

  onUnmounted(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
  });

  return { contentElement, overlayStyle, visibleDomRect };
}

/**
 * 通过共享 CSS 变量读取或更新布局头部高度，数值写入时统一转换为像素。
 *
 * @returns 读取与设置布局头部像素高度的方法。
 */
export function useLayoutHeaderStyle() {
  const headerHeight = useCssVar(CSS_VARIABLE_LAYOUT_HEADER_HEIGHT);

  return {
    getLayoutHeaderHeight: () => {
      return Number.parseInt(`${headerHeight.value}`, 10);
    },
    setLayoutHeaderHeight: (height: number) => {
      headerHeight.value = `${height}px`;
    },
  };
}

/**
 * 通过共享 CSS 变量读取或更新布局底部高度，数值写入时统一转换为像素。
 *
 * @returns 读取与设置布局底部像素高度的方法。
 */
export function useLayoutFooterStyle() {
  const footerHeight = useCssVar(CSS_VARIABLE_LAYOUT_FOOTER_HEIGHT);

  return {
    getLayoutFooterHeight: () => {
      return Number.parseInt(`${footerHeight.value}`, 10);
    },
    setLayoutFooterHeight: (height: number) => {
      footerHeight.value = `${height}px`;
    },
  };
}
