/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file */

import { readFileSync } from 'node:fs';

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import KtCardList from '@test-source/apps/web-antdv-next/src/components/kt-card-list/KtCardList';
import KtCardListCard from '@test-source/apps/web-antdv-next/src/components/kt-card-list/KtCardListCard';
import { describe, expect, it, vi } from 'vitest';

const CARD_LIST_STYLE = readFileSync(
  'apps/web-antdv-next/src/components/kt-card-list/style.scss',
  'utf8',
);

vi.mock('antdv-next', () => ({
  Card: defineComponent({
    name: 'MockCard',
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('article', attrs, slots.default?.());
    },
  }),
  Empty: defineComponent({
    name: 'MockEmpty',
    props: { description: { default: '', type: String } },
    setup(props) {
      return () =>
        h('div', { 'data-testid': 'card-list-empty' }, props.description);
    },
  }),
  Spin: defineComponent({
    name: 'MockSpin',
    props: { spinning: Boolean },
    setup(props, { slots }) {
      return () =>
        h(
          'div',
          {
            'data-spinning': String(props.spinning),
            'data-testid': 'card-list-spin',
          },
          slots.default?.(),
        );
    },
  }),
}));

describe('kt card list', () => {
  it('fills the available width without fixing a card maximum or row count', () => {
    expect(CARD_LIST_STYLE).toContain('width: 100%');
    expect(CARD_LIST_STYLE).toContain('margin-inline: 0');
    expect(CARD_LIST_STYLE).not.toContain('margin-inline: auto');
    expect(CARD_LIST_STYLE).not.toContain('content-max-width');
    expect(CARD_LIST_STYLE).not.toContain('item-max-width');
    expect(CARD_LIST_STYLE).toContain(
      'minmax(min(100%, var(--kt-card-list-item-min-width)), 1fr)',
    );
  });

  it('renders summary and cards inside the fixed default grid', () => {
    const wrapper = mount(KtCardList, {
      attrs: { class: 'business-board' },
      props: { itemCount: 2 },
      slots: {
        default: () => [
          h('article', { 'data-card': 'one' }),
          h('article', { 'data-card': 'two' }),
        ],
        summary: () => h('header', { 'data-testid': 'summary' }),
      },
    });

    expect(wrapper.classes()).toContain('kt-card-list--default');
    expect(wrapper.classes()).toContain('business-board');
    expect(wrapper.attributes('data-item-count')).toBe('2');
    expect(
      wrapper.get('.kt-card-list__summary [data-testid="summary"]'),
    ).toBeTruthy();
    expect(wrapper.findAll('.kt-card-list__grid [data-card]')).toHaveLength(2);
    expect(wrapper.find('[data-testid="card-list-empty"]').exists()).toBe(
      false,
    );
  });

  it('owns the empty state and does not render stale card slots', () => {
    const wrapper = mount(KtCardList, {
      props: {
        emptyDescription: '当前筛选没有数据',
        itemCount: 0,
      },
      slots: {
        default: () => h('article', { 'data-card': 'stale' }),
      },
    });

    expect(wrapper.get('[data-testid="card-list-empty"]').text()).toBe(
      '当前筛选没有数据',
    );
    expect(wrapper.find('[data-card="stale"]').exists()).toBe(false);
  });

  it('renders responsive card skeletons instead of flashing the empty state', () => {
    const wrapper = mount(KtCardList, {
      props: { itemCount: 0, loading: true },
    });

    expect(wrapper.attributes('aria-busy')).toBe('true');
    expect(wrapper.findAll('.kt-card-list__skeleton-card')).toHaveLength(8);
    expect(wrapper.find('[data-testid="card-list-empty"]').exists()).toBe(
      false,
    );
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe(
      '正在加载卡片数据',
    );
  });

  it('keeps existing cards visible under a refresh loading mask', () => {
    const wrapper = mount(KtCardList, {
      props: { itemCount: 1, loading: true },
      slots: { default: () => h('article', { 'data-card': 'existing' }) },
    });

    expect(wrapper.findAll('[data-card="existing"]')).toHaveLength(1);
    expect(
      wrapper.get('[data-testid="card-list-spin"]').attributes(),
    ).toMatchObject({ 'data-spinning': 'true' });
    expect(wrapper.find('.kt-card-list__skeleton-card').exists()).toBe(false);
  });

  it('encapsulates the media-governance action bar for every card surface', () => {
    const wrapper = mount(KtCardListCard, {
      slots: {
        actions: () => h('button', { 'data-testid': 'card-action' }),
        default: () => h('span', { 'data-testid': 'card-content' }),
      },
    });

    expect(wrapper.classes()).toContain('kt-card-list-card');
    expect(wrapper.get('.kt-card-list-card__content')).toBeTruthy();
    expect(wrapper.get('.kt-card-list-card__actions')).toBeTruthy();
    expect(wrapper.get('[data-testid="card-content"]')).toBeTruthy();
    expect(wrapper.get('[data-testid="card-action"]')).toBeTruthy();
    expect(CARD_LIST_STYLE).toContain('margin: auto -24px -24px');
    expect(CARD_LIST_STYLE).toContain('min-height: 44px');
  });

  it('exposes only the controlled compact density variant', () => {
    const wrapper = mount(KtCardList, {
      props: { itemCount: 1, variant: 'compact' },
      slots: { default: () => h('article', { 'data-card': 'compact' }) },
    });

    expect(wrapper.classes()).toContain('kt-card-list--compact');
    expect(wrapper.attributes('data-variant')).toBe('compact');
    expect(wrapper.findAll('[data-card="compact"]')).toHaveLength(1);
    expect(CARD_LIST_STYLE).toContain('--kt-card-list-item-min-width: 300px');
    expect(CARD_LIST_STYLE).toContain('--kt-card-list-item-min-width: 152px');
  });

  it('owns every audited dynamic card-list grid', () => {
    const sources = [
      'apps/web-antdv-next/src/views/media/governance/series/list.tsx',
      'apps/web-antdv-next/src/views/media/governance/tasks/list.tsx',
      'apps/web-antdv-next/src/views/llm/config/index.tsx',
    ].map((file) => readFileSync(file, 'utf8'));
    const detailSource = readFileSync(
      'apps/web-antdv-next/src/views/media/governance/series/detail.tsx',
      'utf8',
    );
    const surfaceStyles = [
      'apps/web-antdv-next/src/views/media/governance/series/list.scss',
      'apps/web-antdv-next/src/views/media/governance/tasks/list.scss',
      'apps/web-antdv-next/src/views/llm/config/index.scss',
      'apps/web-antdv-next/src/views/media/governance/series/detail.scss',
    ].map((file) => readFileSync(file, 'utf8'));

    for (const source of sources) {
      expect(source).toContain('<AKtCardList');
      expect(source).toContain('<AKtCardListCard');
      expect(source).toContain('loading={');
    }
    expect(detailSource.match(/<AKtCardList(?:\s|>)/gu) || []).toHaveLength(0);
    expect(detailSource).toContain('<AKtCardListCard');
    expect(detailSource).toContain('<AKtTable');
    expect(detailSource).not.toContain('virtual');
    for (const style of surfaceStyles) expect(style).not.toContain('auto-fill');
  });
});
