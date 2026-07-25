import type { PropType } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';

import { computed, defineComponent, markRaw, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import Button from 'antdv-next/dist/button/index';

import { useVbenForm, z } from '#/adapter/form';
import {
  createMessageTemplate,
  getMessagePushSourceDetail,
  previewMessageTemplate,
  updateMessageTemplate,
} from '#/api/qqbot/message-push';

import MessageTemplateMentions from './MessageTemplateMentions';

const AButton = Button as any;

export interface MessageTemplateModalExposed {
  openCreate: () => void;
  openEdit: (row: QqbotMessagePushApi.MessageTemplateView) => void;
}

interface MessageTemplateFormValues {
  content: string;
  enabled: boolean;
  name: string;
  remark?: string;
  sourceKey: string;
}

interface MessageTemplateModalData {
  values: MessageTemplateFormValues;
}

export default defineComponent({
  name: 'MessageTemplateModal',
  props: {
    canPreview: {
      required: true,
      type: Boolean,
    },
    sources: {
      required: true,
      type: Array as PropType<
        QqbotMessagePushApi.SystemMessageSourceDefinition[]
      >,
    },
  },
  emits: ['saved'],
  setup(props, { emit, expose }) {
    const editingRow = ref<QqbotMessagePushApi.MessageTemplateView>();
    const variables = ref<
      QqbotMessagePushApi.SystemMessageSourceVariableDefinition[]
    >([]);
    const detailLoading = ref(false);
    const previewLoading = ref(false);
    const preview = ref<QqbotMessagePushApi.MessageTemplatePreview>();
    const selectedSourceKey = ref('');
    const detailCache = new Map<
      string,
      Promise<QqbotMessagePushApi.SystemMessageSourceDefinition>
    >();
    let sourceRevision = 0;
    let previewRevision = 0;
    let sessionRevision = 0;
    const [TemplateForm, formApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      async handleValuesChange(values, fieldsChanged) {
        if (fieldsChanged.includes('content')) clearPreview();
        if (!fieldsChanged.includes('sourceKey')) return;
        const sourceKey =
          typeof values.sourceKey === 'string' ? values.sourceKey : '';
        selectedSourceKey.value = sourceKey;
        await loadSourceDetail(sourceKey);
      },
      layout: 'horizontal',
      schema: createFormSchema(
        props,
        variables,
        detailLoading,
        selectedSourceKey,
      ),
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const modalTitle = computed(() =>
      editingRow.value ? '编辑消息模板' : '新建消息模板',
    );
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[760px]',
      fullscreenButton: false,
      async onConfirm() {
        try {
          await submit();
        } catch {
          // The request/form layer already presents the persistence error.
        }
      },
      async onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = modalApi.getData<MessageTemplateModalData>();
        invalidateSession();
        selectedSourceKey.value = values.sourceKey;
        await resetForm(values);
        await loadSourceDetail(values.sourceKey);
      },
    });

    function openCreate() {
      sessionRevision += 1;
      editingRow.value = undefined;
      modalApi
        .setData({
          values: {
            content: '',
            enabled: true,
            name: '',
            remark: '',
            sourceKey: '',
          },
        } satisfies MessageTemplateModalData)
        .open();
    }

    function openEdit(row: QqbotMessagePushApi.MessageTemplateView) {
      sessionRevision += 1;
      editingRow.value = row;
      modalApi
        .setData({
          values: {
            content: row.content,
            enabled: row.enabled,
            name: row.name,
            remark: row.remark || '',
            sourceKey: row.sourceKey,
          },
        } satisfies MessageTemplateModalData)
        .open();
    }

    async function resetForm(values: MessageTemplateFormValues) {
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

    function invalidateSession() {
      sourceRevision += 1;
      detailLoading.value = false;
      variables.value = [];
      clearPreview();
    }

    function clearPreview() {
      previewRevision += 1;
      preview.value = undefined;
      previewLoading.value = false;
    }

    function getCachedSourceDetail(sourceKey: string) {
      const cached = detailCache.get(sourceKey);
      if (cached) return cached;
      const request = getMessagePushSourceDetail(sourceKey);
      detailCache.set(sourceKey, request);
      request.catch(() => {
        if (detailCache.get(sourceKey) === request) {
          detailCache.delete(sourceKey);
        }
      });
      return request;
    }

    async function loadSourceDetail(sourceKey: string) {
      const revision = ++sourceRevision;
      clearPreview();
      variables.value = [];
      detailLoading.value = !!sourceKey;
      if (!sourceKey) {
        await formApi.validateField('content');
        return;
      }
      try {
        const source = await getCachedSourceDetail(sourceKey);
        if (
          revision === sourceRevision &&
          selectedSourceKey.value === sourceKey
        ) {
          variables.value = source.variables;
        }
      } catch {
        // The request layer owns user-facing errors; an empty catalog remains usable.
      } finally {
        if (
          revision === sourceRevision &&
          selectedSourceKey.value === sourceKey
        ) {
          detailLoading.value = false;
          await formApi.validateField('content');
        }
      }
    }

    async function handlePreview() {
      if (!props.canPreview) return;
      const [sourceValidation, contentValidation] = await Promise.all([
        formApi.validateField('sourceKey'),
        formApi.validateField('content'),
      ]);
      if (!sourceValidation.valid || !contentValidation.valid) return;
      const values = await formApi.getValues<MessageTemplateFormValues>();
      if (!values.sourceKey || !values.content) return;
      const revision = ++previewRevision;
      preview.value = undefined;
      previewLoading.value = true;
      try {
        const result = await previewMessageTemplate({
          content: values.content,
          sourceKey: values.sourceKey,
        });
        if (revision === previewRevision) preview.value = result;
      } finally {
        if (revision === previewRevision) previewLoading.value = false;
      }
    }

    async function submit() {
      const revision = sessionRevision;
      const editingId = editingRow.value?.id;
      const { valid } = await formApi.validate();
      if (revision !== sessionRevision) return;
      if (!valid) return;
      const values = await formApi.getValues<MessageTemplateFormValues>();
      if (revision !== sessionRevision) return;
      const payload: QqbotMessagePushApi.MessageTemplateInput = {
        content: values.content,
        enabled: !!values.enabled,
        name: values.name.trim(),
        remark: values.remark?.trim() || '',
        sourceKey: values.sourceKey,
      };
      if (revision !== sessionRevision) return;
      modalApi.lock();
      try {
        await (editingId
          ? updateMessageTemplate(editingId, payload)
          : createMessageTemplate(payload));
        if (revision !== sessionRevision) return;
        await modalApi.close();
        emit('saved');
      } finally {
        modalApi.unlock();
      }
    }

    function renderPreviewAction() {
      return props.canPreview ? (
        <AButton loading={previewLoading.value} onClick={handlePreview}>
          示例预览
        </AButton>
      ) : null;
    }

    function renderPreview() {
      const result = preview.value;
      if (!result) return null;
      return (
        <section class="mx-2 mt-4 rounded border p-3">
          <div class="mb-2 text-sm font-medium">服务端预览</div>
          <pre class="whitespace-pre-wrap break-words">
            {result.renderedMessage}
          </pre>
          <div class="mt-2 text-xs text-gray-500">
            {Object.entries(result.variables).map(([key, value]) => (
              <div key={key}>{`${key}: ${value}`}</div>
            ))}
          </div>
        </section>
      );
    }

    expose({ openCreate, openEdit } satisfies MessageTemplateModalExposed);

    return () => (
      <Modal
        title={modalTitle.value}
        v-slots={{ 'prepend-footer': renderPreviewAction }}
      >
        <TemplateForm class="mx-2" />
        {renderPreview()}
      </Modal>
    );
  },
});

