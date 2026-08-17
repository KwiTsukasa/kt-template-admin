import type { ComputedRef, Ref } from 'vue';

import { onBeforeUnmount, onMounted, reactive, ref, watchEffect } from 'vue';

import { unrefElement } from '@vueuse/core';

/**
 * 在弹窗标题区拖拽时计算视口边界并更新偏移，避免弹窗被拖出可见区域。
 *
 * @param targetRef - 被移动并写入 transform 样式的弹窗元素引用。
 * @param dragRef - 接收鼠标按下事件的弹窗拖拽手柄引用。
 * @param draggable - 控制是否注册拖拽事件的响应式开关。
 * @param containerSelector - 限制弹窗移动范围的容器选择器；省略时使用视口边界。
 * @param centered - 弹窗是否以垂直居中变换为基准；省略时按普通定位计算。
 * @returns 弹窗拖拽偏移、拖拽状态及鼠标事件处理器。
 */
export function useModalDraggable(
  targetRef: Ref<HTMLElement | undefined>,
  dragRef: Ref<HTMLElement | undefined>,
  draggable: ComputedRef<boolean>,
  containerSelector?: ComputedRef<string | undefined>,
  centered?: ComputedRef<boolean>,
) {
  const transform = reactive({
    offsetX: 0,
    offsetY: 0,
  });

  const dragging = ref(false);

  const onMousedown = (e: MouseEvent) => {
    const downX = e.clientX;
    const downY = e.clientY;

    if (!targetRef.value) {
      return;
    }

    const targetRect = targetRef.value.getBoundingClientRect();
    const { offsetX, offsetY } = transform;
    const targetLeft = targetRect.left;
    const targetTop = targetRect.top;
    const targetWidth = targetRect.width;
    const targetHeight = targetRect.height;

    let containerRect: DOMRect | null = null;

    if (containerSelector?.value) {
      const container = document.querySelector(containerSelector.value);
      if (container) {
        containerRect = container.getBoundingClientRect();
      }
    }

    let maxLeft, maxTop, minLeft, minTop;
    if (containerRect) {
      minLeft = containerRect.left - targetLeft + offsetX;
      maxLeft = containerRect.right - targetLeft - targetWidth + offsetX;
      minTop = containerRect.top - targetTop + offsetY;
      maxTop = containerRect.bottom - targetTop - targetHeight + offsetY;
    } else {
      const docElement = document.documentElement;
      const clientWidth = docElement.clientWidth;
      const clientHeight = docElement.clientHeight;
      minLeft = -targetLeft + offsetX;
      minTop = -targetTop + offsetY;
      maxLeft = clientWidth - targetLeft - targetWidth + offsetX;
      maxTop = clientHeight - targetTop - targetHeight + offsetY;
    }

    const onMousemove = (e: MouseEvent) => {
      let moveX = offsetX + e.clientX - downX;
      let moveY = offsetY + e.clientY - downY;

      moveX = Math.min(Math.max(moveX, minLeft), maxLeft);
      moveY = Math.min(Math.max(moveY, minTop), maxTop);

      transform.offsetX = moveX;
      transform.offsetY = moveY;

      if (targetRef.value) {
        const isCentered = centered?.value;
        if (isCentered) {
          targetRef.value.style.transform = `translate(${moveX}px, calc(-50% + ${moveY}px))`;
        } else {
          targetRef.value.style.transform = `translate(${moveX}px, ${moveY}px)`;
        }
        dragging.value = true;
      }
    };

    const onMouseup = () => {
      dragging.value = false;
      document.removeEventListener('mousemove', onMousemove);
      document.removeEventListener('mouseup', onMouseup);
    };

    document.addEventListener('mousemove', onMousemove);
    document.addEventListener('mouseup', onMouseup);
  };

  const onDraggable = () => {
    const dragDom = unrefElement(dragRef);
    if (dragDom && targetRef.value) {
      dragDom.addEventListener('mousedown', onMousedown);
    }
  };

  const offDraggable = () => {
    const dragDom = unrefElement(dragRef);
    if (dragDom && targetRef.value) {
      dragDom.removeEventListener('mousedown', onMousedown);
    }
  };

  const resetPosition = () => {
    transform.offsetX = 0;
    transform.offsetY = 0;

    const target = unrefElement(targetRef);
    if (target) {
      target.style.transform = '';
    }
  };

  onMounted(() => {
    watchEffect(() => {
      if (draggable.value) {
        onDraggable();
      } else {
        offDraggable();
      }
    });
  });

  onBeforeUnmount(() => {
    offDraggable();
  });

  return {
    dragging,
    resetPosition,
    transform,
  };
}
