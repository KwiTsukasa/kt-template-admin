import type { ComputedRef } from 'vue';

import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

interface UseKtTableLayoutOptions {
  hasSummary: ComputedRef<boolean>;
}

/**
 * 通过容器测量与 ResizeObserver 管理表格 scroll.y，并在搜索动画期间冻结重算。
 *
 * @param options - 表格容器、搜索动画状态和 scroll.y 更新依赖。
 * @returns 当前 scroll.y、布局调度方法和搜索动画监听控制方法。
 */
export function useKtTableLayout(options: UseKtTableLayoutOptions) {
  const { hasSummary } = options;
  // 搜索区动画期间冻结表格高度重算，等过渡结束后再同步一次，避免频繁重算导致动画卡顿。
  const tableBodyRef = ref<HTMLElement | null>(null);
  const tableScrollY = ref(260);
  const tableViewportWidth = ref(0);
  const searchTransitioning = ref(false);
  let layoutFrame: number | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let observingTableBody = false;

  /**
   * 当搜索区域动画结束时恢复尺寸监听并强制重算表格高度。
   */
  function handleSearchTransitionEnd() {
    searchTransitioning.value = false;
    observeTableBody();
    scheduleTableLayout(true);
  }

  /**
   * 当搜索区域动画开始时暂停尺寸监听，避免每帧重排表格。
   */
  function handleSearchTransitionStart() {
    searchTransitioning.value = true;
    pauseTableBodyObserver();
    cancelLayoutFrame();
  }

  /**
   * 根据表格容器、表头和 summary 高度计算 body 滚动高度。
   *
   * @param force - 是否绕过搜索动画冻结状态并立即重算表格高度；未传入时使用 `false`。
   */
  function updateTableScrollY(force = false) {
    if (searchTransitioning.value && !force) return;

    const wrapper = tableBodyRef.value;
    if (!wrapper) return;

    tableViewportWidth.value = wrapper.clientWidth;

    const header = wrapper.querySelector(
      '.ant-table-header',
    ) as HTMLElement | null;
    const fallbackSummaryHeight = (() => {
      if (hasSummary.value) {
        return 44;
      }
      return 0;
    })();
    const summary = wrapper.querySelector(
      '.ant-table-summary',
    ) as HTMLElement | null;
    const headerHeight =
      header?.getBoundingClientRect().height ||
      (
        wrapper.querySelector('.ant-table-thead') as HTMLElement | null
      )?.getBoundingClientRect().height ||
      48;
    const summaryHeight =
      summary?.getBoundingClientRect().height || fallbackSummaryHeight;
    const nextHeight = Math.max(
      160,
      Math.floor(wrapper.clientHeight - headerHeight - summaryHeight - 2),
    );

    if (Number.isFinite(nextHeight)) {
      tableScrollY.value = nextHeight;
    }
  }

  /**
   * 取消已经排队的布局帧，避免搜索动画期间执行无意义的表格高度读写。
   */
  function cancelLayoutFrame() {
    if (!layoutFrame) return;

    window.cancelAnimationFrame(layoutFrame);
    layoutFrame = undefined;
  }

  /**
   * 调度下一帧表格布局重算，避免同步频繁读写 DOM。
   *
   * @param force - 是否绕过搜索动画冻结状态并立即重算表格高度；未传入时使用 `false`。
   */
  function scheduleTableLayout(force = false) {
    if (searchTransitioning.value && !force) return;

    nextTick(() => {
      cancelLayoutFrame();

      layoutFrame = window.requestAnimationFrame(() => {
        layoutFrame = undefined;
        updateTableScrollY(force);
      });
    });
  }

  /**
   * 通过 ResizeObserver 监听表格容器，并在稳定状态同步 scroll.y。
   */
  function observeTableBody() {
    const wrapper = tableBodyRef.value;
    if (!resizeObserver || !wrapper || observingTableBody) return;

    resizeObserver.observe(wrapper);
    observingTableBody = true;
  }

  /**
   * 在搜索表单动画期间断开尺寸监听，并取消待执行的布局帧。
   */
  function pauseTableBodyObserver() {
    const wrapper = tableBodyRef.value;
    if (!resizeObserver || !wrapper || !observingTableBody) return;

    resizeObserver.unobserve(wrapper);
    observingTableBody = false;
  }

  onMounted(() => {
    resizeObserver = new ResizeObserver(() => {
      scheduleTableLayout();
    });
    observeTableBody();
    scheduleTableLayout();
  });

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    if (layoutFrame) {
      window.cancelAnimationFrame(layoutFrame);
    }
    document.body.classList.remove('kt-table--column-resizing');
  });

  return {
    handleSearchTransitionEnd,
    handleSearchTransitionStart,
    scheduleTableLayout,
    tableBodyRef,
    tableScrollY,
    tableViewportWidth,
  };
}
