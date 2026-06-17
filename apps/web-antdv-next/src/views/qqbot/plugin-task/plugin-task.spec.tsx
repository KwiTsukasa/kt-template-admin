/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { isSupportedAdminMenuName } from '#/api/core/menu';
import routes from '#/router/routes/modules/qqbot';

import QqBotPluginTaskList from './list';

vi.mock('#/api/request', () => ({
  requestClient: {
    get: vi.fn(),
  },
}));

vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    name: 'MockPage',
    setup(_, { slots }) {
      return () => h('main', slots.default?.());
    },
  }),
}));

vi.mock('antdv-next', () => ({
  Alert: defineComponent({
    name: 'MockAlert',
    setup() {
      return () => h('div');
    },
  }),
  Drawer: defineComponent({
    name: 'MockDrawer',
    setup(_, { slots }) {
      return () => h('aside', slots.default?.());
    },
  }),
  Input: defineComponent({
    name: 'MockInput',
    setup() {
      return () => h('input');
    },
  }),
  Modal: defineComponent({
    name: 'MockModal',
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    },
  }),
  RadioButton: defineComponent({
    name: 'MockRadioButton',
    setup(_, { slots }) {
      return () => h('button', slots.default?.());
    },
  }),
  RadioGroup: defineComponent({
    name: 'MockRadioGroup',
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    },
  }),
  Space: defineComponent({
    name: 'MockSpace',
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    },
  }),
  Tag: defineComponent({
    name: 'MockTag',
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
  message: {
    success: vi.fn(),
  },
}));

vi.mock('#/components/ktTable', () => ({
  KtTable: defineComponent({
    name: 'KtTable',
    setup() {
      return () => h('section', { 'data-testid': 'plugin-task-table' });
    },
  }),
  useKtTable: vi.fn(() => [vi.fn(), { reload: vi.fn() }]),
}));

vi.mock('#/api/qqbot/plugin-task', () => ({
  disableQqbotPluginTask: vi.fn(),
  enableQqbotPluginTask: vi.fn(),
  getQqbotPluginTaskPage: vi.fn(async () => ({ list: [], total: 0 })),
  getQqbotPluginTaskRunPage: vi.fn(async () => ({ list: [], total: 0 })),
  runQqbotPluginTaskOnce: vi.fn(),
  updateQqbotPluginTaskCron: vi.fn(),
}));

describe('qqbot plugin task page', () => {
  it('renders a single route root and task table shell', () => {
    const wrapper = mount(QqBotPluginTaskList);

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.element.nodeType).toBe(Node.ELEMENT_NODE);
    expect(wrapper.find('[data-testid="plugin-task-table"]').exists()).toBe(
      true,
    );
  });

  it('registers a supported QQBot plugin task route', () => {
    const qqbotRoute = routes.find((route) => route.name === 'QqBot');
    expect(qqbotRoute?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'QqBotPluginTask',
          path: '/qqbot/plugin-task',
        }),
      ]),
    );
    expect(isSupportedAdminMenuName('QqBotPluginTask')).toBe(true);
  });
});
