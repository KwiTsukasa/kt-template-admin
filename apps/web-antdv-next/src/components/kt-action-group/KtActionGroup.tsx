import type { PropType, StyleValue, VNodeChild } from 'vue';

import { defineComponent } from 'vue';

import { EllipsisOutlined } from '@antdv-next/icons';
import { Button, Popover } from 'antdv-next';

import './style.scss';

const AButton = Button as any;
const APopover = Popover as any;

export interface KtActionGroupItem {
  content: VNodeChild;
  key: string;
  overflowContent?: VNodeChild;
}

export type KtActionGroupLayout = 'balanced' | 'compact';

export default defineComponent({
  name: 'KtActionGroup',
  inheritAttrs: false,
  props: {
    items: {
      default: () => [],
      type: Array as PropType<KtActionGroupItem[]>,
    },
    layout: {
      default: 'compact',
      type: String as PropType<KtActionGroupLayout>,
    },
    moreLabel: {
      default: '更多操作',
      type: String,
    },
    moreTrigger: {
      default: 'click',
      type: String as PropType<'click' | 'hover'>,
    },
    size: {
      default: undefined,
      type: String as PropType<'large' | 'middle' | 'small'>,
    },
    visibleCount: {
      default: 2,
      type: Number,
    },
  },
  setup(props, { attrs, slots }) {
    /**
     * 把可见操作数量向下取整并限制为非负数，非有限值回退为零。
     *
     * @returns 操作组当前可直接展示的项目数量，结果不会小于零且不会超过项目总数。
     */
    function resolveVisibleCount() {
      if (!Number.isFinite(props.visibleCount)) return 0;
      return Math.max(0, Math.floor(props.visibleCount));
    }

    /**
     * 优先渲染调用方提供的“更多”插槽，缺失时回退为省略号图标。
     *
     * @returns 调用方提供的“更多”插槽内容；未提供插槽时为省略号图标节点。
     */
    function renderMoreButton() {
      const slotContent = slots.more?.();
      if (slotContent) return slotContent;
      return <EllipsisOutlined class="kt-action-group__more-icon" />;
    }

    /**
     * 根据操作组布局选择“更多”按钮类型：紧凑布局使用链接按钮，其余布局使用文本按钮。
     *
     * @returns 紧凑布局返回 `link`，其他布局返回 `text`。
     */
    function resolveMoreButtonType() {
      if (props.layout === 'compact') return 'link';
      return 'text';
    }

    /**
     * 根据平衡布局下的可见项数量生成等宽网格列样式；其他布局返回 undefined。
     *
     * @param renderedItemCount - 当前实际渲染的操作项数量，用于生成等宽网格列。
     * @returns 等宽 CSS 网格列样式；非平衡布局或没有可见项时返回 undefined。
     */
    function resolveGroupStyle(renderedItemCount: number) {
      if (props.layout !== 'balanced' || renderedItemCount === 0) {
        return undefined;
      }

      return {
        gridTemplateColumns: `repeat(${renderedItemCount}, minmax(0, 1fr))`,
      };
    }

    /**
     * 仅在存在溢出操作时渲染“更多”按钮与弹出列表，否则返回 null。
     *
     * @param items - 超出直显数量、需要收纳进“更多”菜单的操作项。
     * @returns 包含溢出操作的弹出按钮节点；没有溢出项时返回 null。
     */
    function renderMoreItem(items: KtActionGroupItem[]) {
      if (items.length === 0) return null;

      return (
        <span class="kt-action-group__item kt-action-group__item--more">
          <APopover
            classes={{ container: 'kt-action-group__popover' }}
            placement="bottomRight"
            trigger={props.moreTrigger}
          >
            {{
              content: () => (
                <div class="kt-action-group__popover-content">
                  {items.map((item) => (
                    <span class="kt-action-group__popover-item" key={item.key}>
                      {item.overflowContent ?? item.content}
                    </span>
                  ))}
                </div>
              ),
              default: () => (
                <AButton
                  aria-label={props.moreLabel}
                  block={props.layout === 'balanced'}
                  class="kt-action-group__more"
                  onClick={(event: MouseEvent) => event.stopPropagation()}
                  size={props.size}
                  type={resolveMoreButtonType()}
                >
                  {renderMoreButton()}
                </AButton>
              ),
            }}
          </APopover>
        </span>
      );
    }

    return () => {
      const inlineItems = props.items.slice(0, resolveVisibleCount());
      const overflowItems = props.items.slice(resolveVisibleCount());
      let renderedItemCount = inlineItems.length;
      if (overflowItems.length > 0) renderedItemCount += 1;
      const style = resolveGroupStyle(renderedItemCount);

      return (
        <div
          {...attrs}
          class={[
            'kt-action-group',
            `kt-action-group--${props.layout}`,
            attrs.class,
          ]}
          data-inline-action-count={inlineItems.length}
          data-overflow-action-count={overflowItems.length}
          style={[style, attrs.style as StyleValue]}
        >
          {inlineItems.map((item) => (
            <span class="kt-action-group__item" key={item.key}>
              {item.content}
            </span>
          ))}
          {renderMoreItem(overflowItems)}
        </div>
      );
    };
  },
});
