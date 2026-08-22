/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import PluginPlatformStateDrawer from '@test-source/apps/web-antdv-next/src/views/qqbot/plugin/components/PluginPlatformStateDrawer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('antdv-next', () => ({
  Drawer: defineComponent({
    name: 'MockDrawer',
    setup(_, { slots }) {
      return () => h('aside', slots.default?.());
    },
  }),
  Tag: defineComponent({
    name: 'MockTag',
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
}));

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/qqbot/modules/actions',
  () => ({
    renderQqbotActions: (
      actions: Array<{
        disabled?: boolean;
        key: string;
        label: string;
        onClick: () => void;
      }>,
    ) =>
      h(
        'div',
        actions.map((action) =>
          h(
            'button',
            {
              'data-action-key': action.key,
              disabled: action.disabled,
              onClick: action.onClick,
            },
            action.label,
          ),
        ),
      ),
  }),
);

describe('qqbot plugin platform account bindings', () => {
  it('renders an official Bot as a first-class plugin candidate and emits bind', async () => {
    const binding = {
      accountId: 'account-official',
      accountName: 'Official Bot',
      bound: false,
      connectionMode: 'official-websocket' as const,
      enabled: false,
      id: null,
      pluginId: 'plugin-bangdream',
      pluginKey: 'bangdream',
      pluginName: 'BangDream',
      selfId: 'qq-official:1020000000',
    };
    const wrapper = mount(PluginPlatformStateDrawer, {
      props: {
        accountBindings: [binding],
        mode: 'bindings',
        open: true,
        title: '插件账号绑定',
      },
    });

    expect(wrapper.text()).toContain('官方 WebSocket');
    expect(wrapper.text()).toContain('BangDream');
    expect(wrapper.text()).toContain('Official Bot');
    expect(wrapper.text()).toContain('qq-official:1020000000');

    await wrapper.get('[data-action-key="bind"]').trigger('click');
    expect(wrapper.emitted('accountBindingAction')).toEqual([
      [binding, 'bind'],
    ]);
  });
});
