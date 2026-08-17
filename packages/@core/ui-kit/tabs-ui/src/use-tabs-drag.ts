import type { Sortable } from '@vben-core/composables';
import type { EmitType } from '@vben-core/typings';

import type { TabsProps } from './types';

import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import { useIsMobile, useSortable } from '@vben-core/composables';

// 可能会找到拖拽的子元素，这里需要确保拖拽的dom时tab元素
/**
 * 从目标节点沿 DOM 父链查找匹配选择器的元素，越过根节点时返回 null。
 *
 * @param element - 要从自身及父链查找页签分组 class 的起始元素。
 * @returns DOM 父链中首个匹配选择器的元素；越过根节点时返回 null。
 */
function findParentElement(element: HTMLElement) {
  const parentCls = 'group';
  if (element.classList.contains(parentCls)) {
    return element;
  }
  return element.closest(`.${parentCls}`);
}

/**
 * 创建页签 Sortable 生命周期，仅允许固定页签内部或普通页签内部排序并发出索引变化。
 *
 * @param props - 提供页签容器 class、拖拽开关和页签样式的组件属性。
 * @param emit - 向父组件派发状态或数据事件的函数。
 */
export function useTabsDrag(props: TabsProps, emit: EmitType) {
  const sortableInstance = ref<null | Sortable>(null);

  /**
   * 等待页签 DOM 就绪并创建 Sortable，仅允许固定或非固定页签各自内部排序。
   */
  async function initTabsSortable() {
    await nextTick();

    const el = document.querySelectorAll(
      `.${props.contentClass}`,
    )?.[0] as HTMLElement;

    if (!el) {
      console.warn('Element not found for sortable initialization');
      return;
    }

    const resetElState = async () => {
      el.style.cursor = 'default';
      // el.classList.remove('dragging');
      el.querySelector('.draggable')?.classList.remove('dragging');
    };

    const { initializeSortable } = useSortable(el, {
      filter: (_evt, target: HTMLElement) => {
        const parent = findParentElement(target);
        const draggable = parent?.classList.contains('draggable');
        return !draggable || !props.draggable;
      },
      /**
       * 拖拽结束时校验来源元素和索引，仅在同类可拖拽页签位置变化后发出排序事件。
       *
       * @param evt - Sortable 或 DOM 回调传入的原始事件对象。
       */
      onEnd(evt) {
        const { newIndex, oldIndex } = evt;
        // const fromElement = evt.item;
        const { srcElement } = (evt as any).originalEvent;

        if (!srcElement) {
          resetElState();
          return;
        }

        const srcParent = findParentElement(srcElement);

        if (!srcParent) {
          resetElState();
          return;
        }

        if (!srcParent.classList.contains('draggable')) {
          resetElState();

          return;
        }

        if (
          oldIndex !== undefined &&
          newIndex !== undefined &&
          !Number.isNaN(oldIndex) &&
          !Number.isNaN(newIndex) &&
          oldIndex !== newIndex
        ) {
          emit('sortTabs', oldIndex, newIndex);
        }
        resetElState();
      },
      /**
       * 仅允许固定页签之间或普通页签之间拖动，禁用拖拽或跨分组移动时返回 false。
       *
       * @param evt - Sortable 或 DOM 回调传入的原始事件对象。
       * @returns 仅当允许在同类固定状态页签之间移动时返回 true，否则返回 false。
       */
      onMove(evt) {
        const parent = findParentElement(evt.related);
        if (parent?.classList.contains('draggable') && props.draggable) {
          const isCurrentAffix = evt.dragged.classList.contains('affix-tab');
          const isRelatedAffix = evt.related.classList.contains('affix-tab');
          // 不允许在固定的tab和非固定的tab之间互相拖拽
          return isCurrentAffix === isRelatedAffix;
        } else {
          return false;
        }
      },
      onStart: () => {
        el.style.cursor = 'grabbing';
        el.querySelector('.draggable')?.classList.add('dragging');
        // el.classList.add('dragging');
      },
    });

    sortableInstance.value = await initializeSortable();
  }

  /**
   * 在非移动端等待页签渲染后启用拖拽排序，移动端保持原生滚动交互。
   */
  async function init() {
    const { isMobile } = useIsMobile();

    // 移动端下tab不需要拖拽
    if (isMobile.value) {
      return;
    }
    await nextTick();
    initTabsSortable();
  }

  onMounted(init);

  watch(
    () => props.styleType,
    () => {
      sortableInstance.value?.destroy();
      init();
    },
  );

  onUnmounted(() => {
    sortableInstance.value?.destroy();
  });
}