function createFormSchema(
  props: Readonly<{
    canPreview: boolean;
    sources: QqbotMessagePushApi.SystemMessageSourceDefinition[];
  }>,
  variables: Readonly<{
    value: QqbotMessagePushApi.SystemMessageSourceVariableDefinition[];
  }>,
  loading: Readonly<{ value: boolean }>,
  selectedSourceKey: Readonly<{ value: string }>,
): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: () => ({
        options: props.sources.map((source) => ({
          label: `${source.displayName} · ${source.sourceKey}`,
          value: source.sourceKey,
        })),
      }),
      fieldName: 'sourceKey',
      label: '消息源',
      rules: z
        .string({
          invalid_type_error: '消息源格式不正确',
          required_error: '请选择消息源',
        })
        .min(1, '请选择消息源'),
    },
    {
      component: 'Input',
      componentProps: { allowClear: true, maxlength: 100 },
      fieldName: 'name',
      label: '模板名称',
      rules: z
        .string({
          invalid_type_error: '模板名称格式不正确',
          required_error: '请输入模板名称',
        })
        .trim()
        .min(1, '请输入模板名称')
        .max(100, '模板名称不能超过 100 个字符'),
    },
    {
      component: markRaw(MessageTemplateMentions),
      componentProps: () => ({
        disabled: !selectedSourceKey.value,
        loading: loading.value,
        variables: variables.value,
      }),
      fieldName: 'content',
      label: '模板内容',
      modelPropName: 'value',
      rules: z
        .string({
          invalid_type_error: '模板内容格式不正确',
          required_error: '请输入模板内容',
        })
        .min(1, '请输入模板内容')
        .max(2000, '模板内容不能超过 2000 个字符'),
    },
    {
      component: 'Switch',
      defaultValue: true,
      fieldName: 'enabled',
      label: '启用',
    },
    {
      component: 'Textarea',
      componentProps: { allowClear: true, maxlength: 500, rows: 3 },
      fieldName: 'remark',
      label: '备注',
      rules: z
        .string({ invalid_type_error: '备注格式不正确' })
        .max(500, '备注不能超过 500 个字符')
        .optional()
        .or(z.literal('')),
    },
  ];
}
