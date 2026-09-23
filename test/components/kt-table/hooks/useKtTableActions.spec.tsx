/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { useKtTableActions } from '@test-source/apps/web-antdv-next/src/components/kt-table/hooks/useKtTableActions';
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

/**
 * 为行操作和表头按钮建立可控运行环境，复用权限过滤与点击 hook 的真实逻辑。
 * @param rowActions - 本次用例注入的行操作配置。
 * @param options - 可覆盖按钮、默认操作和异步执行器的测试配置。
 * @param options.buttons - 注入的自定义表头按钮，用于与内置按钮比较来源。
 * @param options.reset - 重置按钮调用的异步操作，可模拟请求失败。
 * @param options.runHook - 记录操作前后 hook 的异步回调。
 * @param options.search - 查询按钮调用的异步操作，可模拟请求失败。
 * @param options.showDefaultButtons - 是否生成内置查询和重置按钮。
 * @returns 可直接渲染和执行操作的 KtTable action runtime。
 */
function createActionRuntime(
  rowActions: any[] = [],
  options: {
    buttons?: any[];
    reset?: ReturnType<typeof vi.fn>;
    runHook?: ReturnType<typeof vi.fn>;
    search?: ReturnType<typeof vi.fn>;
    showDefaultButtons?: boolean;
  } = {},
) {
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
      buttons: options.buttons || [],
      modules: [],
      rowActions,
      showDefaultButtons: options.showDefaultButtons || false,
    } as any,
    reload: context.reload,
    reset: options.reset || context.reset,
    runHook: options.runHook || vi.fn(async () => {}),
    search: options.search || context.search,
  });
}

describe('ktTable built-in search event errors', () => {
  it('consumes the UI rejection without calling the success hook', async () => {
    const search = vi.fn(async () => {
      throw new Error('offline');
    });
    const runHook = vi.fn(async (_name: string) => undefined);
    const runtime = createActionRuntime([], {
      runHook,
      search,
      showDefaultButtons: true,
    });
    const searchButton = runtime.formButtons.value.find(
      (button) => button.key === 'search',
    );
    if (!searchButton) throw new Error('缺少内置查询按钮');
    const Harness = defineComponent({
      setup() {
        return () => runtime.renderButton(searchButton);
      },
    });
    const wrapper = mount(Harness);
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(search).toHaveBeenCalledOnce();
    expect(runHook.mock.calls.map((call) => call[0])).toEqual([
      'onBeforeAction',
    ]);
    wrapper.unmount();
  });

  it('keeps a same-key custom button rejection on its original Promise', async () => {
    const custom = vi.fn(async () => {
      throw new Error('custom failed');
    });
    const runHook = vi.fn(async (_name: string) => undefined);
    const runtime = createActionRuntime([], {
      runHook,
      showDefaultButtons: true,
    });
    const node = runtime.renderButton({
      key: 'search',
      label: '自定义',
      onClick: custom,
      operation: 'search',
    });
    const click = node.props?.onClick as () => Promise<void>;
    await expect(click()).rejects.toThrow('custom failed');
    expect(runHook.mock.calls.map((call) => call[0])).toEqual([
      'onBeforeAction',
    ]);
  });

  it('consumes a built-in reset rejection before the success hook', async () => {
    const reset = vi.fn(async () => {
      throw new Error('reset failed');
    });
    const runHook = vi.fn(async (_name: string) => undefined);
    const runtime = createActionRuntime([], {
      reset,
      runHook,
      showDefaultButtons: true,
    });
    const resetButton = runtime.formButtons.value.find(
      (button) => button.key === 'reset',
    );
    if (!resetButton) throw new Error('缺少内置重置按钮');
    const Harness = defineComponent({
      setup() {
        return () => runtime.renderButton(resetButton);
      },
    });
    const wrapper = mount(Harness);
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(reset).toHaveBeenCalledOnce();
    expect(runHook.mock.calls.map((call) => call[0])).toEqual([
      'onBeforeAction',
    ]);
    wrapper.unmount();
  });
});

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
