import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { Upload } from 'antdv-next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ScriptUpload from '#/views/workflow-engine/designer/ScriptUpload';

const api = vi.hoisted(() => ({
  inspectScript: vi.fn(),
  uploadScript: vi.fn(),
}));
vi.mock('#/api/workflow-engine', () => ({ workflowApi: api }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('antdv-next', async () => ({
  Upload: (await import('antdv-next/dist/upload/index')).default,
  Button: (await import('antdv-next/dist/button/index')).default,
  Alert: (await import('antdv-next/dist/alert/index')).default,
  Select: (await import('antdv-next/dist/select/index')).default,
  Tag: (await import('antdv-next/dist/tag/index')).default,
  message: { success: vi.fn() },
}));
vi.mock('@vben/common-ui', () => ({
  useVbenDrawer: () => [
    defineComponent({
      setup(_, { slots }) {
        return () => h('section', [slots.default?.(), slots.footer?.()]);
      },
    }),
    { open: vi.fn(), close: vi.fn() },
  ],
}));

const declaration = {
  protocol: 'kt.workflow.script.v1',
  key: 'qa.upload.shell',
  name: 'Shell 参数识别验收',
  description: '',
  runtime: 'bash',
  processKey: 'qa.restart',
  stepKey: 'write.once',
  sha256: 'a'.repeat(64),
  maxTimeoutMs: 10000,
  idempotent: false,
  defaults: { caption: '自动识别', enabled: true, mode: 'standard' },
  paramsSchema: {
    fields: [
      { key: 'amount', label: '数量', type: 'integer', required: true },
      { key: 'caption', label: '说明标题', type: 'string', required: true },
      { key: 'enabled', label: '启用处理', type: 'boolean', required: true },
      {
        key: 'mode',
        label: '处理模式',
        type: 'string',
        required: true,
        options: [
          { label: '标准', value: 'standard' },
          { label: '精简', value: 'compact' },
        ],
      },
    ],
  },
  resultSchema: {
    fields: [{ key: 'amount', label: '数量', type: 'integer', required: true }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  api.inspectScript.mockResolvedValue(declaration);
  api.uploadScript.mockResolvedValue({
    ...declaration,
    version: 1,
    target: 'local',
  });
});

describe('脚本上传参数组件', () => {
  it('接受 Shell 文件并显示接口识别的类型、必填、默认和枚举，保存原源码', async () => {
    const wrapper = mount(ScriptUpload);
    const dragger = wrapper.findComponent(Upload.Dragger);
    expect(dragger.props('accept')).toBe('.mjs,.py,.sh');
    const source = '#!/bin/bash\n# 标准声明由真实接口检查\n';
    dragger.props('beforeUpload')!(
      new File([source], 'upload-parameters.sh') as any,
      [],
    );
    await vi.waitFor(() =>
      expect(api.inspectScript).toHaveBeenCalledWith(
        'upload-parameters.sh',
        source,
      ),
    );
    await flushPromises();
    for (const text of [
      'bash',
      '数量',
      'integer',
      '说明标题',
      'string',
      '启用处理',
      'boolean',
      '必填',
      '默认值：自动识别',
      '默认值：true',
      '标准、精简',
    ])
      expect(wrapper.text()).toContain(text);
    const save = wrapper
      .findAll('button')
      .find((button) => button.text() === '保存脚本版本')!;
    expect(save.attributes('disabled')).toBeUndefined();
    await save.trigger('click');
    await flushPromises();
    expect(api.uploadScript).toHaveBeenCalledWith(
      'upload-parameters.sh',
      source,
      'local',
    );
    expect(wrapper.emitted('uploaded')?.[0]?.[0]).toMatchObject({
      key: declaration.key,
      version: 1,
      sha256: declaration.sha256,
    });
    wrapper.unmount();
  });

  it('拒绝不支持的文件及缺少标准声明的脚本，禁止保存', async () => {
    const wrapper = mount(ScriptUpload);
    const dragger = wrapper.findComponent(Upload.Dragger);
    dragger.props('beforeUpload')!(
      new File(['x'], 'not-script.txt') as any,
      [],
    );
    await flushPromises();
    expect(api.inspectScript).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('请选择 .mjs、.py 或 .sh 脚本');
    api.inspectScript.mockRejectedValueOnce(new Error('缺少标准输出协议声明'));
    dragger.props('beforeUpload')!(
      new File(['echo x'], 'invalid.sh') as any,
      [],
    );
    await vi.waitFor(() => expect(api.inspectScript).toHaveBeenCalled());
    await flushPromises();
    expect(wrapper.text()).toContain('缺少标准输出协议声明');
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text() === '保存脚本版本')!
        .attributes('disabled'),
    ).toBeDefined();
    expect(api.uploadScript).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
