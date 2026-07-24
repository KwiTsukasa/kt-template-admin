/* @vitest-environment happy-dom */

/* eslint-disable no-template-curly-in-string, vue/one-component-per-file */

import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import MessageTemplateMentions from './MessageTemplateMentions';
import MessageTemplateModal from './MessageTemplateModal';

const mocks = vi.hoisted(() => {
  const formValues = {
    content: '',
    enabled: true,
    name: '',
    remark: '',
    sourceKey: '',
  };
  const modalApi = {
    close: vi.fn(async () => {}),
    getData: vi.fn(),
    lock: vi.fn(),
    open: vi.fn(),
    setData: vi.fn(),
    unlock: vi.fn(),
  };
  const formApi = {
    getValues: vi.fn(async () => ({ ...formValues })),
    resetForm: vi.fn(async () => {}),
    resetValidate: vi.fn(async () => {}),
    setValues: vi.fn(async (values) => Object.assign(formValues, values)),
    validate: vi.fn(async () => ({ valid: true })),
    validateField: vi.fn(async (_fieldName: string) => ({ valid: true })),
  };
  return {
    create: vi.fn(),
    detail: vi.fn(),
    formApi,
    formOptions: undefined as any,
    formValues,
    modalApi,
    modalOptions: undefined as any,
    preview: vi.fn(),
    update: vi.fn(),
  };
});

/** Creates a fluent no-op validation rule for schema behavior tests. */
function createRule(): any {
  const rule: any = {};
  for (const method of ['max', 'min', 'optional', 'or', 'trim']) {
    rule[method] = vi.fn(() => rule);
  }
  return rule;
}

vi.mock('#/adapter/form', () => ({
  useVbenForm: vi.fn((options) => {
    mocks.formOptions = options;
    const Form = defineComponent({
      name: 'MockTemplateForm',
      /** Renders the production schema's local content component with live props. */
      setup() {
        return () => {
          const content = mocks.formOptions.schema.find(
            (field: any) => field.fieldName === 'content',
          );
          const componentProps =
            typeof content.componentProps === 'function'
              ? content.componentProps()
              : content.componentProps;
          return h('form', { 'data-testid': 'template-form' }, [
            h(content.component, {
              ...componentProps,
              value: mocks.formValues.content,
              'onUpdate:value': (value: string) => {
                mocks.formValues.content = value;
              },
            }),
          ]);
        };
      },
    });
    return [Form, mocks.formApi];
  }),
  z: {
    literal: vi.fn(createRule),
    string: vi.fn(createRule),
  },
}));

vi.mock('@vben/common-ui', () => ({
  useVbenModal: vi.fn((options) => {
    mocks.modalOptions = options;
    const Modal = defineComponent({
      name: 'MockTemplateModal',
      /** Renders the actual form plus the explicit prepend-footer action slot. */
      setup(_, { slots }) {
        return () =>
          h('section', { 'data-testid': 'template-modal' }, [
            slots.default?.(),
            h('footer', slots['prepend-footer']?.()),
          ]);
      },
    });
    return [Modal, mocks.modalApi];
  }),
}));

vi.mock('#/api/qqbot/message-push', () => ({
  createMessageTemplate: mocks.create,
  getMessagePushSourceDetail: mocks.detail,
  previewMessageTemplate: mocks.preview,
  updateMessageTemplate: mocks.update,
}));

/** Creates one source with a distinguishable variable catalog. */
function createSource(
  sourceKey = 'source-a',
  variableKey = 'endpoint',
): QqbotMessagePushApi.SystemMessageSourceDefinition {
  return {
    description: `${sourceKey} description`,
    displayName: `${sourceKey} name`,
    sourceKey,
    subscriptionFields: [],
    variables: [
      {
        description: `${variableKey} description`,
        example: `${variableKey} example`,
        key: variableKey,
        label: `${variableKey} label`,
        type: 'string',
      },
    ],
    version: 1,
  };
}

/** Creates one unsafe-integer string-ID editable template row. */
function createRow(): QqbotMessagePushApi.MessageTemplateView {
  return {
    content: 'old [CQ:at,qq=12345]',
    createTime: '2026-07-24 10:00:00',
    enabled: false,
    id: '10000000000000001',
    name: 'old template',
    referenceCount: 0,
    remark: 'old remark',
    sourceKey: 'source-b',
    sourceName: 'source-b name',
    updateTime: '2026-07-24 10:00:00',
  };
}

