/* @vitest-environment happy-dom */

/* eslint-disable vue/one-component-per-file */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import MediaGovernanceTaskFormDrawer from '@test-source/apps/web-antdv-next/src/views/media/governance/tasks/components/MediaGovernanceTaskFormDrawer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const formApi = {
    getValues: vi.fn(),
    resetForm: vi.fn(async () => {}),
    resetValidate: vi.fn(async () => {}),
    setFieldValue: vi.fn(async () => {}),
    setValues: vi.fn(async () => {}),
    validate: vi.fn(async () => ({ valid: true })),
  };
  return {
    create: vi.fn(),
    formApi,
    formOptions: undefined as any,
    warning: vi.fn(),
  };
});

function createRule(): any {
  const rule: any = {};
  for (const method of ['max', 'min', 'trim']) {
    rule[method] = vi.fn(() => rule);
  }
  return rule;
}

vi.mock('#/adapter/form', () => ({
  useVbenForm: vi.fn((options) => {
    mocks.formOptions = options;
    return [
      defineComponent({
        name: 'MockTaskForm',
        setup() {
          return () => h('div');
        },
      }),
      mocks.formApi,
    ];
  }),
  z: { string: vi.fn(createRule) },
}));

vi.mock('#/api/media-governance', () => ({
  createMediaGovernanceTask: mocks.create,
  updateMediaGovernanceTaskIdentity: vi.fn(),
}));

vi.mock('antdv-next', () => {
  const Container = defineComponent({
    name: 'MockContainer',
    setup(_, { slots }) {
      return () => h('div', [slots.default?.(), slots.footer?.()]);
    },
  });
  return {
    Alert: Container,
    Button: defineComponent({
      name: 'MockButton',
      inheritAttrs: false,
      setup(_, { attrs, slots }) {
        return () => h('button', attrs, slots.default?.());
      },
    }),
    Drawer: Container,
    Space: Container,
    Tag: Container,
    message: { success: vi.fn(), warning: mocks.warning },
  };
});

describe('media governance task form drawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({});
  });

  it('clears the hidden TV season when switching to a theatrical task', () => {
    mount(MediaGovernanceTaskFormDrawer);
    mocks.formOptions.handleValuesChange(
      { mediaType: 'theatrical', seasonText: 'S01' },
      ['mediaType'],
    );

    expect(mocks.formApi.setFieldValue).toHaveBeenCalledOnce();
    expect(mocks.formApi.setFieldValue).toHaveBeenCalledWith('seasonText', '');
  });

  it('preserves the season field while the task remains TV', () => {
    mount(MediaGovernanceTaskFormDrawer);
    mocks.formOptions.handleValuesChange(
      { mediaType: 'tv', seasonText: 'S01' },
      ['mediaType'],
    );

    expect(mocks.formApi.setFieldValue).not.toHaveBeenCalled();
  });

  it('submits a theatrical task without the stale hidden TV season', async () => {
    mocks.formApi.getValues.mockResolvedValue({
      mediaType: 'theatrical',
      providerId: '',
      releaseYear: null,
      seasonText: 'S01',
      titleHint: '咒术回战0',
    });
    const wrapper = mount(MediaGovernanceTaskFormDrawer);
    const submitButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '创建任务草稿');
    if (!submitButton) throw new Error('创建任务草稿按钮不存在');

    await submitButton.trigger('click');
    await flushPromises();

    expect(mocks.create).toHaveBeenCalledWith({
      mediaType: 'theatrical',
      titleHint: '咒术回战0',
    });
    expect(mocks.warning).not.toHaveBeenCalled();
  });
});
