/* eslint-disable vue/multi-word-component-names, vue/one-component-per-file, vue/require-default-prop */
/* @vitest-environment happy-dom */

import type { VNodeChild } from 'vue';

import type { BotApi } from '#/api/bot';
import type { TencentBotApi } from '#/api/bot/tencent';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import TencentList from '@test-source/apps/web-antdv-next/src/views/bot/tencent/list';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bind: vi.fn(),
  form: undefined as any,
  formApi: {
    getValues: vi.fn(async () => ({})),
    resetForm: vi.fn(async () => undefined),
    resetValidate: vi.fn(),
    setValues: vi.fn(async () => undefined),
    validate: vi.fn(async () => ({ valid: true })),
  },
  getBindings: vi.fn(),
  modalOptions: [] as any[],
  success: vi.fn(),
  table: undefined as any,
  unbind: vi.fn(),
}));

vi.mock('#/api/bot/tencent', () => ({
  bindTencentPlugin: mocks.bind,
  deleteTencentBot: vi.fn(),
  getTencentBotList: vi.fn(),
  getTencentPluginBindings: mocks.getBindings,
  getTencentWebhookUrl: vi.fn(),
  reconnectTencentBot: vi.fn(),
  saveTencentBot: vi.fn(),
  syncTencentMenu: vi.fn(),
  unbindTencentPlugin: mocks.unbind,
  updateTencentBot: vi.fn(),
}));
vi.mock('#/adapter/form', () => ({
  useVbenForm: (options: any) => {
    mocks.form = options;
    return [defineComponent({ setup: () => () => h('form') }), mocks.formApi];
  },
}));
vi.mock('@vben/icons', () => ({
  IconifyIcon: defineComponent({ setup: () => () => h('i') }),
  Plus: defineComponent({ setup: () => () => h('i') }),
}));
vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    setup(_, { slots }) {
      return () => h('main', slots.default?.());
    },
  }),
  useVbenModal: (options: any) => {
    const index = mocks.modalOptions.push(options) - 1;
    const data: { value: any } = { value: {} };
    const api = {
      close: vi.fn(() => options.onOpenChange?.(false)),
      getData: () => data.value,
      open: vi.fn(() => options.onOpenChange?.(true)),
      setData: vi.fn((value: any) => {
        data.value = value;
      }),
    };
    return [
      defineComponent({
        props: { title: String },
        setup(props, { slots }) {
          return () =>
            h('section', { 'data-modal': index }, [
              h('h2', props.title),
              slots.default?.(),
            ]);
        },
      }),
      api,
    ];
  },
}));
vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({ setup: () => () => h('div') }),
  useKtTable: (options: any) => {
    mocks.table = options;
    return [vi.fn(), { reload: vi.fn(async () => undefined) }];
  },
}));
vi.mock('antdv-next', () => {
  const Box = defineComponent({
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  });
  return {
    Alert: defineComponent({
      props: { action: Object, title: String },
      setup(props) {
        return () =>
          h('div', { role: 'alert' }, [
            props.title,
            props.action as VNodeChild,
          ]);
      },
    }),
    Button: defineComponent({
      setup(_, { attrs, slots }) {
        return () => h('button', attrs, slots.default?.());
      },
    }),
    Empty: defineComponent({
      props: { description: String },
      setup(props) {
        return () => h('div', { 'data-empty': '' }, props.description);
      },
    }),
    message: { success: mocks.success },
    Spin: defineComponent({
      props: { spinning: Boolean },
      setup(props, { slots }) {
        return () =>
          h(
            'div',
            { 'data-spinning': String(props.spinning) },
            slots.default?.(),
          );
      },
    }),
    Switch: defineComponent({
      props: { checked: Boolean, disabled: Boolean },
      emits: ['change'],
      setup(props, { emit }) {
        return () =>
          h(
            'button',
            {
              'data-bound': String(props.checked),
              'data-disabled': String(props.disabled),
              onClick: () => {
                if (!props.disabled) emit('change', !props.checked);
              },
            },
            '切换插件',
          );
      },
    }),
    Tag: Box,
    Typography: { Text: Box },
  };
});

const account = (id: string, name = id): BotApi.Account => ({
  connectStatus: 'online',
  connectionMode: 'official-websocket',
  enabled: true,
  id,
  name,
  officialAppId: `app-${id}`,
  selfId: `self-${id}`,
});
const binding = (
  accountId: string,
  bound = false,
): TencentBotApi.PluginBinding => ({
  accountId,
  bound,
  operationCount: 1,
  pluginKey: 'sample',
  pluginName: `插件 ${accountId}`,
  triggerMode: 'command',
  version: '1.0.0',
});

/**
 * 读取表格配置中的插件能力动作，避免测试依赖其它业务入口。
 * @returns 插件能力行操作。
 */
function pluginAction() {
  return mocks.table.rowActions.find(
    (action: { key: string }) => action.key === 'plugins',
  );
}

