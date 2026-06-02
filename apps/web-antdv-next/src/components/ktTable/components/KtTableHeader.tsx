import { Comment, defineComponent, isVNode } from 'vue';

import { Divider } from 'antdv-next';

const ADivider = Divider as any;

/**
 * 判断插槽是否只包含空节点。
 *
 * @param content 插槽渲染结果。
 */
function isEmptySlot(content: unknown) {
  return (
    Array.isArray(content) &&
    content.every(
      (item) => item === null || (isVNode(item) && item.type === Comment),
    )
  );
}

/**
 * 解析插槽渲染结果，过滤空注释节点。
 *
 * @param content 插槽渲染结果。
 */
function resolveSlotContent(content: unknown) {
  return !content || isEmptySlot(content) ? null : content;
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
   * @param slots.slots 头部标题、控制区、按钮和设置区插槽。
   */
  setup(props, { slots }) {
    return () => {
      const slotTitle = resolveSlotContent(slots.title?.());
      const title = slotTitle || props.title;
      const controls = resolveSlotContent(slots.controls?.());
      const toolbar = resolveSlotContent(slots.toolbar?.());
      const settings = resolveSlotContent(slots.settings?.());

      if (!title && !controls && !toolbar && !settings) return null;

      return (
        <div class="kt-table__header">
          <div class="kt-table__header-layout">
            <div class="kt-table__header-content">
              {title ? (
                <div class="kt-table__header-title-row">
                  <div class="kt-table__header-title">{title}</div>
                </div>
              ) : null}
              {controls ? (
                <div class="kt-table__header-controls">{controls}</div>
              ) : null}
            </div>
            {toolbar || settings ? (
              <div class="kt-table__header-actions">
                {toolbar ? (
                  <div class="kt-table__header-button">{toolbar}</div>
                ) : null}
                {settings ? (
                  <div class="kt-table__header-toolbar">
                    {toolbar ? (
                      <ADivider
                        class="kt-table__header-divider"
                        type="vertical"
                      />
                    ) : null}
                    {settings}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      );
    };
  },
});
