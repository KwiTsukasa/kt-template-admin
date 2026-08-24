import type { PropType } from 'vue';

import { defineComponent } from 'vue';

import { Empty, Spin } from 'antdv-next';

import './style.scss';

const AEmpty = Empty as any;
const ASpin = Spin as any;

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
    loading: {
      default: false,
      type: Boolean,
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
        contentNode = (
          <ASpin class="kt-card-list__loading-shell" spinning={props.loading}>
            <div class="kt-card-list__grid">{slots.default?.()}</div>
          </ASpin>
        );
      } else if (props.loading) {
        let skeletonCount = 8;
        if (props.variant === 'compact') skeletonCount = 12;
        contentNode = (
          <div
            aria-label="正在加载卡片数据"
            class="kt-card-list__grid kt-card-list__grid--skeleton"
            role="status"
          >
            {Array.from({ length: skeletonCount }, (_, index) => (
              <div
                aria-hidden="true"
                class="kt-card-list__skeleton-card"
                key={index}
              >
                <span class="kt-card-list__skeleton-line kt-card-list__skeleton-line--title" />
                <span class="kt-card-list__skeleton-line kt-card-list__skeleton-line--short" />
                <div class="kt-card-list__skeleton-metrics">
                  <span />
                  <span />
                  <span />
                </div>
                <span class="kt-card-list__skeleton-line" />
                <span class="kt-card-list__skeleton-action" />
              </div>
            ))}
          </div>
        );
      }
      return (
        <div
          {...attrs}
          aria-busy={props.loading}
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
