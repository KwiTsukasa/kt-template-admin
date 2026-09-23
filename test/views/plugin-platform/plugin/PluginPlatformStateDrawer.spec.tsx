/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file, vue/require-default-prop */

import type { PluginPlatformApi } from '#/api/plugin-platform/plugin';

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import {
  getBotStatusColor,
  getBotStatusLabel,
} from '@test-source/apps/web-antdv-next/src/views/plugin-platform/modules/status';
import PluginPlatformStateDrawer from '@test-source/apps/web-antdv-next/src/views/plugin-platform/plugin/components/PluginPlatformStateDrawer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('antdv-next', () => ({
  Alert: defineComponent({
    props: { action: null, title: String },
    setup(props) {
      return () => h('div', { role: 'alert' }, [props.title, props.action]);
    },
  }),
  Button: defineComponent({
    props: { disabled: Boolean },
    setup(props, { attrs, slots }) {
      return () =>
        h('button', { ...attrs, disabled: props.disabled }, slots.default?.());
    },
  }),
  Drawer: defineComponent({
    setup(_, { slots }) {
      return () => h('aside', slots.default?.());
    },
  }),
  Tag: defineComponent({
    props: { color: String },
    setup(props, { slots }) {
      return () => h('span', { 'data-color': props.color }, slots.default?.());
    },
  }),
  Popconfirm: defineComponent({
    props: { title: String },
    emits: ['confirm'],
    setup(props, { emit, slots }) {
      return () =>
        h('span', { 'data-confirm-title': props.title }, [
          slots.default?.(),
          h('button', { 'data-confirm-cancel': '' }, '取消'),
          h(
            'button',
            { 'data-confirm-ok': '', onClick: () => emit('confirm') },
            '确认',
          ),
        ]);
    },
  }),
  Space: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  }),
}));

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
    expect(wrapper.text()).toContain('已启用');
    expect(wrapper.text()).toContain('健康');
    expect(wrapper.text()).toContain('插件ID：plugin-1');
    expect(wrapper.text()).toContain('版本ID：version-1');
    wrapper.unmount();
  });

  it('keeps installation actions flat and follows only documented status constraints', async () => {
    const row: PluginPlatformApi.Installation = {
      id: 'installation-1',
      pluginId: 'plugin-1',
      runtimeStatus: 'stopped',
      status: 'enabled',
      versionId: 'version-1',
    };
    const wrapper = mount(PluginPlatformStateDrawer, {
      props: {
        installations: [row],
        intentRevision: 7,
        mode: 'installations',
        open: true,
      },
    });
    const action = (label: string) =>
      wrapper.findAll('button').find((button) => button.text() === label);
    expect(action('启用')?.attributes('disabled')).toBeDefined();
    expect(action('卸载')?.attributes('disabled')).toBeDefined();
    expect(action('禁用')?.attributes('disabled')).toBeUndefined();
    await wrapper.setProps({
      installations: [{ ...row, status: 'disabled' }],
    });
    expect(action('禁用')?.attributes('disabled')).toBeDefined();
    expect(action('启用')?.attributes('disabled')).toBeUndefined();
    expect(action('卸载')?.attributes('disabled')).toBeUndefined();
    expect(
      wrapper.get('[data-confirm-title]').attributes('data-confirm-title'),
    ).toContain('installation-1');
    await wrapper.get('[data-confirm-cancel]').trigger('click');
    expect(wrapper.emitted('installationAction')).toBeUndefined();
    await wrapper.get('[data-confirm-ok]').trigger('click');
    expect(wrapper.emitted('installationAction')?.[0]).toMatchObject([
      { id: 'installation-1', status: 'disabled' },
      'uninstall',
      7,
    ]);
    await wrapper.setProps({
      installations: [{ ...row, status: 'uninstalled' }],
    });
    expect(action('启用')?.attributes('disabled')).toBeUndefined();
    await wrapper.setProps({ pendingInstallationIds: ['installation-1'] });
    expect(action('启用')?.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('处理中');
    await wrapper.setProps({
      allowedInstallationActions: ['enable'],
      pendingInstallationIds: [],
    });
    expect(action('禁用')).toBeUndefined();
    expect(action('卸载')).toBeUndefined();
    wrapper.unmount();
  });

  it('shows an error and retry instead of old rows, and keeps true empty distinct', async () => {
    const wrapper = mount(PluginPlatformStateDrawer, {
      props: {
        error: '安装记录读取失败，请重试。',
        installations: [
          {
            id: 'old',
            pluginId: 'old-plugin',
            runtimeStatus: 'stopped',
            status: 'installed',
            versionId: 'old-version',
          },
        ],
        known: false,
        mode: 'installations',
        open: true,
      },
    });
    expect(wrapper.get('[role="alert"]').text()).toContain('安装记录读取失败');
    expect(wrapper.text()).not.toContain('old-plugin');
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('retry')?.[0]).toEqual(['installations']);
    await wrapper.setProps({ error: '', installations: [], known: true });
    expect(wrapper.text()).toContain('暂无安装记录');
    wrapper.unmount();
  });

  it('maps install and runtime statuses without equating enabled with healthy', () => {
    expect(getBotStatusLabel('uploaded')).toBe('已上传');
    expect(getBotStatusLabel('validated')).toBe('已校验');
    expect(getBotStatusLabel('installed')).toBe('已安装');
    expect(getBotStatusLabel('enabled')).toBe('已启用');
    expect(getBotStatusLabel('disabled')).toBe('已停用');
    expect(getBotStatusLabel('failed')).toBe('失败');
    expect(getBotStatusLabel('uninstalled')).toBe('已卸载');
    expect(getBotStatusLabel('starting')).toBe('启动中');
    expect(getBotStatusLabel('healthy')).toBe('健康');
    expect(getBotStatusLabel('unhealthy')).toBe('异常');
    expect(getBotStatusLabel('stopped')).toBe('已停止');
    expect(getBotStatusLabel('crashed')).toBe('已崩溃');
    expect(getBotStatusLabel('future-status')).toBe('future-status');
    expect(getBotStatusColor('enabled')).toBe('success');
    expect(getBotStatusColor('healthy')).toBe('success');
    expect(getBotStatusColor('unhealthy')).toBe('error');
  });

  it('uses warning for warn events and keeps safe summaries expandable', () => {
    const wrapper = mount(PluginPlatformStateDrawer, {
      props: {
        mode: 'events',
        open: true,
        runtimeEvents: [
          {
            eventType: 'warn-event',
            id: '1',
            level: 'warn',
            pluginId: 'plugin-1',
            safeSummary: { reason: 'safe' },
          },
          {
            eventType: 'info-event',
            id: '2',
            level: 'info',
            pluginId: 'plugin-1',
          },
          {
            eventType: 'error-event',
            id: '3',
            level: 'error',
            pluginId: 'plugin-1',
          },
        ],
      },
    });
    expect(
      wrapper
        .findAll('[data-color]')
        .map((tag) => [tag.text(), tag.attributes('data-color')]),
    ).toEqual([
      ['警告', 'warning'],
      ['信息', 'processing'],
      ['错误', 'error'],
    ]);
    expect(wrapper.get('details summary').text()).toBe('安全摘要');
    expect(wrapper.get('details pre').text()).toContain('safe');
    wrapper.unmount();
  });
});
