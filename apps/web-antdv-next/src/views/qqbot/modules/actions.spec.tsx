/* eslint-disable vue/one-component-per-file */

import { defineComponent, h, isVNode } from 'vue';

import { describe, expect, it, vi } from 'vitest';

vi.mock('antdv-next', () => ({
  Button: defineComponent({
    name: 'MockButton',
    setup(_, { slots }) {
      return () => h('button', slots.default?.());
    },
  }),
  Popconfirm: defineComponent({
    name: 'MockPopconfirm',
    setup(_, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
  Space: defineComponent({
    name: 'MockSpace',
    setup(_, { slots }) {
      return () => h('div', slots.default?.());
    },
  }),
}));

describe('qqbot shared action renderer', () => {
  it('renders link buttons and preserves action props', async () => {
    const { renderQqbotActions } = await import('./actions');
    const TestIcon = defineComponent({
      name: 'TestIcon',
      setup: () => () => h('i'),
    });
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    const vnode = renderQqbotActions([
      {
        disabled: true,
        icon: TestIcon,
        key: 'edit',
        label: '编辑',
        loading: true,
        onClick: onEdit,
      },
      {
        confirmText: '确认删除吗？',
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: onDelete,
      },
    ]);

    expect(isVNode(vnode)).toBe(true);
    const children = vnode.children as {
      default?: () => unknown[];
    };
    const actionNodes = children.default?.().flat() as any[];
    expect(actionNodes).toHaveLength(2);

    const editButton = actionNodes[0].children[0];
    expect(editButton.props).toMatchObject({
      disabled: true,
      loading: true,
      size: 'small',
      type: 'link',
    });
    expect(isVNode(editButton.props.icon)).toBe(true);
    expect(editButton.props.onClick).toBe(onEdit);

    const deleteConfirm = actionNodes[1];
    expect(deleteConfirm.props.title).toBe('确认删除吗？');
    expect(deleteConfirm.props.onConfirm).toBe(onDelete);

    const confirmSlots = deleteConfirm.children as {
      default?: () => unknown;
    };
    const deleteButton = confirmSlots.default?.() as any;
    expect(deleteButton.props.danger).toBe(true);
    expect(deleteButton.props.onClick).toBeUndefined();
  });
});
