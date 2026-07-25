import type { PropType } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';

import { computed, defineComponent, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm, z } from '#/adapter/form';
import {
  createMessageSubscription,
  getMessagePushSourceOptions,
  updateMessageSubscription,
} from '#/api/qqbot/message-push';

export interface MessageSubscriptionModalExposed {
  openCreate: () => void;
  openEdit: (row: QqbotMessagePushApi.MessageSubscriptionView) => void;
}

type MessageSubscriptionFormValues = Record<
  string,
  boolean | string | undefined
> & {
  enabled: boolean;
  name: string;
  remark?: string;
  sourceKey: string;
};

interface MessageSubscriptionModalData {
  values: MessageSubscriptionFormValues;
}

export default defineComponent({
  name: 'MessageSubscriptionModal',
  props: {
    sources: {
      required: true,
      type: Array as PropType<
        QqbotMessagePushApi.SystemMessageSourceDefinition[]
      >,
    },
  },
  emits: ['saved'],
  setup(props, { emit, expose }) {
    const editingRow = ref<QqbotMessagePushApi.MessageSubscriptionView>();
    const selectedSourceKey = ref('');
    const sourceFieldValues = ref<Record<string, string | undefined>>({});
    const sourceOptions =
      ref<QqbotMessagePushApi.SystemMessageSourceOptionsResponse>({});
    const sourceOptionsLoading = ref(false);
    let sourceRevision = 0;
    let sessionRevision = 0;

    /** 处理来源或来源依赖字段变化，并清理不再有效的旧值。 */
    async function handleValuesChange(
      values: Record<string, unknown>,
      fieldsChanged: string[],
    ) {
      if (fieldsChanged.includes('sourceKey')) {
        const sourceKey =
          typeof values.sourceKey === 'string' ? values.sourceKey : '';
        await selectSource(sourceKey);
        return;
      }

      const definition = findSourceDefinition(
        props.sources,
        selectedSourceKey.value,
      );
      if (!definition) return;
      const nextValues = pickSourceFieldValues(values, definition);
      const clearPatch: Record<string, undefined> = {};
      for (const field of definition.subscriptionFields) {
        if (!field.dependsOn || !fieldsChanged.includes(field.dependsOn)) {
          continue;
        }
        const currentValue = nextValues[field.key];
        const options = getFieldOptions(field, sourceOptions.value, nextValues);
        if (
          currentValue &&
          !options.some((option) => option.value === currentValue)
        ) {
          clearPatch[field.key] = undefined;
          nextValues[field.key] = undefined;
        }
      }
      sourceFieldValues.value = nextValues;
      if (Object.keys(clearPatch).length > 0) {
        await formApi.setValues(clearPatch);
      }
    }

    const [SubscriptionForm, formApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      handleValuesChange,
      layout: 'horizontal',
      schema: createFormSchema(
        props,
        selectedSourceKey,
        sourceFieldValues,
        sourceOptions,
        sourceOptionsLoading,
      ),
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const modalTitle = computed(() =>
      editingRow.value ? '编辑消息订阅' : '新建消息订阅',
    );
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[680px]',
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
        const { values } = modalApi.getData<MessageSubscriptionModalData>();
        resetSourceRequest();
        selectedSourceKey.value = values.sourceKey;
        const definition = findSourceDefinition(
          props.sources,
          values.sourceKey,
        );
        sourceFieldValues.value = definition
          ? pickSourceFieldValues(values, definition)
          : pickUnknownSourceValues(values);
        rebuildSchema();
        await resetForm(values);
        if (values.sourceKey) {
          await loadSourceOptions(values.sourceKey);
        }
      },
    });

    /** 打开不预选消息源的新建订阅弹窗。 */
    function openCreate() {
      sessionRevision += 1;
      editingRow.value = undefined;
      modalApi
        .setData({
          values: {
            enabled: true,
            name: '',
            remark: '',
            sourceKey: '',
          },
        } satisfies MessageSubscriptionModalData)
        .open();
    }

    /** 打开编辑弹窗并保留当前消息源的动态配置。 */
    function openEdit(row: QqbotMessagePushApi.MessageSubscriptionView) {
      sessionRevision += 1;
      editingRow.value = row;
      modalApi
        .setData({
          values: {
            ...row.sourceConfig,
            enabled: row.enabled,
            name: row.name,
            remark: row.remark || '',
            sourceKey: row.sourceKey,
          },
        } satisfies MessageSubscriptionModalData)
        .open();
    }

    /** 重置表单并写入当前会话值。 */
    async function resetForm(values: MessageSubscriptionFormValues) {
      await formApi.resetForm();
      await formApi.setValues(values, false);
      await formApi.resetValidate();
    }

    /** 使旧候选项请求失效并清空来源运行态。 */
    function resetSourceRequest() {
      sourceRevision += 1;
      sourceOptions.value = {};
      sourceOptionsLoading.value = false;
    }

    /** 用当前消息源元数据重建动态表单结构。 */
    function rebuildSchema() {
      formApi.setState({
        schema: createFormSchema(
          props,
          selectedSourceKey,
          sourceFieldValues,
          sourceOptions,
          sourceOptionsLoading,
        ),
      });
    }

    /** 切换消息源，移除上一来源字段并按需加载新候选项。 */
    async function selectSource(sourceKey: string) {
      const previousDefinition = findSourceDefinition(
        props.sources,
        selectedSourceKey.value,
      );
      const staleFieldKeys = new Set([
        ...(previousDefinition?.subscriptionFields.map((field) => field.key) ||
          []),
        ...Object.keys(sourceFieldValues.value),
      ]);
      if (staleFieldKeys.size > 0) {
        await formApi.setValues(
          Object.fromEntries(
            [...staleFieldKeys].map((fieldName) => [fieldName, undefined]),
          ),
          false,
        );
      }

      resetSourceRequest();
      selectedSourceKey.value = sourceKey;
      sourceFieldValues.value = {};
      rebuildSchema();
      if (sourceKey) {
        await loadSourceOptions(sourceKey);
      }
    }

    /** 加载当前消息源候选项，并忽略快速切换产生的迟到响应。 */
    async function loadSourceOptions(sourceKey: string) {
      const revision = ++sourceRevision;
      sourceOptions.value = {};
      sourceOptionsLoading.value = true;
      rebuildSchema();
      try {
        const result = await getMessagePushSourceOptions(sourceKey);
        if (
          revision === sourceRevision &&
          selectedSourceKey.value === sourceKey
        ) {
          sourceOptions.value = result;
        }
      } catch {
        // The request layer owns user-facing errors; an empty catalog remains usable.
      } finally {
        if (
          revision === sourceRevision &&
          selectedSourceKey.value === sourceKey
        ) {
          sourceOptionsLoading.value = false;
          rebuildSchema();
        }
      }
    }

    /** 在消息源目录迟到时补建当前编辑会话的动态字段。 */
    function handleSourcesChanged() {
      rebuildSchema();
    }

    /** 校验并提交当前来源声明范围内的订阅配置。 */
    async function submit() {
      const revision = sessionRevision;
      const editingId = editingRow.value?.id;
      const { valid } = await formApi.validate();
      if (revision !== sessionRevision || !valid) return;
      const values = await formApi.getValues<MessageSubscriptionFormValues>();
      if (revision !== sessionRevision) return;
      const definition = findSourceDefinition(props.sources, values.sourceKey);
      const sourceConfig = definition
        ? Object.fromEntries(
            definition.subscriptionFields.flatMap((field) => {
              const value = values[field.key];
              return typeof value === 'string' && value
                ? [[field.key, value]]
                : [];
            }),
          )
        : {};
      const payload: QqbotMessagePushApi.MessageSubscriptionInput = {
        enabled: !!values.enabled,
        name: values.name.trim(),
        remark: typeof values.remark === 'string' ? values.remark.trim() : '',
        sourceConfig,
        sourceKey: values.sourceKey,
      };
      if (revision !== sessionRevision) return;

      modalApi.lock();
      try {
        await (editingId
          ? updateMessageSubscription(editingId, payload)
          : createMessageSubscription(payload));
        if (revision !== sessionRevision) return;
        await modalApi.close();
        emit('saved');
      } finally {
        modalApi.unlock();
      }
    }

    watch(() => props.sources, handleSourcesChanged, { deep: true });

    expose({ openCreate, openEdit } satisfies MessageSubscriptionModalExposed);

    return () => (
      <Modal title={modalTitle.value}>
        <SubscriptionForm class="mx-2" />
      </Modal>
    );
  },
});

