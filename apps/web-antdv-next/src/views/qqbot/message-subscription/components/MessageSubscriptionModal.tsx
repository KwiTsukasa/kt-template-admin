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

    /**
     * 处理来源或来源依赖字段变化，并清理不再有效的旧值。
     *
     * @param values - 来源选择与动态来源字段变化后的当前表单值。
     * @param fieldsChanged - 本次发生变化的表单字段名集合，用来只重算相关依赖字段。
     */
    async function handleValuesChange(
      values: Record<string, unknown>,
      fieldsChanged: string[],
    ) {
      if (fieldsChanged.includes('sourceKey')) {
        const sourceKey = (() => {
          if (typeof values.sourceKey === 'string') {
            return values.sourceKey;
          }
          return '';
        })();
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
        labelClass: 'w-32 whitespace-nowrap',
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
    const modalTitle = computed(() => {
      if (editingRow.value) {
        return '编辑消息订阅';
      }
      return '新建消息订阅';
    });
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[680px]',
      fullscreenButton: false,
      /**
       * 当用户确认消息订阅弹窗时提交来源和订阅字段；持久化错误由表单请求层统一展示。
       */
      async onConfirm() {
        try {
          await submit();
        } catch {
          // The request/form layer already presents the persistence error.
        }
      },
      /**
       * 打开消息订阅弹窗时恢复来源字段、重建动态 Schema，并加载该来源的选项。
       *
       * @param isOpen - 弹窗或抽屉最新显隐状态；true 表示已打开。
       */
      async onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = modalApi.getData<MessageSubscriptionModalData>();
        resetSourceRequest();
        selectedSourceKey.value = values.sourceKey;
        const definition = findSourceDefinition(
          props.sources,
          values.sourceKey,
        );
        if (definition) {
          sourceFieldValues.value = pickSourceFieldValues(values, definition);
        } else {
          sourceFieldValues.value = pickUnknownSourceValues(values);
        }
        rebuildSchema();
        await resetForm(values);
        if (values.sourceKey) {
          await loadSourceOptions(values.sourceKey);
        }
      },
    });

    /**
     * 通过空订阅值打开新建弹窗，并保持消息源未预选。
     */
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

    /**
     * 将现有订阅与动态来源字段回填后打开编辑弹窗。
     *
     * @param row - 要编辑、切换或删除的消息订阅记录。
     */
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

    /**
     * 重置表单并写入当前会话值。
     *
     * @param values - 订阅表单当前的来源、动态字段、名称和启用状态。
     */
    async function resetForm(values: MessageSubscriptionFormValues) {
      await formApi.resetForm();
      await formApi.setValues(values, false);
      await formApi.resetValidate();
    }

    /**
     * 使旧候选项请求失效并清空来源运行态。
     */
    function resetSourceRequest() {
      sourceRevision += 1;
      sourceOptions.value = {};
      sourceOptionsLoading.value = false;
    }

    /**
     * 用当前消息源元数据重建动态表单结构。
     */
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

    /**
     * 切换消息源，移除上一来源字段并按需加载新候选项。
     *
     * @param sourceKey - 订阅字段候选项所属的系统消息源键。
     */
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

    /**
     * 按消息源键加载动态候选项，并用请求代次忽略快速切换后的迟到响应。
     *
     * @param sourceKey - 订阅字段候选项所属的系统消息源键。
     */
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

    /**
     * 在消息源目录迟到时补建当前编辑会话的动态字段。
     */
    function handleSourcesChanged() {
      rebuildSchema();
    }

    /**
     * 通过来源声明字段筛选后提交订阅配置，未知字段不会写入请求。
     */
    async function submit() {
      const revision = sessionRevision;
      const editingId = editingRow.value?.id;
      const { valid } = await formApi.validate();
      if (revision !== sessionRevision || !valid) return;
      const values = await formApi.getValues<MessageSubscriptionFormValues>();
      if (revision !== sessionRevision) return;
      const definition = findSourceDefinition(props.sources, values.sourceKey);
      const sourceConfig = (() => {
        if (definition) {
          return Object.fromEntries(
            definition.subscriptionFields.flatMap((field) => {
              const value = values[field.key];
              if (typeof value === 'string' && value) {
                return [[field.key, value]];
              }
              return [];
            }),
          );
        }
        return {};
      })();
      const payload: QqbotMessagePushApi.MessageSubscriptionInput = {
        enabled: !!values.enabled,
        name: values.name.trim(),
        remark: (() => {
          if (typeof values.remark === 'string') {
            return values.remark.trim();
          }
          return '';
        })(),
        sourceConfig,
        sourceKey: values.sourceKey,
      };
      if (revision !== sessionRevision) return;

      modalApi.lock();
      try {
        await (() => {
          if (editingId) {
            return updateMessageSubscription(editingId, payload);
          }
          return createMessageSubscription(payload);
        })();
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

/**
 * 根据消息源目录与当前选中项生成订阅表单。
 *
 * @param props - 订阅弹窗可选择的系统消息源目录。
 * @param selectedSourceKey - 订阅表单当前选择的系统消息源键。
 * @param sourceFieldValues - 消息源动态字段当前已选择的值，用来计算依赖候选项。
 * @param sourceOptions - 当前消息源字段可选择的端口转发组与 DDNS 来源。
 * @param sourceOptionsLoading - 消息源候选项是否仍在加载。
 * @returns 包含通用订阅字段与当前消息源动态字段的 Vben Schema。
 */
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
      rules: z
        .string({
          invalid_type_error: '订阅名称格式不正确',
          required_error: '请输入订阅名称',
        })
        .trim()
        .min(1, '请输入订阅名称')
        .max(100, '订阅名称不能超过 100 个字符'),
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
      rules: z
        .string({
          invalid_type_error: '消息源格式不正确',
          required_error: '请选择消息源',
        })
        .min(1, '请选择消息源'),
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
      rules: z
        .string({ invalid_type_error: '备注格式不正确' })
        .max(500, '备注不能超过 500 个字符')
        .optional()
        .or(z.literal('')),
    },
  ];
}

