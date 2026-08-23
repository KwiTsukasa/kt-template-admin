import type { PropType } from 'vue';

import { defineComponent } from 'vue';

import { Empty } from 'antdv-next';

import './style.scss';

const AEmpty = Empty as any;

export type KtCardListVariant = 'compact' | 'default';

export default defineComponent({
  name: 'KtCardList',
  inheritAttrs: false,
  props: {
    emptyDescription: {
      default: '暂无数据',
      type: String,
    },
    itemCount: {
      default: 0,
      type: Number,
    },
    variant: {
      default: 'default',
      type: String as PropType<KtCardListVariant>,
      validator: (value: string) => ['compact', 'default'].includes(value),
    },
  },
  setup(props, { attrs, slots }) {
    return () => {
      let summaryNode = null;
      if (slots.summary) {
        summaryNode = (
          <div class="kt-card-list__summary">{slots.summary()}</div>
        );
      }
      let contentNode = (
        <div class="kt-card-list__empty">
          <AEmpty description={props.emptyDescription} />
        </div>
      );
      if (props.itemCount > 0) {
        contentNode = <div class="kt-card-list__grid">{slots.default?.()}</div>;
      }
      return (
        <div
          {...attrs}
          class={[
            'kt-card-list',
            `kt-card-list--${props.variant}`,
            attrs.class,
          ]}
          data-item-count={props.itemCount}
          data-variant={props.variant}
        >
          {summaryNode}
          {contentNode}
        </div>
      );
    };
  },
});
