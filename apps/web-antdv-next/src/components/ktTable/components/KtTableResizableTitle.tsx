import type { PropType } from 'vue';

import { defineComponent, h, onBeforeUnmount, ref } from 'vue';

export interface KtTableResizeInfo {
  size: {
    width: number;
  };
}

type KtTableResizableTitleProps = {
  onResize?: (event: MouseEvent, info: KtTableResizeInfo) => void;
  width?: number;
};

export default defineComponent({
  name: 'KtTableResizableTitle',
  inheritAttrs: false,
  props: {
    onResize: {
      default: undefined,
      type: Function as PropType<KtTableResizableTitleProps['onResize']>,
    },
    width: {
      default: undefined,
      type: Number,
    },
  },
  /**
   * 初始化可拖拽列宽表头单元格。
   *
   * @param props 表头单元格宽度和列宽变化回调。
   * @param attrs Vue setup context。
   * @param attrs.attrs Antdv Table 透传给 th 的原生属性。
   * @param attrs.slots 表头默认内容插槽。
   */
  setup(props, { attrs, slots }) {
    const dragging = ref(false);
    const stopNextClick = ref(false);
    let startWidth = 0;
    let startX = 0;

    /**
     * 停止列宽拖拽并清理全局鼠标事件。
     */
    function stopDragging() {
      dragging.value = false;
      document.body.classList.remove('kt-table--column-resizing');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    /**
     * 处理鼠标移动并计算下一列宽。
     *
     * @param event 鼠标移动事件，用于读取当前横向坐标。
     */
    function handleMouseMove(event: MouseEvent) {
      if (!dragging.value) return;

      stopNextClick.value = true;
      const nextWidth = Math.max(startWidth + event.clientX - startX, 40);
      props.onResize?.(event, { size: { width: nextWidth } });
    }

    /**
     * 处理鼠标释放，结束当前列宽拖拽。
     */
    function handleMouseUp() {
      stopDragging();
      window.setTimeout(() => {
        stopNextClick.value = false;
      }, 0);
    }

    /**
     * 处理拖拽手柄按下，记录起始宽度和起始坐标。
     *
     * @param event 鼠标按下事件，用于读取起始坐标和当前手柄元素。
     */
    function handleMouseDown(event: MouseEvent) {
      event.preventDefault();
      event.stopPropagation();

      const target = event.currentTarget as HTMLElement;
      const headerCell = target.parentElement;

      dragging.value = true;
      stopNextClick.value = false;
      startX = event.clientX;
      startWidth = props.width || headerCell?.offsetWidth || 0;

      document.body.classList.add('kt-table--column-resizing');
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    /**
     * 阻止拖拽后的冒泡点击，避免误触发表头排序。
     *
     * @param event 表头捕获阶段点击事件。
     */
    function handleClickCapture(event: MouseEvent) {
      if (!stopNextClick.value) return;

      event.stopPropagation();
      event.preventDefault();
      stopNextClick.value = false;
    }

    onBeforeUnmount(stopDragging);

    return () => {
      if (!props.width) {
        return h('th', attrs, slots.default?.());
      }

      return h(
        'th',
        {
          ...attrs,
          class: ['kt-table__resizable-title', attrs.class],
          onClickCapture: handleClickCapture,
          style: {
            ...(attrs.style as Record<string, unknown> | undefined),
            width: `${props.width}px`,
          },
        },
        [
          slots.default?.(),
          h('span', {
            class: 'kt-table__resizable-handle',
            onMousedown: handleMouseDown,
          }),
        ],
      );
    };
  },
});