/**
 * 构造可手动完成的请求以验证不同账号响应顺序。
 * @returns Promise及对应完成函数。
 */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.modalOptions = [];
  mocks.getBindings.mockResolvedValue([]);
  mocks.bind.mockResolvedValue({});
  mocks.unbind.mockResolvedValue({});
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('tencent 插件弹窗归属', () => {
  it('旧 A 请求先返回时不能清除 B 的加载状态', async () => {
    const readA = deferred<TencentBotApi.PluginBinding[]>();
    const readB = deferred<TencentBotApi.PluginBinding[]>();
    mocks.getBindings.mockImplementationOnce(() => readA.promise);
    mocks.getBindings.mockImplementationOnce(() => readB.promise);
    const wrapper = mount(TencentList);
    pluginAction().onClick(account('A'));
    pluginAction().onClick(account('B'));
    readA.resolve([binding('A')]);
    await flushPromises();
    expect(
      wrapper
        .get('[data-modal="1"] [data-spinning]')
        .attributes('data-spinning'),
    ).toBe('true');
    expect(wrapper.get('[data-modal="1"] h2').text()).toContain('B');
    expect(wrapper.text()).not.toContain('插件 A');
    readB.resolve([binding('B')]);
    await flushPromises();
    expect(
      wrapper
        .get('[data-modal="1"] [data-spinning]')
        .attributes('data-spinning'),
    ).toBe('false');
    expect(wrapper.text()).toContain('插件 B');
    expect(wrapper.text()).not.toContain('插件 A');
    wrapper.unmount();
  });

  it('当 B 先完成后迟到的 A 结果不能覆盖 B 的绑定', async () => {
    const readA = deferred<TencentBotApi.PluginBinding[]>();
    const readB = deferred<TencentBotApi.PluginBinding[]>();
    mocks.getBindings.mockImplementationOnce(() => readA.promise);
    mocks.getBindings.mockImplementationOnce(() => readB.promise);
    const wrapper = mount(TencentList);
    pluginAction().onClick(account('A'));
    pluginAction().onClick(account('B'));
    readB.resolve([binding('B')]);
    await flushPromises();
    readA.resolve([binding('A')]);
    await flushPromises();
    expect(wrapper.get('[data-modal="1"] h2').text()).toContain('B');
    expect(wrapper.get('[data-bound]').attributes('data-bound')).toBe('false');
    expect(wrapper.text()).toContain('插件 B');
    expect(wrapper.text()).not.toContain('插件 A');
    wrapper.unmount();
  });

  it('关闭再打开同一账号后拒绝上一次读取，标题无名称时回退 AppID', async () => {
    const first = deferred<TencentBotApi.PluginBinding[]>();
    const second = deferred<TencentBotApi.PluginBinding[]>();
    mocks.getBindings.mockImplementationOnce(() => first.promise);
    mocks.getBindings.mockImplementationOnce(() => second.promise);
    const wrapper = mount(TencentList);
    pluginAction().onClick(account('A', ''));
    mocks.modalOptions[1].onOpenChange(false);
    pluginAction().onClick(account('A', ''));
    second.resolve([binding('A', true)]);
    await flushPromises();
    first.resolve([binding('A', false)]);
    await flushPromises();
    expect(wrapper.get('[data-modal="1"] h2').text()).toContain('app-A');
    expect(wrapper.get('[data-bound]').attributes('data-bound')).toBe('true');
    wrapper.unmount();
  });

  it('读取失败清除旧账号列表，可重试到成功空态', async () => {
    mocks.getBindings.mockResolvedValueOnce([binding('A')]);
    mocks.getBindings.mockRejectedValueOnce(new Error('offline'));
    mocks.getBindings.mockResolvedValueOnce([]);
    const wrapper = mount(TencentList);
    pluginAction().onClick(account('A'));
    await flushPromises();
    pluginAction().onClick(account('B'));
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('读取失败');
    expect(wrapper.text()).not.toContain('插件 A');
    expect(wrapper.get('[data-spinning]').attributes('data-spinning')).toBe(
      'false',
    );
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.get('[data-empty]').text()).toBe('暂无插件能力');
    wrapper.unmount();
  });

  it('当 A 写入晚完成时不改变当前 B 的绑定列表', async () => {
    const writeA = deferred<unknown>();
    mocks.getBindings.mockResolvedValueOnce([binding('A')]);
    mocks.getBindings.mockResolvedValueOnce([binding('B')]);
    mocks.bind.mockImplementationOnce(() => writeA.promise);
    const wrapper = mount(TencentList);
    pluginAction().onClick(account('A'));
    await flushPromises();
    await wrapper.get('[data-bound]').trigger('click');
    pluginAction().onClick(account('B'));
    await flushPromises();
    writeA.resolve({});
    await flushPromises();
    expect(mocks.bind).toHaveBeenCalledWith('A', 'sample');
    expect(mocks.getBindings).toHaveBeenCalledTimes(2);
    expect(wrapper.get('[data-modal="1"] h2').text()).toContain('B');
    expect(wrapper.text()).toContain('插件 B');
    expect(wrapper.text()).not.toContain('插件 A');
    wrapper.unmount();
  });

  it('关闭重开同一账号后在途写入完成会回读新会话事实', async () => {
    const writeA = deferred<unknown>();
    mocks.getBindings.mockResolvedValueOnce([binding('A')]);
    mocks.getBindings.mockResolvedValueOnce([binding('B')]);
    mocks.getBindings.mockResolvedValueOnce([binding('A')]);
    mocks.getBindings.mockResolvedValueOnce([binding('A', true)]);
    mocks.bind.mockImplementationOnce(() => writeA.promise);
    const wrapper = mount(TencentList);
    pluginAction().onClick(account('A'));
    await flushPromises();
    await wrapper.get('[data-bound]').trigger('click');
    expect(mocks.bind).toHaveBeenCalledWith('A', 'sample');
    pluginAction().onClick(account('B'));
    await flushPromises();
    expect(wrapper.text()).toContain('插件 B');
    mocks.modalOptions[1].onOpenChange(false);
    pluginAction().onClick(account('A'));
    await flushPromises();
    expect(wrapper.get('[data-spinning]').attributes('data-spinning')).toBe(
      'true',
    );
    expect(wrapper.get('[data-bound]').attributes('data-disabled')).toBe(
      'true',
    );
    writeA.resolve({});
    await flushPromises();
    expect(mocks.getBindings).toHaveBeenLastCalledWith('A');
    expect(wrapper.get('[data-bound]').attributes('data-bound')).toBe('true');
    expect(wrapper.get('[data-spinning]').attributes('data-spinning')).toBe(
      'false',
    );
    wrapper.unmount();
  });

  it('绑定失败仍回读当前账号，错误由 HTTP 层处理且不显示成功', async () => {
    mocks.getBindings.mockResolvedValueOnce([binding('A')]);
    mocks.getBindings.mockResolvedValueOnce([binding('A', false)]);
    mocks.bind.mockRejectedValueOnce(new Error('403'));
    const wrapper = mount(TencentList);
    pluginAction().onClick(account('A'));
    await flushPromises();
    await wrapper.get('[data-bound]').trigger('click');
    await flushPromises();
    expect(mocks.getBindings).toHaveBeenCalledTimes(2);
    expect(wrapper.get('[data-bound]').attributes('data-bound')).toBe('false');
    expect(mocks.success).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('卸载后的迟到读取和写入均不触发新回读', async () => {
    const read = deferred<TencentBotApi.PluginBinding[]>();
    mocks.getBindings.mockImplementationOnce(() => read.promise);
    const reading = mount(TencentList);
    pluginAction().onClick(account('A'));
    reading.unmount();
    read.resolve([binding('A')]);
    await flushPromises();
    expect(mocks.getBindings).toHaveBeenCalledTimes(1);

    mocks.getBindings.mockResolvedValueOnce([binding('B')]);
    const write = deferred<unknown>();
    mocks.bind.mockImplementationOnce(() => write.promise);
    const writing = mount(TencentList);
    pluginAction().onClick(account('B'));
    await flushPromises();
    await writing.get('[data-bound]').trigger('click');
    writing.unmount();
    write.resolve({});
    await flushPromises();
    expect(mocks.getBindings).toHaveBeenCalledTimes(2);
  });

  it('保留权限与 Webhook 条件，并阻止管理登录自动填入 AppID/AppSecret', async () => {
    const wrapper = mount(TencentList);
    const actions = mocks.table.rowActions;
    expect(actions.map((action: { key: string }) => action.key)).toEqual([
      'plugins',
      'reconnect',
      'menu-sync',
      'webhook-url',
      'edit',
      'delete',
    ]);
    expect(actions[0].permissionCodes).toEqual(['Bot:Tencent:Plugin']);
    expect(actions[3].permissionCodes).toEqual(['Bot:Tencent:WebhookUrl']);
    expect(actions[3].rowVisible(account('A'))).toBe(false);
    expect(
      actions[3].rowVisible({
        ...account('A'),
        connectionMode: 'official-webhook',
      }),
    ).toBe(true);
    expect(actions[5].confirm(account('A', ''))).toContain('app-A');
    const appId = mocks.form.schema.find(
      (field: { fieldName: string }) => field.fieldName === 'appId',
    );
    const secret = mocks.form.schema.find(
      (field: { fieldName: string }) => field.fieldName === 'appSecret',
    );
    expect(appId.componentProps.autocomplete).toBe('off');
    expect(secret.componentProps().autocomplete).toBe('new-password');
    expect(secret.componentProps().placeholder).toContain('AppSecret');
    actions[4].onClick(account('A'));
    expect(secret.componentProps().placeholder).toContain('留空表示不修改');
    wrapper.unmount();
  });
});
