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
    let currentWidth = 0;
    let guideFrame: number | undefined;
    let guideX = 0;
    let resizeGuideElement: HTMLDivElement | null = null;
    let startWidth = 0;
    let startX = 0;

    /**
     * 取消 resize guide 更新帧，避免卸载后继续写 DOM。
     */
    function cancelGuideFrame() {
      if (!guideFrame) return;

      window.cancelAnimationFrame(guideFrame);
      guideFrame = undefined;
    }

    /**
     * 创建列宽拖拽参考线，拖动期间只移动参考线，不重排表格本体。
     *
     * @param headerCell 当前被拖拽的表头单元格。
     */
    function createResizeGuide(headerCell: HTMLElement | null) {
      if (!headerCell) return;

      const tableBody = headerCell.closest('.kt-table__body');
      const rect = tableBody?.getBoundingClientRect();
      if (!rect) return;

      resizeGuideElement = document.createElement('div');
      resizeGuideElement.className = 'kt-table__resize-guide';
      resizeGuideElement.style.top = `${rect.top}px`;
      resizeGuideElement.style.height = `${rect.height}px`;
      document.body.append(resizeGuideElement);
    }

    /**
     * 按当前鼠标位置移动列宽拖拽参考线。
     */
    function moveResizeGuide() {
      if (guideFrame) return;

      guideFrame = window.requestAnimationFrame(() => {
        guideFrame = undefined;

        if (resizeGuideElement) {
          resizeGuideElement.style.transform = `translate3d(${guideX}px, 0, 0)`;
        }
      });
    }

    /**
     * 移除列宽拖拽参考线。
     */
    function removeResizeGuide() {
      resizeGuideElement?.remove();
      resizeGuideElement = null;
    }

    /**
     * 停止列宽拖拽并清理全局鼠标事件。
     */
    function stopDragging() {
      dragging.value = false;
      removeResizeGuide();
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
      currentWidth = Math.max(startWidth + event.clientX - startX, 40);
      guideX = startX + currentWidth - startWidth;
      moveResizeGuide();
    }

    /**
     * 处理鼠标释放，结束当前列宽拖拽。
     *
     * @param event 鼠标释放事件，用于在拖拽完成时一次性提交最终列宽。
     */
    function handleMouseUp(event: MouseEvent) {
      cancelGuideFrame();
      if (dragging.value && Math.abs(currentWidth - startWidth) >= 1) {
        props.onResize?.(event, { size: { width: currentWidth } });
      }
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
      currentWidth = startWidth;
      guideX = startX;
      createResizeGuide(headerCell);
      moveResizeGuide();

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

    onBeforeUnmount(() => {
      cancelGuideFrame();
      stopDragging();
    });

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
