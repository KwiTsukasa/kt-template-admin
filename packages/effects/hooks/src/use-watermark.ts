import type { Watermark, WatermarkOptions } from 'watermark-js-plus';

import { nextTick, onUnmounted, readonly, ref } from 'vue';

const watermark = ref<Watermark>();
const unmountedHooked = ref<boolean>(false);
const cachedOptions = ref<Partial<WatermarkOptions>>({
  advancedStyle: {
    colorStops: [
      {
        color: 'gray',
        offset: 0,
      },
      {
        color: 'gray',
        offset: 1,
      },
    ],
    type: 'linear',
  },
  // fontSize: '20px',
  content: '',
  contentType: 'multi-line-text',
  globalAlpha: 0.25,
  gridLayoutOptions: {
    cols: 2,
    gap: [20, 20],
    matrix: [
      [1, 0],
      [0, 1],
    ],
    rows: 2,
  },
  height: 200,
  layout: 'grid',
  rotate: 30,
  width: 160,
});

/**
 * 创建页面水印控制器并提供更新、销毁操作；重复初始化会先移除旧实例。
 *
 * @returns 水印初始化、更新和销毁方法。
 */
export function useWatermark() {
  /**
   * 异步加载水印库、合并缓存选项并创建新的页面水印实例。
   *
   * @param options - 首次创建水印时覆盖默认文本、尺寸、旋转和布局等字段的配置。
   */
  async function initWatermark(options: Partial<WatermarkOptions>) {
    const { Watermark } = await import('watermark-js-plus');

    cachedOptions.value = {
      ...cachedOptions.value,
      ...options,
    };
    watermark.value = new Watermark(cachedOptions.value);
    await watermark.value?.create();
  }

  /**
   * 合并新选项更新现有水印；尚未初始化时先创建水印实例。
   *
   * @param options - 要合并到既有水印配置的新文本、尺寸、旋转或布局字段；实例不存在时用于初始化。
   */
  async function updateWatermark(options: Partial<WatermarkOptions>) {
    if (watermark.value) {
      await nextTick();
      await watermark.value?.changeOptions({
        ...cachedOptions.value,
        ...options,
      });
    } else {
      await initWatermark(options);
    }
  }

  /**
   * 销毁当前水印实例并清空实例引用。
   */
  function destroyWatermark() {
    if (watermark.value) {
      watermark.value.destroy();
      watermark.value = undefined;
    }
  }

  // 只在第一次调用时注册卸载钩子，防止重复注册以致于在路由切换时销毁了水印
  if (!unmountedHooked.value) {
    unmountedHooked.value = true;
    onUnmounted(() => {
      destroyWatermark();
    });
  }

  return {
    destroyWatermark,
    updateWatermark,
    watermark: readonly(watermark),
  };
}
