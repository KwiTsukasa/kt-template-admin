/* @vitest-environment happy-dom */

import { readFileSync } from 'node:fs';

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import KtCardList from '@test-source/apps/web-antdv-next/src/components/kt-card-list/KtCardList';
import { describe, expect, it, vi } from 'vitest';

const CARD_LIST_STYLE = readFileSync(
  'apps/web-antdv-next/src/components/kt-card-list/style.scss',
  'utf8',
);

vi.mock('antdv-next', () => ({
  Empty: defineComponent({
    name: 'MockEmpty',
    props: { description: { default: '', type: String } },
    setup(props) {
      return () =>
        h('div', { 'data-testid': 'card-list-empty' }, props.description);
    },
  }),
}));

describe('kt card list', () => {
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

  it('exposes only the controlled compact density variant', () => {
    const wrapper = mount(KtCardList, {
      props: { itemCount: 1, variant: 'compact' },
      slots: { default: () => h('article', { 'data-card': 'compact' }) },
    });

    expect(wrapper.classes()).toContain('kt-card-list--compact');
    expect(wrapper.attributes('data-variant')).toBe('compact');
    expect(wrapper.findAll('[data-card="compact"]')).toHaveLength(1);
    expect(CARD_LIST_STYLE).toContain('--kt-card-list-item-max-width: 420px');
    expect(CARD_LIST_STYLE).toContain('--kt-card-list-item-max-width: 200px');
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

    for (const source of sources) expect(source).toContain('<AKtCardList');
    expect(detailSource.match(/<AKtCardList/gu)).toHaveLength(2);
    expect(detailSource).toContain('variant="compact"');
    for (const style of surfaceStyles) expect(style).not.toContain('auto-fill');
  });
});
