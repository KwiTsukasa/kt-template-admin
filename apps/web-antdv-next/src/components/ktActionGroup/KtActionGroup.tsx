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
    function resolveVisibleCount() {
      if (!Number.isFinite(props.visibleCount)) return 0;
      return Math.max(0, Math.floor(props.visibleCount));
    }

    function renderMoreButton() {
      const slotContent = slots.more?.();
      if (slotContent) return slotContent;
      return <EllipsisOutlined class="kt-action-group__more-icon" />;
    }

    function resolveMoreButtonType() {
      if (props.layout === 'compact') return 'link';
      return 'text';
    }

    function resolveGroupStyle(renderedItemCount: number) {
      if (props.layout !== 'balanced' || renderedItemCount === 0) {
        return undefined;
      }

      return {
        gridTemplateColumns: `repeat(${renderedItemCount}, minmax(0, 1fr))`,
      };
    }

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
