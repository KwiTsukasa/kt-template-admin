import { Comment, defineComponent, isVNode } from 'vue';

import { Divider } from 'antdv-next';

const ADivider = Divider as any;

/**
 * 判断标题插槽是否只包含空节点。
 *
 * @param title 标题插槽渲染结果。
 */
function isEmptyTitleSlot(title: unknown) {
  return (
    Array.isArray(title) &&
    title.every(
      (item) => item === null || (isVNode(item) && item.type === Comment),
    )
  );
}

export default defineComponent({
  name: 'KtTableHeader',
  props: {
    title: {
      default: undefined,
      type: String,
    },
  },
  /**
   * 初始化表格头部区域。
   *
   * @param props 表格头部 props，目前用于接收默认标题。
   * @param slots Vue setup context。
   * @param slots.slots 头部标题、按钮和设置区插槽。
   */
  setup(props, { slots }) {
    return () => {
      const slotTitle = slots.title?.();
      const title =
        !slotTitle || isEmptyTitleSlot(slotTitle) ? props.title : slotTitle;
      const toolbar = slots.toolbar?.();
      const settings = slots.settings?.();

      if (!title && !toolbar && !settings) return null;

      return (
        <div class="kt-table__header">
          <div class="kt-table__header-align">
            <div class="kt-table__header-title">{title}</div>
            <div class="kt-table__header-button">{toolbar}</div>
          </div>
          {settings ? (
            <div class="kt-table__header-toolbar">
              <ADivider class="kt-table__header-divider" type="vertical" />
              {settings}
            </div>
          ) : null}
        </div>
      );
    };
  },
});
