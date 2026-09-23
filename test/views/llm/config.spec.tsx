/* eslint-disable vue/multi-word-component-names, vue/one-component-per-file, vue/require-default-prop */
/* @vitest-environment happy-dom */

import type { PropType, VNodeChild } from 'vue';

import type { LlmApi } from '#/api/llm';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import ConfigPage from '@test-source/apps/web-antdv-next/src/views/llm/config/index';
import { message } from 'antdv-next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getLlmConfigs,
  getLlmConfigSummary,
  getLlmProviders,
  testLlmConfig,
} from '#/api/llm';

const state = vi.hoisted(() => ({
  openCreate: vi.fn(),
  openEdit: vi.fn(),
  openView: vi.fn(),
  push: vi.fn(),
}));

vi.mock('vue-router', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    setup(_, { slots }) {
      return () => h('main', slots.default?.());
    },
  }),
}));
vi.mock('@antdv-next/icons', () => ({
  EyeOutlined: defineComponent({ setup: () => () => h('span', 'eye') }),
  MessageOutlined: defineComponent({ setup: () => () => h('span', 'chat') }),
  EllipsisOutlined: defineComponent({ setup: () => () => h('span', 'more') }),
}));
vi.mock('#/api/llm', () => ({
  deleteLlmConfig: vi.fn(),
  getLlmConfigs: vi.fn(),
  getLlmConfigSummary: vi.fn(),
  getLlmProviders: vi.fn(),
  setDefaultLlmConfig: vi.fn(),
  setLlmConfigEnabled: vi.fn(),
  testLlmConfig: vi.fn(),
}));
vi.mock(
  '@test-source/apps/web-antdv-next/src/views/llm/config/components/LlmConfigDrawer',
  () => ({
    default: defineComponent({
      setup(_, { expose }) {
        expose({
          openCreate: state.openCreate,
          openEdit: state.openEdit,
          openView: state.openView,
        });
        return () => h('div');
      },
    }),
  }),
);
vi.mock('#/components/kt-card-list', async () => {
  const listModule =
    await import('@test-source/apps/web-antdv-next/src/components/kt-card-list/KtCardList');
  const cardModule =
    await import('@test-source/apps/web-antdv-next/src/components/kt-card-list/KtCardListCard');
  return {
    KtCardList: listModule.default,
    KtCardListCard: cardModule.default,
  };
});
vi.mock('#/components/kt-table', async () => {
  const groupModule =
    await import('@test-source/apps/web-antdv-next/src/components/kt-action-group/KtActionGroup');
  return { KtActionGroup: groupModule.default };
});
vi.mock('antdv-next', () => {
  const Box = defineComponent({
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, slots.default?.());
    },
  });
  const Button = defineComponent({
    setup(_, { attrs, slots }) {
      return () => h('button', attrs, slots.default?.());
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
    Button,
    Card: defineComponent({
      setup(_, { attrs, slots }) {
        return () => h('article', attrs, slots.default?.());
      },
    }),
    Empty: defineComponent({
      props: { description: String },
      setup(props) {
        return () => h('div', props.description);
      },
    }),
    Input: defineComponent({
      setup(_, { attrs }) {
        return () => h('input', attrs);
      },
    }),
    message: { success: vi.fn() },
    Modal: { confirm: vi.fn() },
    Pagination: defineComponent({
      props: { current: Number, pageSize: Number },
      emits: ['change'],
      setup(props, { emit }) {
        return () =>
          h(
            'div',
            {
              'data-current': props.current,
              'data-page-size': props.pageSize,
            },
            [
              h(
                'button',
                {
                  onClick: () =>
                    emit('change', (props.current ?? 1) + 1, props.pageSize),
                },
                '下一页',
              ),
              h('button', { onClick: () => emit('change', 1, 40) }, '每页40条'),
            ],
          );
      },
    }),
    Popover: defineComponent({
      props: { trigger: { default: 'click', type: String } },
      setup(props, { slots }) {
        return () =>
          h('div', { 'data-popover-trigger': props.trigger }, [
            slots.default?.(),
            h('div', { 'data-overflow': '' }, slots.content?.()),
          ]);
      },
    }),
    Select: defineComponent({
      props: { options: { default: () => [], type: Array as PropType<any[]> } },
      setup(props, { attrs }) {
        return () =>
          h(
            'select',
            attrs,
            props.options.map((item) =>
              h('option', { value: item.value }, item.label),
            ),
          );
      },
    }),
    Space: Box,
    Spin: Box,
    Tag: Box,
    Tooltip: Box,
  };
});