/** 根据消息源目录与当前选中项生成订阅表单。 */
function createFormSchema(
  props: Readonly<{
    sources: QqbotMessagePushApi.SystemMessageSourceDefinition[];
  }>,
  selectedSourceKey: Readonly<{ value: string }>,
  sourceFieldValues: Readonly<{
    value: Record<string, string | undefined>;
  }>,
  sourceOptions: Readonly<{
    value: QqbotMessagePushApi.SystemMessageSourceOptionsResponse;
  }>,
  sourceOptionsLoading: Readonly<{ value: boolean }>,
): VbenFormSchema[] {
  const definition = findSourceDefinition(
    props.sources,
    selectedSourceKey.value,
  );
  const dynamicFields = (definition?.subscriptionFields || []).map((field) =>
    createSourceFieldSchema(
      field,
      sourceFieldValues,
      sourceOptions,
      sourceOptionsLoading,
    ),
  );
  return [
    {
      component: 'Input',
      componentProps: { allowClear: true, maxlength: 100 },
      fieldName: 'name',
      label: '订阅名称',
      rules: z.string().trim().min(1).max(100),
    },
    {
      component: 'Select',
      componentProps: () => ({
        allowClear: true,
        options: props.sources.map((source) => ({
          label: `${source.displayName} · ${source.sourceKey}`,
          value: source.sourceKey,
        })),
      }),
      fieldName: 'sourceKey',
      label: '消息源',
      rules: z.string().min(1),
    },
    ...dynamicFields,
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

/** 将消息源字段元数据转换成 Vben 选择框定义。 */
function createSourceFieldSchema(
  field: QqbotMessagePushApi.SystemMessageSourceFieldDefinition,
  sourceFieldValues: Readonly<{
    value: Record<string, string | undefined>;
  }>,
  sourceOptions: Readonly<{
    value: QqbotMessagePushApi.SystemMessageSourceOptionsResponse;
  }>,
  sourceOptionsLoading: Readonly<{ value: boolean }>,
): VbenFormSchema {
  const optionalRule = z.string().optional().or(z.literal(''));
  return {
    component: 'Select',
    componentProps: () => ({
      allowClear: true,
      loading: sourceOptionsLoading.value,
      options: getFieldOptions(
        field,
        sourceOptions.value,
        sourceFieldValues.value,
      ),
    }),
    fieldName: field.key,
    label: field.label,
    rules: field.required ? z.string().min(1) : optionalRule,
  };
}

/** 返回消息源字段可用且满足依赖关系的候选项。 */
function getFieldOptions(
  field: QqbotMessagePushApi.SystemMessageSourceFieldDefinition,
  sourceOptions: QqbotMessagePushApi.SystemMessageSourceOptionsResponse,
  sourceFieldValues: Record<string, string | undefined>,
): QqbotMessagePushApi.SystemMessageSourceOptionDefinition[] {
  const options = sourceOptions[field.optionCollection] || [];
  if (!field.dependsOn) return options;
  const dependsOnValue = sourceFieldValues[field.dependsOn];
  if (!dependsOnValue) return [];
  return options.filter((option) => option.dependsOnValue === dependsOnValue);
}

/** 按 sourceKey 查找消息源元数据。 */
function findSourceDefinition(
  sources: QqbotMessagePushApi.SystemMessageSourceDefinition[],
  sourceKey: string,
): QqbotMessagePushApi.SystemMessageSourceDefinition | undefined {
  return sources.find((source) => source.sourceKey === sourceKey);
}

/** 从表单值中提取当前消息源公开声明的字符串字段。 */
function pickSourceFieldValues(
  values: Record<string, unknown>,
  definition: QqbotMessagePushApi.SystemMessageSourceDefinition,
): Record<string, string | undefined> {
  return Object.fromEntries(
    definition.subscriptionFields.map((field): [string, string | undefined] => {
      const value = values[field.key];
      return [field.key, typeof value === 'string' ? value : undefined];
    }),
  );
}

/** 在元数据尚未返回时保留编辑会话中的未知来源配置。 */
function pickUnknownSourceValues(
  values: MessageSubscriptionFormValues,
): Record<string, string | undefined> {
  const commonFields = new Set(['enabled', 'name', 'remark', 'sourceKey']);
  return Object.fromEntries(
    Object.entries(values).flatMap(([key, value]) =>
      !commonFields.has(key) && typeof value === 'string' ? [[key, value]] : [],
    ),
  ) as Record<string, string | undefined>;
}
