/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import PluginPlatformTaskList from '@test-source/apps/web-antdv-next/src/views/plugin-platform/task/list';
import { describe, expect, it, vi } from 'vitest';

import { isSupportedAdminMenuName } from '#/api/core/menu';
import pluginPlatformRoutes from '#/router/routes/modules/plugin-platform';

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

vi.mock('#/components/kt-table', () => ({
  KtTable: defineComponent({
    name: 'KtTable',
    setup() {
      return () => h('section', { 'data-testid': 'plugin-task-table' });
    },
  }),
  useKtTable: vi.fn(() => [vi.fn(), { reload: vi.fn() }]),
}));

vi.mock('#/api/plugin-platform/task', () => ({
  disablePluginTask: vi.fn(),
  enablePluginTask: vi.fn(),
  getPluginTaskPage: vi.fn(async () => ({ list: [], total: 0 })),
  getPluginTaskRunPage: vi.fn(async () => ({ list: [], total: 0 })),
  runPluginTaskOnce: vi.fn(),
  updatePluginTaskCron: vi.fn(),
}));

describe('plugin platform task page', () => {
  it('renders a single route root and task table shell', () => {
    const wrapper = mount(PluginPlatformTaskList);

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.element.nodeType).toBe(Node.ELEMENT_NODE);
    expect(wrapper.find('[data-testid="plugin-task-table"]').exists()).toBe(
      true,
    );
  });

  it('registers a supported task route under the top-level plugin platform', () => {
    const pluginPlatformRoute = pluginPlatformRoutes.find(
      (route) => route.name === 'PluginPlatform',
    );

    expect(pluginPlatformRoute).toEqual(
      expect.objectContaining({
        name: 'PluginPlatform',
        path: '/plugin-platform',
      }),
    );
    expect(pluginPlatformRoute?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'PluginPlatformTasks',
          path: '/plugin-platform/tasks',
        }),
      ]),
    );
    expect(isSupportedAdminMenuName('PluginPlatformTasks')).toBe(true);
  });
});
