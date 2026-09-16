import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import EditorHeader from '#/components/kt-automation/EditorHeader';

const access = vi.hoisted(() => ({ codes: new Set<string>() }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.every((code) => access.codes.has(code)),
  }),
}));
vi.mock('@vben/icons', () => ({
  IconifyIcon: defineComponent({ setup: () => () => h('span') }),
}));
vi.mock('antdv-next', async () => ({
  Button: (await import('antdv-next/dist/button/index')).default,
  Input: (await import('antdv-next/dist/input/index')).default,
  Tag: (await import('antdv-next/dist/tag/index')).default,
}));

describe('自动化设计器操作权限', () => {
  it.each([
    { codes: [], save: false, publish: false },
    { codes: ['Edit'], save: true, publish: false },
    { codes: ['Publish'], save: false, publish: false },
    { codes: ['Edit', 'Publish'], save: true, publish: true },
  ])('分别约束编辑和保存后发布：$codes', ({ codes, save, publish }) => {
    access.codes = new Set(codes.map((code) => `Automation:Workflow:${code}`));
    const wrapper = mount(EditorHeader, {
      props: {
        name: '权限验收',
        label: '工作流',
        permission: 'Automation:Workflow',
      },
    });
    const buttons = wrapper.findAll('button');
    const saveButton = buttons.find((button) => button.text() === '保存草稿')!;
    const publishButton = buttons.find(
      (button) => button.text() === '发布版本',
    )!;
    expect(saveButton.attributes('disabled') === undefined).toBe(save);
    expect(publishButton.attributes('disabled') === undefined).toBe(publish);
    expect(wrapper.find('input').attributes('disabled') === undefined).toBe(
      save,
    );
    expect(buttons[0]!.attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });
});
