/* @vitest-environment happy-dom */

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import PluginPlatformStateDrawer from '@test-source/apps/web-antdv-next/src/views/plugin-platform/plugin/components/PluginPlatformStateDrawer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('antdv-next', () => ({
  Drawer: defineComponent({
    setup(_, { slots }) {
      return () => h('aside', slots.default?.());
    },
  }),
  Tag: defineComponent({
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
}));

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/plugin-platform/modules/actions',
  () => ({
    renderBotActions: () => h('div'),
  }),
);

describe('plugin platform state drawer', () => {
  it('renders installation state without any adapter account binding surface', () => {
    const wrapper = mount(PluginPlatformStateDrawer, {
      props: {
        installations: [
          {
            id: 'installation-1',
            pluginId: 'plugin-1',
            runtimeStatus: 'healthy',
            status: 'enabled',
            versionId: 'version-1',
          },
        ],
        mode: 'installations',
        open: true,
        title: '插件安装记录',
      },
    });

    expect(wrapper.text()).toContain('plugin-1');
    expect(wrapper.text()).not.toContain('账号绑定');
  });
});
