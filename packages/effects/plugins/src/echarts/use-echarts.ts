import type { EChartsOption } from 'echarts';

import type { Ref } from 'vue';

import type { Nullable } from '@vben/types';

import type EchartsUI from './echarts-ui.vue';

import { computed, nextTick, watch } from 'vue';

import { usePreferences } from '@vben/preferences';

import {
  tryOnUnmounted,
  useDebounceFn,
  useResizeObserver,
  useTimeoutFn,
  useWindowSize,
} from '@vueuse/core';

import echarts from './echarts';

type EchartsUIType = typeof EchartsUI | undefined;

type EchartsThemeType = 'dark' | 'light' | null;

/**
 * 按容器尺寸初始化 ECharts，响应主题和窗口变化重绘，并在卸载时释放实例。
 *
 * @param chartRef - 用于初始化或销毁 ECharts 的容器引用。
 * @returns ECharts 渲染、重绘、获取实例和销毁方法。
 */
function useEcharts(chartRef: Ref<EchartsUIType>) {
  let chartInstance: echarts.ECharts | null = null;
  let cacheOptions: EChartsOption = {};

  const { isDark } = usePreferences();
  const { height, width } = useWindowSize();
  const resizeHandler: () => void = useDebounceFn(resize, 200);

  const getChartEl = (): HTMLElement | null => {
    const refValue = chartRef?.value as unknown;
    if (!refValue) return null;
    if (refValue instanceof HTMLElement) {
      return refValue;
    }
    const maybeComponent = refValue as { $el?: HTMLElement };
    return maybeComponent.$el ?? null;
  };

  const isElHidden = (el: HTMLElement | null): boolean => {
    if (!el) return true;
    return el.offsetHeight === 0 || el.offsetWidth === 0;
  };

  const getOptions = computed((): EChartsOption => {
    if (!isDark.value) {
      return {};
    }

    return {
      backgroundColor: 'transparent',
    };
  });

  const initCharts = (t?: EchartsThemeType) => {
    const el = chartRef?.value?.$el;
    if (!el) {
      return;
    }
    chartInstance = echarts.init(
      el,
      (() => {
        if (t || isDark.value) {
          return 'dark';
        }
        return null;
      })(),
    );

    return chartInstance;
  };

  const renderEcharts = (
    options: EChartsOption,
    clear = true,
  ): Promise<Nullable<echarts.ECharts>> => {
    cacheOptions = options;
    const currentOptions = {
      ...options,
      ...getOptions.value,
    };
    return new Promise((resolve) => {
      if (chartRef.value?.offsetHeight === 0) {
        useTimeoutFn(async () => {
          resolve(await renderEcharts(currentOptions));
        }, 30);
        return;
      }
      nextTick(() => {
        const el = getChartEl();
        if (isElHidden(el)) {
          useTimeoutFn(async () => {
            resolve(await renderEcharts(currentOptions));
          }, 30);
          return;
        }
        useTimeoutFn(() => {
          if (!chartInstance || chartInstance?.getDom() !== el) {
            chartInstance?.dispose();
            const instance = initCharts();
            if (!instance) return;
          }
          clear && chartInstance?.clear();
          chartInstance?.setOption(currentOptions);
          resolve(chartInstance);
        }, 30);
      });
    });
  };

  const updateDate = (
    option: EChartsOption,
    notMerge = false, // false = 合并（保留动画），true = 完全替换
    lazyUpdate = false, // true 时不立即重绘，适合短时间内多次调用
  ): Promise<echarts.ECharts | null> => {
    return new Promise((resolve) => {
      nextTick(() => {
        if (!chartInstance) {
          // 还没初始化 → 当作首次渲染
          renderEcharts(option).then(resolve);
          return;
        }

        // 合并你原有的全局配置（比如 backgroundColor）
        const finalOption = {
          ...option,
          ...getOptions.value,
        };

        chartInstance.setOption(finalOption, {
          notMerge,
          lazyUpdate,
          // silent: true,     // 如果追求极致性能可开启（关闭所有事件）
        });

        resolve(chartInstance);
      });
    });
  };

  /**
   * 根据窗口和容器尺寸重算表格可用高度，并同步滚动区域。
   */
  function resize() {
    const el = getChartEl();
    if (isElHidden(el)) {
      return;
    }
    chartInstance?.resize({
      animation: {
        duration: 300,
        easing: 'quadraticIn',
      },
    });
  }

  watch([width, height], () => {
    resizeHandler?.();
  });

  useResizeObserver(chartRef as never, resizeHandler);

  watch(isDark, () => {
    if (chartInstance) {
      chartInstance.dispose();
      initCharts();
      renderEcharts(cacheOptions);
      resize();
    }
  });

  tryOnUnmounted(() => {
    // 销毁实例，释放资源
    chartInstance?.dispose();
  });
  return {
    renderEcharts,
    resize,
    updateDate,
    getChartInstance: () => chartInstance,
  };
}

export { useEcharts };

export type { EchartsUIType };
