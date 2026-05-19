import type { ComputedRef } from 'vue';

import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

interface UseKtTableLayoutOptions {
  hasSummary: ComputedRef<boolean>;
}

/**
 * 管理 KtTable 可滚动区域高度和搜索动画期间的布局冻结。
 *
 * @param options 布局系统初始化参数。
 * @param options.hasSummary 当前表格是否存在 summary 行。
 */
export function useKtTableLayout(options: UseKtTableLayoutOptions) {
  const { hasSummary } = options;
  // 搜索区动画期间冻结表格高度重算，等过渡结束后再同步一次，避免频繁重算导致动画卡顿。
  const tableBodyRef = ref<HTMLElement | null>(null);
  const tableScrollY = ref(260);
  const searchTransitioning = ref(false);
  let layoutFrame: number | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let observingTableBody = false;

  /**
   * 搜索区域动画结束后恢复布局计算。
   */
  function handleSearchTransitionEnd() {
    searchTransitioning.value = false;
    observeTableBody();
    scheduleTableLayout(true);
  }

  /**
   * 搜索区域动画开始时冻结表格高度重算。
   */
  function handleSearchTransitionStart() {
    searchTransitioning.value = true;
    pauseTableBodyObserver();
    cancelLayoutFrame();
  }

  /**
   * 根据表格容器、表头和 summary 高度计算 body 滚动高度。
   *
   * @param force 是否无视搜索动画冻结状态强制重算。
   */
  function updateTableScrollY(force = false) {
    if (searchTransitioning.value && !force) return;

    const wrapper = tableBodyRef.value;
    if (!wrapper) return;

    const header = wrapper.querySelector(
      '.ant-table-header',
    ) as HTMLElement | null;
    const fallbackSummaryHeight = hasSummary.value ? 44 : 0;
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
   * @param force 是否无视搜索动画冻结状态强制调度。
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
   * 监听表格容器尺寸变化，正常状态下同步 Antdv Table 的 scroll.y。
   */
  function observeTableBody() {
    const wrapper = tableBodyRef.value;
    if (!resizeObserver || !wrapper || observingTableBody) return;

    resizeObserver.observe(wrapper);
    observingTableBody = true;
  }

  /**
   * 表单动画期间暂停表格尺寸监听，让表格不参与每帧动画计算。
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
  };
}
