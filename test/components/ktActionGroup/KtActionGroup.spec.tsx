/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import KtActionGroup from '@test-source/apps/web-antdv-next/src/components/ktActionGroup/KtActionGroup';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@antdv-next/icons', () => ({
  EllipsisOutlined: defineComponent({
    name: 'MockEllipsis',
    setup() {
      return () => h('span', { 'data-testid': 'ellipsis' });
    },
  }),
}));

vi.mock('antdv-next', () => ({
  Button: defineComponent({
    name: 'MockButton',
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('button', attrs, slots.default?.());
    },
  }),
  Popover: defineComponent({
    name: 'MockPopover',
    props: {
      title: { default: undefined, type: String },
      trigger: { default: 'click', type: String },
    },
    setup(props, { slots }) {
      return () =>
        h(
          'span',
          {
            'data-popover-title': props.title,
            'data-popover-trigger': props.trigger,
            'data-testid': 'popover',
          },
          [
            slots.default?.(),
            h('span', { 'data-testid': 'popover-content' }, slots.content?.()),
          ],
        );
    },
  }),
}));

function createItem(key: string) {
  return {
    content: h('button', { 'data-action': key }, key),
    key,
  };
}

describe('kt action group', () => {
  it('keeps a fixed balanced action count and moves the remainder into more', () => {
    const wrapper = mount(KtActionGroup, {
      props: {
        items: ['agent', 'view', 'edit', 'discard'].map((key) =>
          createItem(key),
        ),
        layout: 'balanced',
        moreLabel: '更多',
        moreTrigger: 'hover',
        visibleCount: 2,
      },
    });

    expect(wrapper.attributes('data-inline-action-count')).toBe('2');
    expect(wrapper.attributes('data-overflow-action-count')).toBe('2');
    expect(wrapper.attributes('style')).toContain('repeat(3, minmax(0, 1fr))');
    expect(wrapper.get('[aria-label="更多"]').text()).toBe('');
    expect(
      wrapper.get('[aria-label="更多"] .kt-action-group__more-icon').exists(),
    ).toBe(true);
    expect(wrapper.get('[aria-label="更多"]').attributes('type')).toBe('text');
    expect(
      wrapper.get('[aria-label="更多"]').attributes('title'),
    ).toBeUndefined();
    expect(
      wrapper.get('[data-testid="popover"]').attributes('data-popover-title'),
    ).toBeUndefined();
    expect(
      wrapper.get('[data-testid="popover"]').attributes('data-popover-trigger'),
    ).toBe('hover');
    expect(
      wrapper
        .get('[data-testid="popover-content"]')
        .findAll('[data-action]')
        .map((item) => item.text()),
    ).toEqual(['edit', 'discard']);
  });

  it('uses dedicated overflow content without changing the inline action', () => {
    const wrapper = mount(KtActionGroup, {
      props: {
        items: [
          createItem('agent'),
          {
            content: h('button', { 'data-action': 'view' }, 'eye-icon'),
            key: 'view',
            overflowContent: h(
              'button',
              { 'data-overflow-action': 'view' },
              '查看',
            ),
          },
        ],
        layout: 'balanced',
        visibleCount: 1,
      },
    });

    expect(wrapper.get('[data-action="agent"]').exists()).toBe(true);
    expect(wrapper.find('[data-action="view"]').exists()).toBe(false);
    expect(wrapper.get('[data-overflow-action="view"]').text()).toBe('查看');
  });

  it('does not render an empty more trigger', () => {
    const wrapper = mount(KtActionGroup, {
      props: {
        items: [createItem('view')],
        layout: 'balanced',
        moreLabel: '更多',
        visibleCount: 2,
      },
    });

    expect(wrapper.attributes('data-inline-action-count')).toBe('1');
    expect(wrapper.attributes('data-overflow-action-count')).toBe('0');
    expect(wrapper.find('[aria-label="更多"]').exists()).toBe(false);
  });

  it('keeps the more trigger from activating its parent container', async () => {
    const onParentClick = vi.fn();
    const Harness = defineComponent({
      setup() {
        return () =>
          h('div', { onClick: onParentClick }, [
            h(KtActionGroup, {
              items: ['view', 'edit', 'discard'].map((key) => createItem(key)),
              moreLabel: '更多',
              visibleCount: 2,
            }),
          ]);
      },
    });
    const wrapper = mount(Harness);

    await wrapper.get('[aria-label="更多"]').trigger('click');

    expect(onParentClick).not.toHaveBeenCalled();
  });
});
