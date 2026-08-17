import type { SortableOptions } from 'sortablejs';
import type Sortable from 'sortablejs';

/**
 * 按触摸延迟和动画默认值创建 Sortable 实例，并允许调用方选项覆盖默认配置。
 *
 * @param sortableContainer - 创建 Sortable 实例时绑定的 HTML 容器元素。
 * @param options - 覆盖默认动画、触摸延迟及其他 Sortable 行为的选项；省略时使用内置拖拽参数。
 * @returns 包含异步创建 Sortable 实例方法的对象。
 */
function useSortable<T extends HTMLElement>(
  sortableContainer: T,
  options: SortableOptions = {},
) {
  const initializeSortable = async () => {
    const Sortable = await import(
      // @ts-expect-error - This is a dynamic import
      'sortablejs/modular/sortable.complete.esm.js'
    );
    const sortable = Sortable?.default?.create?.(sortableContainer, {
      animation: 300,
      delay: 400,
      delayOnTouchOnly: true,
      ...options,
    });
    return sortable as Sortable;
  };

  return {
    initializeSortable,
  };
}

export { useSortable };

export type { Sortable };
