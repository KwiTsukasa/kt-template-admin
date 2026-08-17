import type { FormRenderProps } from '../types';

import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue';

import {
  breakpointsTailwind,
  useBreakpoints,
  useElementVisibility,
} from '@vueuse/core';

/**
 * 根据表单字段跨度与容器列数计算展开状态、总行数和可见字段。
 *
 * @param props - 依赖字段解析时可读取的表单值。
 * @returns 展开状态、总行数、切换方法和按展开状态过滤 Schema 的方法。
 */
export function useExpandable(props: FormRenderProps) {
  const wrapperRef = useTemplateRef<HTMLElement>('wrapperRef');
  const isVisible = useElementVisibility(wrapperRef);
  const rowMapping = ref<Record<number, number>>({});
  // 是否已经计算过一次
  const isCalculated = ref(false);

  const breakpoints = useBreakpoints(breakpointsTailwind);

  const keepFormItemIndex = computed(() => {
    const rows = props.collapsedRows ?? 1;
    const mapping = rowMapping.value;
    let maxItem = 0;
    for (let index = 1; index <= rows; index++) {
      maxItem += mapping?.[index] ?? 0;
    }
    const reservedActionCount = (() => {
      if (props.collapseReserveAction === false) {
        return 0;
      }
      return 1;
    })();
    // 默认给内置 FormActions 预留一格；外部自定义操作区可关闭预留。
    return Math.max(maxItem - reservedActionCount, 1);
  });

  watch(
    [
      () => props.showCollapseButton,
      () => breakpoints.active().value,
      () => props.schema?.length,
      () => isVisible.value,
    ],
    async ([val]) => {
      if (val) {
        await nextTick();
        rowMapping.value = {};
        isCalculated.value = false;
        await calculateRowMapping();
      }
    },
  );

  /**
   * 根据表单字段跨度计算每一行的起止索引，供展开收起逻辑隐藏完整行。
   */
  async function calculateRowMapping() {
    if (!props.showCollapseButton) {
      return;
    }

    await nextTick();
    if (!wrapperRef.value) {
      return;
    }
    // 小屏幕不计算
    // if (breakpoints.smaller('sm').value) {
    //   // 保持一行
    //   rowMapping.value = { 1: 2 };
    //   return;
    // }

    const formItems = [...wrapperRef.value.children];

    const container = wrapperRef.value;
    const containerStyles = window.getComputedStyle(container);
    const rowHeights = containerStyles
      .getPropertyValue('grid-template-rows')
      .split(' ');

    const containerRect = container?.getBoundingClientRect();

    formItems.forEach((el) => {
      const itemRect = el.getBoundingClientRect();

      // 计算元素在第几行
      const itemTop = itemRect.top - containerRect.top;
      let rowStart = 0;
      let cumulativeHeight = 0;

      for (const [i, rowHeight] of rowHeights.entries()) {
        cumulativeHeight += Number.parseFloat(rowHeight);
        if (itemTop < cumulativeHeight) {
          rowStart = i + 1;
          break;
        }
      }
      if (rowStart > (props?.collapsedRows ?? 1)) {
        return;
      }
      rowMapping.value[rowStart] = (rowMapping.value[rowStart] ?? 0) + 1;
      isCalculated.value = true;
    });
  }

  onMounted(() => {
    calculateRowMapping();
  });

  return { isCalculated, keepFormItemIndex, wrapperRef };
}