/**
 * 将消息源字段元数据转换成 Vben 选择框定义。
 *
 * @param field - 需要转成表单控件并计算候选项的消息源字段定义。
 * @param sourceFieldValues - 消息源动态字段当前已选择的值，用来计算依赖候选项。
 * @param sourceOptions - 当前消息源字段可选择的端口转发组与 DDNS 来源。
 * @param sourceOptionsLoading - 消息源候选项是否仍在加载。
 * @returns 根据字段类型、依赖和候选项生成的单个 Vben Schema。
 */
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
  const requiredMessage = `请选择${field.label}`;
  const invalidTypeMessage = `${field.label}格式不正确`;
  const optionalRule = z
    .string({ invalid_type_error: invalidTypeMessage })
    .optional()
    .or(z.literal(''));
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
    rules: (() => {
      if (field.required) {
        return z
          .string({
            invalid_type_error: invalidTypeMessage,
            required_error: requiredMessage,
          })
          .min(1, requiredMessage);
      }
      return optionalRule;
    })(),
  };
}

/**
 * 根据字段依赖值筛选可用候选项；未满足依赖时返回空数组。
 *
 * @param field - 需要转成表单控件并计算候选项的消息源字段定义。
 * @param sourceOptions - 当前消息源字段可选择的端口转发组与 DDNS 来源。
 * @param sourceFieldValues - 消息源动态字段当前已选择的值，用来计算依赖候选项。
 * @returns 满足当前字段依赖的消息源候选项；依赖未满足时为空数组。
 */
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

/**
 * 根据 sourceKey 查找消息源元数据。
 *
 * @param sources - 可供订阅表单选择的系统消息源定义集合。
 * @param sourceKey - 订阅字段候选项所属的系统消息源键。
 * @returns sourceKey 对应的消息源定义；未匹配时为 undefined。
 */
function findSourceDefinition(
  sources: QqbotMessagePushApi.SystemMessageSourceDefinition[],
  sourceKey: string,
): QqbotMessagePushApi.SystemMessageSourceDefinition | undefined {
  return sources.find((source) => source.sourceKey === sourceKey);
}

/**
 * 从表单值中提取当前消息源公开声明的字符串字段。
 *
 * @param values - 包含通用字段与来源动态字段的订阅表单值。
 * @param definition - 声明可编辑订阅字段的系统消息源定义。
 * @returns 仅包含消息源公开声明且值可转换为字符串的动态字段。
 */
function pickSourceFieldValues(
  values: Record<string, unknown>,
  definition: QqbotMessagePushApi.SystemMessageSourceDefinition,
): Record<string, string | undefined> {
  return Object.fromEntries(
    definition.subscriptionFields.map((field): [string, string | undefined] => {
      const value = values[field.key];
      return [
        field.key,
        (() => {
          if (typeof value === 'string') {
            return value;
          }
          return undefined;
        })(),
      ];
    }),
  );
}

/**
 * 在元数据尚未返回时保留编辑会话中的未知来源配置。
 *
 * @param values - 订阅表单当前的来源、动态字段、名称和启用状态。
 * @returns 元数据未就绪时从编辑记录保留的未知来源字段。
 */
function pickUnknownSourceValues(
  values: MessageSubscriptionFormValues,
): Record<string, string | undefined> {
  const commonFields = new Set(['enabled', 'name', 'remark', 'sourceKey']);
  return Object.fromEntries(
    Object.entries(values).flatMap(([key, value]) => {
      if (!commonFields.has(key) && typeof value === 'string') {
        return [[key, value]];
      }
      return [];
    }),
  ) as Record<string, string | undefined>;
}
