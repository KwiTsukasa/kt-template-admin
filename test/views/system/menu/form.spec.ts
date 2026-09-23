/* eslint-disable vue/one-component-per-file */
/* @vitest-environment happy-dom */

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import MenuForm from '@test-source/apps/web-antdv-next/src/views/system/menu/modules/form.vue';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  form: vi.fn(),
  menuList: vi.fn(),
}));

vi.mock('#/adapter/form', () => {
  const rule: Record<string, any> = {};
  for (const method of ['max', 'min', 'optional', 'refine', 'url']) {
    rule[method] = () => rule;
  }
  return {
    useVbenForm: (options: unknown) => {
      mocks.form(options);
      return [
        defineComponent({ setup: () => () => h('form') }),
        { getValues: vi.fn(), resetForm: vi.fn(), setValues: vi.fn() },
      ];
    },
    z: { string: () => rule },
  };
});
vi.mock('#/api/system/menu', () => ({
  createMenu: vi.fn(),
  getMenuList: mocks.menuList,
  isMenuNameExists: vi.fn(),
  isMenuPathExists: vi.fn(),
  SystemMenuApi: { BadgeVariants: [] },
  updateMenu: vi.fn(),
}));
vi.mock('#/router/routes', () => ({ componentKeys: [] }));
vi.mock('#/locales', () => ({
  $t: (key: string) => {
    if (key === 'system.title') return '系统管理';
    if (key === 'system.user.title') return '用户管理';
    return key;
  },
}));
vi.mock('@vben/common-ui', () => ({
  useVbenDrawer: () => [
    defineComponent({ setup: () => () => h('div') }),
    { getData: vi.fn(), lock: vi.fn(), unlock: vi.fn() },
  ],
}));

describe('menu parent tree labels', () => {
  it('projects translated labels for options and selected id without rewriting stored titles', async () => {
    const wrapper = mount(MenuForm);
    const schema = (mocks.form.mock.lastCall?.[0] as any).schema as any[];
    const parent = schema.find((field) => field.fieldName === 'pid');
    const raw = [
      {
        children: [{ id: 'child-id', meta: { title: 'system.user.title' } }],
        id: 'parent-id',
        meta: { title: 'system.title' },
      },
    ];
    const projected = await parent.componentProps.afterFetch(raw);
    expect(parent.componentProps.labelField).toBe('displayTitle');
    expect(parent.componentProps.valueField).toBe('id');
    expect(projected[0]).toMatchObject({
      displayTitle: '系统管理',
      id: 'parent-id',
      meta: { title: 'system.title' },
    });
    expect(projected[0].children[0]).toMatchObject({
      displayTitle: '用户管理',
      id: 'child-id',
      meta: { title: 'system.user.title' },
    });
    expect(
      parent.componentProps.filterTreeNode('系统管理', {
        label: projected[0].displayTitle,
        meta: projected[0].meta,
      }),
    ).toBe(true);
    const title = parent.renderComponentContent().title({
      label: projected[0].displayTitle,
      meta: projected[0].meta,
    });
    expect(title.children[0].children).toBe('系统管理');
    wrapper.unmount();
  });
});
