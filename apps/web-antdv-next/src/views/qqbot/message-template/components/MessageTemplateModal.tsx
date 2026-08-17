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
        labelClass: 'w-32 whitespace-nowrap',
      },
      /**
       * 模板内容变化时使旧预览失效；消息源变化时加载对应变量并重新校验内容。
       *
       * @param values - 模板表单当前的消息来源键和正文；变化后刷新变量或使旧预览失效。
       * @param fieldsChanged - 本次发生变化的表单字段名集合，用于只处理相关依赖字段。
       */
      async handleValuesChange(values, fieldsChanged) {
        if (fieldsChanged.includes('content')) clearPreview();
        if (!fieldsChanged.includes('sourceKey')) return;
        const sourceKey = (() => {
          if (typeof values.sourceKey === 'string') {
            return values.sourceKey;
          }
          return '';
        })();
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
    const modalTitle = computed(() => {
      if (editingRow.value) {
        return '编辑消息模板';
      }
      return '新建消息模板';
    });
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[760px]',
      fullscreenButton: false,
      /**
       * 当用户确认消息模板弹窗时提交名称、来源和模板内容；持久化错误由表单请求层统一展示。
       */
      async onConfirm() {
        try {
          await submit();
        } catch {
          // The request/form layer already presents the persistence error.
        }
      },
      /**
       * 打开消息模板弹窗时使旧请求失效，恢复表单并加载所选来源的变量定义。
       *
       * @param isOpen - 弹窗或抽屉最新显隐状态；true 表示已打开。
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

    /**
     * 递增会话代次并清除编辑记录，以空来源和内容打开消息模板新建弹窗。
     */
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

    /**
     * 递增会话代次并把模板字段写入上下文，避免旧来源请求覆盖编辑弹窗。
     *
     * @param row - 要加载到模板编辑弹窗的消息模板记录。
     */
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

    /**
     * 清空消息模板表单后写入目标字段值，并移除上一轮校验错误。
     *
     * @param values - 重置后要写入消息模板表单的完整字段。
     */
    async function resetForm(values: MessageTemplateFormValues) {
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

    /**
     * 使当前 WebUI 会话及其心跳失效，并清理浏览器端临时凭据。
     */
    function invalidateSession() {
      sourceRevision += 1;
      detailLoading.value = false;
      variables.value = [];
      clearPreview();
    }

    /**
     * 递增预览修订号使在途响应失效，并清空消息模板预览及加载态。
     */
    function clearPreview() {
      previewRevision += 1;
      preview.value = undefined;
      previewLoading.value = false;
    }

    /**
     * 根据来源键读取消息模板来源详情缓存，未加载的来源返回 undefined。
     *
     * @param sourceKey - 消息推送来源的稳定键名。
     * @returns 已缓存的消息源详情；尚未加载该来源时返回 undefined。
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
     * 加载选中消息源的变量定义并重新校验模板内容；过期响应不会覆盖新选择。
     *
     * @param sourceKey - 消息推送来源的稳定键名。
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

    /**
     * 校验消息源和模板内容后请求预览，并用修订号阻止旧响应覆盖最新预览。
     */
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

    /**
     * 校验并修剪消息模板字段；仅当前弹窗会话仍有效时新建或更新、关闭弹窗并派发 saved。
     */
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
        await (() => {
          if (editingId) {
            return updateMessageTemplate(editingId, payload);
          }
          return createMessageTemplate(payload);
        })();
        if (revision !== sessionRevision) return;
        await modalApi.close();
        emit('saved');
      } finally {
        modalApi.unlock();
      }
    }

    /**
     * 仅在允许服务端预览时渲染带加载状态的“示例预览”按钮，否则返回 null。
     *
     * @returns 可触发服务端预览的按钮节点；禁用预览时返回 null。
     */
    function renderPreviewAction() {
      if (props.canPreview) {
        return (
          <AButton loading={previewLoading.value} onClick={handlePreview}>
            示例预览
          </AButton>
        );
      }
      return null;
    }

    /**
     * 把服务端渲染文本与变量明细展示为预览区；尚无结果时返回 null。
     *
     * @returns 包含渲染消息与变量明细的预览节点；尚无结果时返回 null。
     */
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
 * 生成消息源、模板名称、变量输入、启用状态和备注字段，并配置长度与必填约束。
 *
 * @param props - 提供可选消息来源列表和当前用户是否具有模板预览权限的组件属性。
 * @param variables - 当前消息来源声明的模板变量列表，用于生成提及候选项。
 * @param loading - 消息来源详情是否仍在加载的只读响应式状态。
 * @param selectedSourceKey - 当前选中的消息来源键；空值时禁用模板正文输入。
 * @returns 包含来源、名称、内容、状态和备注约束的消息模板表单 Schema。
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