/** Mounts the modal with page-owned source labels. */
function mountModal(canPreview = true) {
  return mount(MessageTemplateModal, {
    props: {
      canPreview,
      sources: [createSource(), createSource('source-b', 'port')],
    },
  });
}

describe('message template modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.formValues, {
      content: '',
      enabled: true,
      name: '',
      remark: '',
      sourceKey: '',
    });
    mocks.modalApi.getData.mockImplementation(
      () => mocks.modalApi.setData.mock.calls.at(-1)?.[0] || {},
    );
    mocks.modalApi.setData.mockImplementation(() => mocks.modalApi);
    mocks.modalApi.open.mockImplementation(() => {
      void mocks.modalOptions.onOpenChange?.(true);
      return mocks.modalApi;
    });
    mocks.create.mockResolvedValue({});
    mocks.update.mockResolvedValue({});
    mocks.formApi.validateField.mockResolvedValue({ valid: true });
    mocks.detail.mockImplementation(async (sourceKey: string) =>
      createSource(sourceKey, sourceKey === 'source-a' ? 'endpoint' : 'port'),
    );
    mocks.preview.mockResolvedValue({
      renderedMessage: 'server rendered',
      variables: { endpoint: 'server.example:38213' },
    });
  });

  it('registers the exact schema and actually renders the local Mentions form field', () => {
    const wrapper = mountModal();
    const fields = mocks.formOptions.schema.map(
      (field: any) => field.fieldName,
    );
    const content = mocks.formOptions.schema.find(
      (field: any) => field.fieldName === 'content',
    );

    expect(fields).toEqual([
      'sourceKey',
      'name',
      'content',
      'enabled',
      'remark',
    ]);
    expect(content.component).toBe(MessageTemplateMentions);
    expect(content.modelPropName).toBe('value');
    expect(
      wrapper
        .get('[data-testid="template-form"]')
        .findComponent(MessageTemplateMentions)
        .exists(),
    ).toBe(true);
    expect(
      mocks.formOptions.schema.find((field: any) => field.fieldName === 'name')
        .componentProps.maxlength,
    ).toBe(100);
    expect(
      mocks.formOptions.schema.find(
        (field: any) => field.fieldName === 'remark',
      ).componentProps.maxlength,
    ).toBe(500);
  });

  it('opens before reset/set/reset-validation and isolates edit then create', async () => {
    const wrapper = mountModal();
    mocks.formApi.resetForm.mockImplementation(async () => {
      expect(mocks.modalApi.open).toHaveBeenCalled();
    });

    (wrapper.vm as any).openEdit(createRow());
    await flushPromises();
    (wrapper.vm as any).openCreate();
    await flushPromises();

    expect(mocks.formApi.setValues).toHaveBeenLastCalledWith({
      content: '',
      enabled: true,
      name: '',
      remark: '',
      sourceKey: 'source-a',
    });
    const resetOrder =
      mocks.formApi.resetForm.mock.invocationCallOrder.at(-1) || 0;
    const setOrder =
      mocks.formApi.setValues.mock.invocationCallOrder.at(-1) || 0;
    const validateOrder =
      mocks.formApi.resetValidate.mock.invocationCallOrder.at(-1) || 0;
    expect(resetOrder).toBeLessThan(setOrder);
    expect(setOrder).toBeLessThan(validateOrder);
  });

  it('loads exact details and prevents a late source from overwriting the latest', async () => {
    const deferred = new Map<
      string,
      {
        promise: Promise<QqbotMessagePushApi.SystemMessageSourceDefinition>;
        resolve: (
          value: QqbotMessagePushApi.SystemMessageSourceDefinition,
        ) => void;
      }
    >();
    mocks.detail.mockImplementation((sourceKey: string) => {
      let resolve!: (
        value: QqbotMessagePushApi.SystemMessageSourceDefinition,
      ) => void;
      const promise =
        new Promise<QqbotMessagePushApi.SystemMessageSourceDefinition>(
          (done) => {
            resolve = done;
          },
        );
      deferred.set(sourceKey, { promise, resolve });
      return promise;
    });
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    expect(mocks.detail).toHaveBeenNthCalledWith(1, 'source-a');
    const switchPromise = mocks.formOptions.handleValuesChange(
      { ...mocks.formValues, sourceKey: 'source-b' },
      ['sourceKey'],
    );

    expect(mocks.detail).toHaveBeenNthCalledWith(2, 'source-b');
    const content = mocks.formOptions.schema.find(
      (field: any) => field.fieldName === 'content',
    );
    expect(content.componentProps().variables).toEqual([]);
    deferred.get('source-b')?.resolve(createSource('source-b', 'port'));
    await switchPromise;
    expect(content.componentProps().variables[0].key).toBe('port');
    deferred.get('source-a')?.resolve(createSource('source-a', 'endpoint'));
    await flushPromises();
    expect(content.componentProps().variables[0].key).toBe('port');
    expect(mocks.formApi.validateField).toHaveBeenCalledWith('content');
  });

  it('deduplicates exact-key detail and contains a rejected source-change callback before retry', async () => {
    let resolveSourceA!: (
      source: QqbotMessagePushApi.SystemMessageSourceDefinition,
    ) => void;
    mocks.detail.mockImplementationOnce(
      () =>
        new Promise<QqbotMessagePushApi.SystemMessageSourceDefinition>(
          (resolve) => {
            resolveSourceA = resolve;
          },
        ),
    );
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();
    const collidingLoad = mocks.formOptions.handleValuesChange(
      { ...mocks.formValues, sourceKey: 'source-a' },
      ['sourceKey'],
    );
    expect(mocks.detail).toHaveBeenCalledTimes(1);
    resolveSourceA(createSource('source-a', 'endpoint'));
    await collidingLoad;
    await flushPromises();

    mocks.detail.mockRejectedValueOnce(new Error('detail failed'));
    const failedSourceChange = mocks.formOptions.handleValuesChange(
      { ...mocks.formValues, sourceKey: 'source-b' },
      ['sourceKey'],
    );
    await expect(failedSourceChange).resolves.toBeUndefined();
    const content = mocks.formOptions.schema.find(
      (field: any) => field.fieldName === 'content',
    );
    expect(content.componentProps().variables).toEqual([]);
    expect(content.componentProps().loading).toBe(false);
    expect(mocks.formApi.validateField).toHaveBeenCalledWith('content');

    mocks.detail.mockResolvedValueOnce(createSource('source-b', 'port'));
    await mocks.formOptions.handleValuesChange(
      { ...mocks.formValues, sourceKey: 'source-b' },
      ['sourceKey'],
    );
    expect(mocks.detail).toHaveBeenCalledTimes(3);
    expect(content.componentProps().variables[0].key).toBe('port');
    expect(content.componentProps().loading).toBe(false);
  });

  it('contains a non-awaited modal-open detail failure and remains usable for retry', async () => {
    mocks.detail.mockRejectedValueOnce(new Error('open detail failed'));
    const wrapper = mountModal();

    (wrapper.vm as any).openCreate();
    await flushPromises();

    const content = mocks.formOptions.schema.find(
      (field: any) => field.fieldName === 'content',
    );
    expect(content.componentProps().variables).toEqual([]);
    expect(content.componentProps().loading).toBe(false);
    expect(wrapper.find('footer button').exists()).toBe(true);

    mocks.detail.mockResolvedValueOnce(createSource('source-a', 'endpoint'));
    (wrapper.vm as any).openCreate();
    await flushPromises();

    expect(mocks.detail).toHaveBeenCalledTimes(2);
    expect(content.componentProps().variables[0].key).toBe('endpoint');
    expect(content.componentProps().loading).toBe(false);
  });

  it('allows preview only on explicit permitted click and clears it on content change', async () => {
    const wrapper = mountModal(true);
    Object.assign(mocks.formValues, {
      content: '[CQ:at,qq=12345] ${{endpoint}}',
      sourceKey: 'source-a',
    });
    expect(mocks.preview).not.toHaveBeenCalled();

    await wrapper.get('footer button').trigger('click');
    await flushPromises();

    expect(mocks.formApi.validateField.mock.calls).toEqual([
      ['sourceKey'],
      ['content'],
    ]);
    expect(mocks.preview).toHaveBeenCalledOnce();
    expect(mocks.preview).toHaveBeenCalledWith({
      content: '[CQ:at,qq=12345] ${{endpoint}}',
      sourceKey: 'source-a',
    });
    expect(wrapper.text()).toContain('server rendered');
    expect(wrapper.text()).toContain('server.example:38213');

    await mocks.formOptions.handleValuesChange(
      { ...mocks.formValues, content: 'changed' },
      ['content'],
    );
    await nextTick();
    expect(wrapper.text()).not.toContain('server rendered');
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(mocks.preview).toHaveBeenCalledOnce();
  });

  it('makes preview impossible without Preview permission or exact-field validity', async () => {
    const wrapper = mountModal(false);
    expect(wrapper.find('footer button').exists()).toBe(false);
    expect(mocks.formApi.validateField).not.toHaveBeenCalled();
    expect(mocks.preview).not.toHaveBeenCalled();

    wrapper.unmount();
    const permitted = mountModal(true);
    Object.assign(mocks.formValues, {
      content: 'x'.repeat(2001),
      sourceKey: 'source-a',
    });
    mocks.formApi.validateField.mockImplementation(
      async (fieldName: string) => ({
        valid: fieldName !== 'content',
      }),
    );
    await permitted.get('footer button').trigger('click');
    await flushPromises();
    expect(mocks.formApi.validateField.mock.calls).toEqual([
      ['sourceKey'],
      ['content'],
    ]);
    expect(mocks.preview).not.toHaveBeenCalled();

    mocks.formApi.validateField.mockClear();
    mocks.formApi.validateField.mockImplementation(
      async (fieldName: string) => ({
        valid: fieldName !== 'sourceKey',
      }),
    );
    Object.assign(mocks.formValues, {
      content: '${{endpoint}}',
      sourceKey: 'schema-invalid-source',
    });
    await permitted.get('footer button').trigger('click');
    await flushPromises();
    expect(mocks.formApi.validateField.mock.calls).toEqual([
      ['sourceKey'],
      ['content'],
    ]);
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it('does not validate unrelated invalid name or remark before preview', async () => {
    const wrapper = mountModal(true);
    Object.assign(mocks.formValues, {
      content: '${{endpoint}}',
      name: '',
      remark: 'x'.repeat(501),
      sourceKey: 'source-a',
    });
    mocks.formApi.validateField.mockImplementation(
      async (fieldName: string) => ({
        valid: fieldName !== 'name' && fieldName !== 'remark',
      }),
    );

    await wrapper.get('footer button').trigger('click');
    await flushPromises();

    expect(mocks.formApi.validateField.mock.calls).toEqual([
      ['sourceKey'],
      ['content'],
    ]);
    expect(mocks.preview).toHaveBeenCalledOnce();
  });

  it('submits exact create/update payloads while preserving content and string ID', async () => {
    const wrapper = mountModal();
    Object.assign(mocks.formValues, {
      content: '  [CQ:at,qq=12345]\n${{endpoint}}  ',
      enabled: 1,
      name: ' template ',
      remark: ' note ',
      sourceKey: 'source-a',
    });
    (wrapper.vm as any).openCreate();
    await flushPromises();
    Object.assign(mocks.formValues, {
      content: '  [CQ:at,qq=12345]\n${{endpoint}}  ',
      enabled: 1,
      name: ' template ',
      remark: ' note ',
      sourceKey: 'source-a',
    });
    await mocks.modalOptions.onConfirm();

    const payload = {
      content: '  [CQ:at,qq=12345]\n${{endpoint}}  ',
      enabled: true,
      name: 'template',
      remark: 'note',
      sourceKey: 'source-a',
    };
    expect(mocks.create).toHaveBeenCalledWith(payload);

    (wrapper.vm as any).openEdit(createRow());
    await flushPromises();
    Object.assign(mocks.formValues, payload);
    await mocks.modalOptions.onConfirm();
    expect(mocks.update).toHaveBeenCalledWith('10000000000000001', payload);
  });

  it('stays open/unlocked after failure and closes/emits once on retry success', async () => {
    mocks.create.mockRejectedValueOnce(new Error('save failed'));
    const wrapper = mountModal();
    (wrapper.vm as any).openCreate();
    await flushPromises();

    await expect(mocks.modalOptions.onConfirm()).rejects.toThrow('save failed');
    expect(mocks.modalApi.lock).toHaveBeenCalledOnce();
    expect(mocks.modalApi.close).not.toHaveBeenCalled();
    expect(wrapper.emitted('saved')).toBeUndefined();
    expect(mocks.modalApi.unlock).toHaveBeenCalledOnce();

    mocks.create.mockResolvedValueOnce({});
    await mocks.modalOptions.onConfirm();
    expect(mocks.modalApi.close).toHaveBeenCalledOnce();
    expect(wrapper.emitted('saved')).toHaveLength(1);
    expect(mocks.modalApi.unlock).toHaveBeenCalledTimes(2);
  });
});
