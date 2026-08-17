import type { TabsProps } from './types';
import type { ComponentPublicInstance } from 'vue';

import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import { useDebounceFn } from '@vueuse/core';

type DomElement = Element | null | undefined;

/**
 * 管理页签视口宽度、滚轮横向滚动与活动页签可见性，并监听容器尺寸变化。
 *
 * @param props - 提供当前活动页签和页签列表、用于计算滚动状态的组件属性。
 * @returns 页签视口状态以及滚动、测量和活动项定位方法。
 */
export function useTabsViewScroll(props: TabsProps) {
  let resizeObserver: null | ResizeObserver = null;
  let mutationObserver: MutationObserver | null = null;
  let tabItemCount = 0;
  const scrollbarRef = ref<ComponentPublicInstance | null>(null);
  const scrollViewportEl = ref<DomElement>(null);
  const showScrollButton = ref(false);
  const scrollIsAtLeft = ref(true);
  const scrollIsAtRight = ref(false);

  /**
   * 读取标签滚动容器并返回可视宽度；容器未挂载时返回零。
   *
   * @returns 滚动条容器与视口的可视宽度；任一节点未挂载时为空对象。
   */
  function getScrollClientWidth() {
    const scrollbarEl = scrollbarRef.value?.$el;
    if (!scrollbarEl || !scrollViewportEl.value) return {};

    const scrollbarWidth = scrollbarEl.clientWidth;
    const scrollViewWidth = scrollViewportEl.value.clientWidth;

    return {
      scrollbarWidth,
      scrollViewWidth,
    };
  }

  /**
   * 按方向平滑滚动一个视口宽度减去保留距离；容器不可用或无需滚动时保持现状。
   *
   * @param direction - 页签视口要向左或向右滚动的方向。
   * @param distance - 每次滚动后保留可见的重叠像素；未传入时使用 `150`。
   */
  function scrollDirection(
    direction: 'left' | 'right',
    distance: number = 150,
  ) {
    const { scrollbarWidth, scrollViewWidth } = getScrollClientWidth();

    if (!scrollbarWidth || !scrollViewWidth) return;

    if (scrollbarWidth > scrollViewWidth) return;

    scrollViewportEl.value?.scrollBy({
      behavior: 'smooth',
      left: (() => {
        if (direction === 'left') {
          return -(scrollbarWidth - distance);
        }
        return +(scrollbarWidth - distance);
      })(),
    });
  }

  /**
   * 绑定页签滚动视口，计算滚动按钮并监听尺寸与页签数量变化以保持活动项可见。
   */
  async function initScrollbar() {
    await nextTick();

    const scrollbarEl = scrollbarRef.value?.$el;
    if (!scrollbarEl) {
      return;
    }

    const viewportEl = scrollbarEl?.querySelector(
      'div[data-reka-scroll-area-viewport]',
    );

    scrollViewportEl.value = viewportEl;
    calcShowScrollbarButton();

    await nextTick();
    scrollToActiveIntoView();

    // 监听大小变化
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(
      useDebounceFn((_entries: ResizeObserverEntry[]) => {
        calcShowScrollbarButton();
        scrollToActiveIntoView();
      }, 100),
    );
    resizeObserver.observe(viewportEl);

    tabItemCount = props.tabs?.length || 0;
    mutationObserver?.disconnect();
    // 使用 MutationObserver 仅监听子节点数量变化
    mutationObserver = new MutationObserver(() => {
      const count = viewportEl.querySelectorAll(
        `div[data-tab-item="true"]`,
      ).length;

      if (count > tabItemCount) {
        scrollToActiveIntoView();
      }

      if (count !== tabItemCount) {
        calcShowScrollbarButton();
        tabItemCount = count;
      }
    });

    // 配置为仅监听子节点的添加和移除
    mutationObserver.observe(viewportEl, {
      attributes: false,
      childList: true,
      subtree: true,
    });
  }

  /**
   * 当活动标签超出可视区域时调整滚动位置，使其完整进入视口。
   */
  async function scrollToActiveIntoView() {
    if (!scrollViewportEl.value) {
      return;
    }
    await nextTick();
    const viewportEl = scrollViewportEl.value;
    const { scrollbarWidth } = getScrollClientWidth();
    const { scrollWidth } = viewportEl;

    if (scrollbarWidth >= scrollWidth) {
      return;
    }

    requestAnimationFrame(() => {
      const activeItem = viewportEl?.querySelector('.is-active');
      activeItem?.scrollIntoView({ behavior: 'smooth', inline: 'start' });
    });
  }

  /**
   * 比较页签内容宽度与视口可用宽度，决定是否显示左右滚动按钮；视口未挂载时保持现状。
   */
  async function calcShowScrollbarButton() {
    if (!scrollViewportEl.value) {
      return;
    }

    const { scrollbarWidth } = getScrollClientWidth();

    showScrollButton.value =
      scrollViewportEl.value.scrollWidth > scrollbarWidth;
  }

  const handleScrollAt = useDebounceFn(({ left, right }) => {
    scrollIsAtLeft.value = left;
    scrollIsAtRight.value = right;
  }, 100);

  /**
   * 把垂直滚轮位移转换为横向页签视口滚动。
   */
  function handleWheel({ deltaY }: WheelEvent) {
    scrollViewportEl.value?.scrollBy({
      // behavior: 'smooth',
      left: deltaY * 3,
    });
  }

  watch(
    () => props.active,
    async () => {
      // 200为了等待 tab 切换动画完成
      // setTimeout(() => {
      scrollToActiveIntoView();
      // }, 300);
    },
    {
      flush: 'post',
    },
  );

  // watch(
  //   () => props.tabs?.length,
  //   async () => {
  //     await nextTick();
  //     calcShowScrollbarButton();
  //   },
  //   {
  //     flush: 'post',
  //   },
  // );

  watch(
    () => props.styleType,
    () => {
      initScrollbar();
    },
  );

  onMounted(initScrollbar);

  onUnmounted(() => {
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    resizeObserver = null;
    mutationObserver = null;
  });

  return {
    handleScrollAt,
    handleWheel,
    initScrollbar,
    scrollbarRef,
    scrollDirection,
    scrollIsAtLeft,
    scrollIsAtRight,
    showScrollButton,
  };
}
