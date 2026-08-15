/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { useKtTableActions } from '@test-source/apps/web-antdv-next/src/components/ktTable/hooks/useKtTableActions';
import { Modal } from 'antdv-next';
import { describe, expect, it, vi } from 'vitest';

vi.mock('#/locales', () => ({
  $t: (key: string) =>
    ({ 'common.cancel': '取消', 'common.confirm': '确认' })[key] || key,
}));

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

function createActionRuntime(rowActions: any[] = []) {
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
      rowActions,
      showDefaultButtons: false,
    } as any,
    reload: context.reload,
    reset: context.reset,
    runHook: vi.fn(async () => {}),
    search: context.search,
  });
}

describe('ktTable action availability strategy', () => {
  it('fails closed when one action group mixes visibility and disabled states', () => {
    const runtime = createActionRuntime([
      { key: 'view', label: '查看', rowVisible: true },
      { disabled: true, key: 'delete', label: '删除' },
    ]);

    expect(() => runtime.rowActions.value).toThrow(
      'KtTable rowActions 不能同时使用 disabled 与 visible/rowVisible',
    );
  });

  it('accepts a visibility-only action group', () => {
    const runtime = createActionRuntime([
      { key: 'view', label: '查看', rowVisible: true },
      { key: 'delete', label: '删除', rowVisible: false },
    ]);

    expect(runtime.rowActions.value).toHaveLength(2);
  });

  it('accepts a disabled-only action group', () => {
    const runtime = createActionRuntime([
      { disabled: false, key: 'edit', label: '编辑' },
      { disabled: true, key: 'delete', label: '删除' },
    ]);

    expect(runtime.rowActions.value).toHaveLength(2);
  });
});

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

  it('uses localized labels in the shared row action confirmation', async () => {
    const runtime = createActionRuntime();
    const Harness = defineComponent({
      setup() {
        return () =>
          runtime.renderRowAction(
            {
              confirm: () => '确认删除这条空草稿吗？',
              key: 'delete',
              label: '删除空草稿',
              onClick: vi.fn(),
            },
            { id: 'draft-1' },
          );
      },
    });

    const wrapper = mount(Harness);
    await wrapper.get('button').trigger('click');

    expect(Modal.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelText: '取消',
        content: '确认删除这条空草稿吗？',
        okText: '确认',
        title: '删除空草稿',
      }),
    );
  });
});
