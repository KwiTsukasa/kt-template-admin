/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { useKtTableActions } from '@test-source/apps/web-antdv-next/src/components/ktTable/hooks/useKtTableActions';
import { describe, expect, it, vi } from 'vitest';

vi.mock('antdv-next', () => ({
  Button: defineComponent({
    name: 'MockButton',
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () =>
        h(
          'button',
          {
            disabled: attrs.disabled,
            onClick: attrs.onClick,
          },
          slots.default?.(),
        );
    },
  }),
  Modal: { confirm: vi.fn() },
  Tooltip: defineComponent({
    name: 'MockTooltip',
    props: { title: String },
    setup(props, { slots }) {
      return () =>
        h('span', { 'data-disabled-reason': props.title }, slots.default?.());
    },
  }),
}));

function createActionRuntime() {
  const context = {
    formApi: {},
    getRows: vi.fn(() => []),
    getSearchValues: vi.fn(async () => ({})),
    registerHook: vi.fn(),
    reload: vi.fn(async () => {}),
    reset: vi.fn(async () => {}),
    search: vi.fn(async () => {}),
    selectedRowKeys: vi.fn(() => []),
    selectedRows: vi.fn(() => []),
    setSearchValues: vi.fn(async () => {}),
    unregisterHook: vi.fn(),
  } as any;

  return useKtTableActions({
    context,
    permissions: {
      filterVisibleActions: (actions: any[]) => actions,
      filterVisibleButtons: (buttons: any[]) => buttons,
      resolveBoolean: (value: unknown, fallback: boolean) =>
        typeof value === 'boolean' ? value : fallback,
    },
    props: {
      buttons: [],
      modules: [],
      rowActions: [],
      showDefaultButtons: false,
    } as any,
    reload: context.reload,
    reset: context.reset,
    runHook: vi.fn(async () => {}),
    search: context.search,
  });
}

describe('ktTable disabled row action reason', () => {
  it('keeps a disabled action visible and exposes its readable reason', async () => {
    const onClick = vi.fn();
    const runtime = createActionRuntime();
    const Harness = defineComponent({
      setup() {
        return () =>
          runtime.renderRowAction(
            {
              disabled: true,
              disabledReason: () => 'TCP 仅支持端口转发 CRUD',
              key: 'keeper',
              label: '启用 Keeper',
              onClick,
            },
            { id: 'tcp-1' },
          );
      },
    });

    const wrapper = mount(Harness);
    expect(wrapper.text()).toContain('启用 Keeper');
    expect(wrapper.get('[data-disabled-reason]').attributes()).toMatchObject({
      'data-disabled-reason': 'TCP 仅支持端口转发 CRUD',
    });
    await wrapper.get('button').trigger('click');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('executes an enabled row action without a disabled tooltip', async () => {
    const onClick = vi.fn();
    const runtime = createActionRuntime();
    const Harness = defineComponent({
      setup() {
        return () =>
          runtime.renderRowAction(
            {
              disabled: false,
              disabledReason: 'not rendered',
              key: 'edit',
              label: '编辑',
              onClick,
            },
            { id: 'udp-1' },
          );
      },
    });

    const wrapper = mount(Harness);
    expect(wrapper.find('[data-disabled-reason]').exists()).toBe(false);
    await wrapper.get('button').trigger('click');
    expect(onClick).toHaveBeenCalledOnce();
  });
});
