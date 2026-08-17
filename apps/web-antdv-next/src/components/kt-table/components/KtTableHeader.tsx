import { Comment, defineComponent, isVNode } from 'vue';

import { Divider } from 'antdv-next';

const ADivider = Divider as any;

/**
 * 通过过滤 null、注释节点和空 Fragment 判断插槽是否没有可见内容。
 *
 * @param content - Vue 插槽返回的单个节点、节点数组或空值。
 * @returns 插槽不含可见节点时为 true，否则为 false。
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
 * 通过解析插槽渲染结果，过滤空注释节点。
 *
 * @param content - Vue 插槽返回的单个节点、节点数组或空值。
 * @returns 过滤空节点后的插槽内容；全部为空时为 null。
 */
function resolveSlotContent(content: unknown) {
  if (!content || isEmptySlot(content)) {
    return null;
  }
  return content;
}

export default defineComponent({
  name: 'KtTableHeader',
  props: {
    title: {
      default: undefined,
      type: String,
    },
  },
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
              {(() => {
                if (title) {
                  return (
                    <div class="kt-table__header-title-row">
                      <div class="kt-table__header-title">{title}</div>
                    </div>
                  );
                }
                return null;
              })()}
              {(() => {
                if (controls) {
                  return (
                    <div class="kt-table__header-controls">{controls}</div>
                  );
                }
                return null;
              })()}
            </div>
            {(() => {
              if (toolbar || settings) {
                return (
                  <div class="kt-table__header-actions">
                    {(() => {
                      if (toolbar) {
                        return (
                          <div class="kt-table__header-button">{toolbar}</div>
                        );
                      }
                      return null;
                    })()}
                    {(() => {
                      if (settings) {
                        return (
                          <div class="kt-table__header-toolbar">
                            {(() => {
                              if (toolbar) {
                                return (
                                  <ADivider
                                    class="kt-table__header-divider"
                                    orientation="vertical"
                                  />
                                );
                              }
                              return null;
                            })()}
                            {settings}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      );
    };
  },
});
