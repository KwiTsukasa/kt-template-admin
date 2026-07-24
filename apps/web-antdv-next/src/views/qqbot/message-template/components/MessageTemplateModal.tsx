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
  /** Owns one isolated template edit session, source detail cache, and preview. */
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
    const [TemplateForm, formApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      /**
       * Clears stale preview state and refreshes variables only for source changes.
       * @param values - Current form values after the update.
       * @param fieldsChanged - Exact fields changed by this form event.
       */
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
    /** Tracks the title from isolated create/edit identity only. */
    const modalTitle = computed(() =>
      editingRow.value ? '编辑消息模板' : '新建消息模板',
    );
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[760px]',
      fullscreenButton: false,
      /** Validates and persists the exact five-field template payload. */
      async onConfirm() {
        await submit();
      },
      /**
       * Resets every mounted form/session state before loading authoritative detail.
       * @param isOpen - Whether destroy-on-close modal content is mounted.
       */
      async onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = modalApi.getData<MessageTemplateModalData>();
        invalidateSession();
        selectedSourceKey.value = values.sourceKey;
        await resetForm(values);
        await loadSourceDetail(values.sourceKey);
      },
    });

    /** Opens a fresh create session without values from the preceding edit. */
    function openCreate() {
      editingRow.value = undefined;
      modalApi
        .setData({
          values: {
            content: '',
            enabled: true,
            name: '',
            remark: '',
            sourceKey: props.sources[0]?.sourceKey || '',
          },
        } satisfies MessageTemplateModalData)
        .open();
    }

    /**
     * Opens an edit session with only the five user-editable values.
     * @param row - Template row selected from the page-owned KtTable.
     */
    function openEdit(row: QqbotMessagePushApi.MessageTemplateView) {
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

    /**
     * Resets and installs the current session values in the required order.
     * @param values - Exact editable values stored before the modal opened.
     */
    async function resetForm(values: MessageTemplateFormValues) {
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

    /** Invalidates stale source/preview work and clears every transient display. */
    function invalidateSession() {
      sourceRevision += 1;
      detailLoading.value = false;
      variables.value = [];
      clearPreview();
    }

    /** Clears authoritative preview data and invalidates any in-flight preview. */
    function clearPreview() {
      previewRevision += 1;
      preview.value = undefined;
      previewLoading.value = false;
    }

    /**
     * Reuses an exact-key in-flight/resolved source detail promise.
     * @param sourceKey - Stable exact source identity selected in the form.
     * @returns Authoritative source detail promise, evicted when rejected.
     */
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

    /**
     * Replaces suggestions only when this exact source request remains latest.
     * Expected detail failures stay inside the non-awaited form/modal callbacks.
     * @param sourceKey - Newly selected source identity.
     */
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

    /** Requests server-authoritative preview only after an explicit valid click. */
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

    /** Persists content byte-for-byte and closes/emits only after success. */
    async function submit() {
      const { valid } = await formApi.validate();
      if (!valid) return;
      const values = await formApi.getValues<MessageTemplateFormValues>();
      const payload: QqbotMessagePushApi.MessageTemplateInput = {
        content: values.content,
        enabled: !!values.enabled,
        name: values.name.trim(),
        remark: values.remark?.trim() || '',
        sourceKey: values.sourceKey,
      };
      modalApi.lock();
      try {
        await (editingRow.value
          ? updateMessageTemplate(editingRow.value.id, payload)
          : createMessageTemplate(payload));
        await modalApi.close();
        emit('saved');
      } finally {
        modalApi.unlock();
      }
    }

    /** Renders the permission-gated explicit preview action. */
    function renderPreviewAction() {
      return props.canPreview ? (
        <AButton loading={previewLoading.value} onClick={handlePreview}>
          示例预览
        </AButton>
      ) : null;
    }

    /** Renders server-returned preview text and variables as escaped text nodes. */
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

/**
 * Builds the exact template schema with a local controlled Mentions component.
 * @param props - Page-owned source labels and preview permission.
 * @param variables - Variables from the latest exact source detail.
 * @param loading - Source-detail loading state forwarded to Mentions.
 * @param selectedSourceKey - Current source identity used to disable no-source input.
 * @returns Five fields in the locked source/name/content/enabled/remark order.
 */
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
      rules: z.string().min(1),
    },
    {
      component: 'Input',
      componentProps: { allowClear: true, maxlength: 100 },
      fieldName: 'name',
      label: '模板名称',
      rules: z.string().trim().min(1).max(100),
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
      rules: z.string().min(1).max(2000),
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
      rules: z.string().max(500).optional().or(z.literal('')),
    },
  ];
}
