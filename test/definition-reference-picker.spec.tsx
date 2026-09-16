import { flushPromises, mount } from '@vue/test-utils';
import { Select } from 'antdv-next';
import { describe, expect, it, vi } from 'vitest';

import ReferencePicker from '#/components/kt-definition-list/ReferencePicker';

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('antdv-next', async () => ({
  Select: (await import('antdv-next/dist/select/index')).default,
  Alert: (await import('antdv-next/dist/alert/index')).default,
  Button: (await import('antdv-next/dist/button/index')).default,
  Space: (await import('antdv-next/dist/space/index')).default,
}));

const makeApi = (versions: unknown[]) => ({
  page: vi.fn().mockResolvedValue({ list: [{ id: 'flow', name: '流程' }] }),
  versions: vi.fn().mockResolvedValue(versions),
  detail: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  publish: vi.fn(),
  version: vi.fn(),
});
const versionError = (version: any) => {
  if (version.definition.business) return '仅限业务入口';
  return undefined;
};

describe('发布资源版本准入', () => {
  it('最新版本不可用于定时时保留可用旧版本，并拒绝直接选择不可用版本', async () => {
    const api = makeApi([
      { version: 2, definition: { business: true } },
      { version: 1, definition: { business: false } },
    ]);
    const wrapper = mount(ReferencePicker, {
      props: { api, label: '工作流', basePath: '/workflows', versionError },
    });
    await flushPromises();
    const controls = wrapper.findAllComponents(Select);
    controls[0]!.vm.$emit('change', 'flow');
    await flushPromises();
    expect(wrapper.emitted('change')).toEqual([
      [null],
      [{ id: 'flow', version: 1 }],
    ]);
    expect(controls[1]!.props('options')).toEqual([
      { label: 'v2（仅限业务入口）', value: 2, disabled: true },
      { label: 'v1', value: 1, disabled: false },
    ]);
    controls[1]!.vm.$emit('change', 2);
    await flushPromises();
    expect(wrapper.emitted('change')).toHaveLength(2);
    wrapper.unmount();
  });

  it('没有可用版本时清除引用并展示原因，不自动绑定受限版本', async () => {
    const api = makeApi([{ version: 1, definition: { business: true } }]);
    const wrapper = mount(ReferencePicker, {
      props: { api, label: '工作流', basePath: '/workflows', versionError },
    });
    await flushPromises();
    wrapper.findAllComponents(Select)[0]!.vm.$emit('change', 'flow');
    await flushPromises();
    expect(wrapper.emitted('change')).toEqual([[null]]);
    expect(wrapper.text()).toContain('仅限业务入口');
    wrapper.unmount();
  });
});
