import type { VNodeChild } from 'vue';

import { defineComponent } from 'vue';

import { Card } from 'antdv-next';

import './style.scss';

const ACard = Card as any;

export default defineComponent({
  name: 'KtCardListCard',
  inheritAttrs: false,
  setup(_props, { attrs, slots }) {
    return () => {
      let actionBar: VNodeChild = null;
      if (slots.actions) {
        actionBar = (
          <div class="kt-card-list-card__actions">{slots.actions()}</div>
        );
      }
      return (
        <ACard {...attrs} class={['kt-card-list-card', attrs.class]}>
          <div class="kt-card-list-card__content">
            {slots.default?.()}
            {actionBar}
          </div>
        </ACard>
      );
    };
  },
});