const config = (id: string, name = id): LlmApi.Config => ({
  baseUrl: 'https://api.example.com/v1',
  connectionStatus: 'connected',
  createTime: '2026-09-23T00:00:00Z',
  enabled: true,
  firstTokenLatencyMs: 120,
  hasApiKey: true,
  id,
  isDefault: false,
  lastTestedAt: '2026-09-23T00:00:00Z',
  name,
  provider: 'openai',
  providerLabel: 'OpenAI',
  requiresApiKey: true,
  updateTime: '2026-09-23T00:00:00Z',
});

const providers: LlmApi.ProviderCatalogItem[] = [
  {
    defaultBaseUrl: 'https://api.example.com/v1',
    label: 'OpenAI',
    protocol: 'openai-compatible',
    provider: 'openai',
    requiresApiKey: true,
  },
];
const summary: LlmApi.ConfigSummary = {
  connected: 1,
  disabled: 0,
  error: 0,
  total: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getLlmProviders).mockResolvedValue(providers);
  vi.mocked(getLlmConfigs).mockResolvedValue({
    items: [config('one')],
    total: 1,
  });
  vi.mocked(getLlmConfigSummary).mockResolvedValue(summary);
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('大模型配置卡片页', () => {
  it('初次请求未完成时展示骨架和未确认的全量数量', async () => {
    let resolvePage: (value: LlmApi.PageResult<LlmApi.Config>) => void = () =>
      undefined;
    vi.mocked(getLlmConfigs).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePage = resolve;
        }),
    );
    const wrapper = mount(ConfigPage);
    expect(wrapper.find('.kt-card-list__grid--skeleton').exists()).toBe(true);
    expect(wrapper.text()).toContain('全量配置 —');
    resolvePage({ items: [config('one')], total: 1 });
    await flushPromises();
    expect(wrapper.find('.kt-card-list__grid--skeleton').exists()).toBe(false);
    expect(wrapper.text()).toContain('全量配置 1');
    wrapper.unmount();
  });

  it.each(['providers', 'list', 'summary'])(
    '%s 首次失败后结束加载并可重试',
    async (failed) => {
      if (failed === 'providers')
        vi.mocked(getLlmProviders).mockRejectedValueOnce(new Error('offline'));
      if (failed === 'list')
        vi.mocked(getLlmConfigs).mockRejectedValueOnce(new Error('offline'));
      if (failed === 'summary')
        vi.mocked(getLlmConfigSummary).mockRejectedValueOnce(
          new Error('offline'),
        );
      const wrapper = mount(ConfigPage);
      await flushPromises();
      expect(wrapper.get('[role="alert"]').text()).toContain('配置加载失败');
      expect(wrapper.find('.llm-config-pagination').exists()).toBe(false);
      expect(wrapper.find('.kt-card-list__grid--skeleton').exists()).toBe(
        false,
      );
      expect(wrapper.text()).not.toContain('全量配置 0');
      await wrapper.get('[role="alert"] button').trigger('click');
      await flushPromises();
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.text()).toContain('全量配置 1');
      expect(wrapper.find('.llm-config-pagination').exists()).toBe(true);
      wrapper.unmount();
    },
  );

  it('卡片保留两个直显动作，更多键盘操作不误开详情', async () => {
    const wrapper = mount(ConfigPage);
    await flushPromises();
    const card = wrapper.get('.llm-config-card');
    expect(card.get('h3').text()).toBe('one');
    expect(card.get('.llm-config-card__provider').text()).toBe('OpenAI');
    expect(
      card.get('.kt-action-group').attributes('data-inline-action-count'),
    ).toBe('2');
    expect(
      card.get('[data-popover-trigger]').attributes('data-popover-trigger'),
    ).toBe('click');
    await card.get('[aria-label="更多"]').trigger('keydown', { key: 'Enter' });
    await card.get('[aria-label="更多"]').trigger('keydown', { key: ' ' });
    await card.get('[aria-label="更多"]').trigger('click');
    expect(state.openView).not.toHaveBeenCalled();
    await card.trigger('keydown', { key: 'Enter' });
    await card.trigger('keydown', { key: ' ' });
    expect(state.openView).toHaveBeenCalledTimes(2);
    state.openView.mockClear();
    await card.get('[aria-label="查看详情"]').trigger('click');
    expect(state.openView).toHaveBeenCalledTimes(1);
    await card.get('[aria-label="进入对话"]').trigger('click');
    expect(state.push).toHaveBeenCalledWith({
      name: 'LlmChat',
      params: { configId: 'one' },
      query: { pageKey: 'llm-chat-one' },
    });
    wrapper.unmount();
  });

  it('空页显示准确提示', async () => {
    vi.mocked(getLlmConfigs).mockResolvedValueOnce({ items: [], total: 0 });
    vi.mocked(getLlmConfigSummary).mockResolvedValueOnce({
      ...summary,
      total: 0,
      connected: 0,
    });
    const wrapper = mount(ConfigPage);
    await flushPromises();
    expect(wrapper.text()).toContain('当前筛选条件下没有大模型连接');
    expect(wrapper.text()).toContain('全量配置 0');
    wrapper.unmount();
  });

  it('刷新失败保留上次成功读取的卡片', async () => {
    const wrapper = mount(ConfigPage);
    await flushPromises();
    vi.mocked(getLlmConfigs).mockRejectedValueOnce(new Error('offline'));
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('上次成功读取');
    expect(wrapper.get('.llm-config-card h3').text()).toBe('one');
    expect(wrapper.text()).toContain('全量配置 1');
    wrapper.unmount();
  });

  it('翻页与改页大小失败时保留成功页，重试仍请求失败目标', async () => {
    vi.mocked(getLlmConfigs).mockResolvedValueOnce({
      items: [config('page-one')],
      total: 60,
    });
    const wrapper = mount(ConfigPage);
    await flushPromises();
    vi.mocked(getLlmConfigs).mockRejectedValueOnce(new Error('page offline'));
    await wrapper.get('.llm-config-pagination button').trigger('click');
    await flushPromises();
    expect(wrapper.get('.llm-config-card h3').text()).toBe('page-one');
    expect(
      wrapper
        .get('.llm-config-pagination [data-current]')
        .attributes('data-current'),
    ).toBe('1');
    expect(
      wrapper
        .get('.llm-config-pagination [data-page-size]')
        .attributes('data-page-size'),
    ).toBe('20');
    expect(vi.mocked(getLlmConfigs).mock.lastCall?.[0]).toMatchObject({
      pageNo: 2,
      pageSize: 20,
    });
    vi.mocked(getLlmConfigs).mockResolvedValueOnce({
      items: [config('page-two')],
      total: 60,
    });
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(wrapper.get('.llm-config-card h3').text()).toBe('page-two');
    expect(
      wrapper
        .get('.llm-config-pagination [data-current]')
        .attributes('data-current'),
    ).toBe('2');
    expect(vi.mocked(getLlmConfigs).mock.lastCall?.[0]).toMatchObject({
      pageNo: 2,
      pageSize: 20,
    });

    vi.mocked(getLlmConfigs).mockRejectedValueOnce(new Error('size offline'));
    await wrapper.findAll('.llm-config-pagination button')[1]?.trigger('click');
    await flushPromises();
    expect(wrapper.get('.llm-config-card h3').text()).toBe('page-two');
    expect(
      wrapper
        .get('.llm-config-pagination [data-current]')
        .attributes('data-current'),
    ).toBe('2');
    expect(
      wrapper
        .get('.llm-config-pagination [data-page-size]')
        .attributes('data-page-size'),
    ).toBe('20');
    expect(vi.mocked(getLlmConfigs).mock.lastCall?.[0]).toMatchObject({
      pageNo: 1,
      pageSize: 40,
    });
    vi.mocked(getLlmConfigs).mockResolvedValueOnce({
      items: [config('page-size-40')],
      total: 60,
    });
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(wrapper.get('.llm-config-card h3').text()).toBe('page-size-40');
    expect(
      wrapper
        .get('.llm-config-pagination [data-current]')
        .attributes('data-current'),
    ).toBe('1');
    expect(
      wrapper
        .get('.llm-config-pagination [data-page-size]')
        .attributes('data-page-size'),
    ).toBe('40');
    wrapper.unmount();
  });

  it('连接测试失败后回读错误状态且不显示成功提示', async () => {
    const wrapper = mount(ConfigPage);
    await flushPromises();
    vi.mocked(testLlmConfig).mockRejectedValueOnce(new Error('502'));
    vi.mocked(getLlmConfigs).mockResolvedValueOnce({
      items: [{ ...config('one'), connectionStatus: 'error' }],
      total: 1,
    });
    vi.mocked(getLlmConfigSummary).mockResolvedValueOnce({
      connected: 0,
      disabled: 0,
      error: 1,
      total: 1,
    });
    const testAction = wrapper
      .findAll('[data-overflow] button')
      .find((button) => button.text() === '测试连接');
    await testAction?.trigger('click');
    await flushPromises();
    expect(testLlmConfig).toHaveBeenCalledWith('one');
    expect(wrapper.get('.llm-config-card__status').text()).toContain(
      '连接异常',
    );
    expect(wrapper.text()).toContain('异常 1');
    expect(message.success).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('连接测试后回读失败仍显示刷新错误，成功结果才提示首 Token', async () => {
    const wrapper = mount(ConfigPage);
    await flushPromises();
    vi.mocked(testLlmConfig).mockRejectedValueOnce(new Error('502'));
    vi.mocked(getLlmConfigs).mockRejectedValueOnce(new Error('reload offline'));
    const testAction = wrapper
      .findAll('[data-overflow] button')
      .find((button) => button.text() === '测试连接');
    await testAction?.trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('刷新失败');
    expect(message.success).not.toHaveBeenCalled();

    vi.mocked(testLlmConfig).mockResolvedValueOnce({
      checkedAt: '2026-09-23T00:00:00Z',
      firstTokenLatencyMs: 120,
      latencyMs: 130,
      model: 'test-model',
      preview: 'ok',
    });
    await testAction?.trigger('click');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(message.success).toHaveBeenCalledWith('连接成功，首 Token 120 ms');
    wrapper.unmount();
  });

  it('连接测试在页面卸载后完成时不再发起配置回读', async () => {
    const wrapper = mount(ConfigPage);
    await flushPromises();
    let rejectTest: (reason: Error) => void = () => undefined;
    vi.mocked(testLlmConfig).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectTest = reject;
        }),
    );
    const testAction = wrapper
      .findAll('[data-overflow] button')
      .find((button) => button.text() === '测试连接');
    await testAction?.trigger('click');
    wrapper.unmount();
    rejectTest(new Error('502'));
    await flushPromises();
    expect(getLlmConfigs).toHaveBeenCalledTimes(1);
    expect(message.success).not.toHaveBeenCalled();
  });

  it('只采纳最后一次翻页结果', async () => {
    const wrapper = mount(ConfigPage);
    await flushPromises();
    let resolveOld: (value: LlmApi.PageResult<LlmApi.Config>) => void = () =>
      undefined;
    let resolveNew: (value: LlmApi.PageResult<LlmApi.Config>) => void = () =>
      undefined;
    vi.mocked(getLlmConfigs)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNew = resolve;
          }),
      );
    await wrapper.get('.llm-config-pagination button').trigger('click');
    await wrapper.get('.llm-config-pagination button').trigger('click');
    resolveNew({ items: [config('new')], total: 1 });
    await flushPromises();
    resolveOld({ items: [config('old')], total: 1 });
    await flushPromises();
    expect(wrapper.text()).toContain('new');
    expect(wrapper.text()).not.toContain('old');
    wrapper.unmount();
  });

  it('旧请求失败晚到不回滚较新的成功页', async () => {
    const wrapper = mount(ConfigPage);
    await flushPromises();
    let rejectOld: (reason: Error) => void = () => undefined;
    let resolveNew: (value: LlmApi.PageResult<LlmApi.Config>) => void = () =>
      undefined;
    vi.mocked(getLlmConfigs)
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectOld = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNew = resolve;
          }),
      );
    await wrapper.get('.llm-config-pagination button').trigger('click');
    await wrapper.get('.llm-config-pagination button').trigger('click');
    resolveNew({ items: [config('new')], total: 60 });
    await flushPromises();
    rejectOld(new Error('old request failed'));
    await flushPromises();
    expect(wrapper.get('.llm-config-card h3').text()).toBe('new');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
