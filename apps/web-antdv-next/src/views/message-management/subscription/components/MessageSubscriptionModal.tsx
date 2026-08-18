import type { PropType } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { MessageManagementApi } from '#/api/message-management';

import { computed, defineComponent, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm, z } from '#/adapter/form';
import {
  createMessageSubscription,
  getMessageSourceOptions,
  updateMessageSubscription,
} from '#/api/message-management';

export interface MessageSubscriptionModalExposed {
  openCreate: () => void;
  openEdit: (row: MessageManagementApi.MessageSubscriptionView) => void;
}

type MessageSubscriptionFormValues = Record<
  string,
  boolean | string | string[] | undefined
> & {
  enabled: boolean;
  name: string;
  remark?: string;
  subscriberKey: string;
  templateIds: string[];
};

interface MessageSubscriptionModalData {
  sourceKey: string;
  values: MessageSubscriptionFormValues;
}

export default defineComponent({
  name: 'MessageSubscriptionModal',
  props: {
    sources: {
      required: true,
      type: Array as PropType<
        MessageManagementApi.SystemMessageSourceDefinition[]
      >,
    },
    subscribers: {
      required: true,
      type: Array as PropType<
        MessageManagementApi.MessageSubscriberDefinition[]
      >,
    },
    templates: {
      required: true,
      type: Array as PropType<MessageManagementApi.MessageTemplateView[]>,
    },
  },
  emits: ['saved'],
  setup(props, { emit, expose }) {
    const editingRow = ref<MessageManagementApi.MessageSubscriptionView>();
    const selectedSourceKey = ref('');
    const selectedTemplateIds = ref<string[]>([]);
    const sourceFieldValues = ref<Record<string, string | undefined>>({});
    const sourceOptions =
      ref<MessageManagementApi.SystemMessageSourceOptionsResponse>({});
    const sourceOptionsLoading = ref(false);
    let sourceRevision = 0;
    let sessionRevision = 0;

    const [SubscriptionForm, formApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-32 whitespace-nowrap',
      },
      /**
       * 把模板选择作为来源唯一事实源，并在上游字段变化后清除不再可选的下游配置。
       *
       * @param values - 当前模板、订阅者和动态来源字段表单值。
       * @param fieldsChanged - 本次发生变化的字段名集合。
       */
      async handleValuesChange(
        values: Record<string, unknown>,
        fieldsChanged: string[],
      ) {
        if (fieldsChanged.includes('templateIds')) {
          await selectTemplates(normalizeTemplateIds(values.templateIds));
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
          const options = getFieldOptions(
            field,
            sourceOptions.value,
            nextValues,
          );
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
      },
      layout: 'horizontal',
      schema: createFormSchema(
        props,
        selectedSourceKey,
        selectedTemplateIds,
        sourceFieldValues,
        sourceOptions,
        sourceOptionsLoading,
      ),
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const modalTitle = computed(() => {
      if (editingRow.value) return '编辑消息订阅';
      return '新建消息订阅';
    });
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[720px]',
      fullscreenButton: false,
      /**
       * 只在整组模板、订阅者与动态来源字段同时有效时保存一条统一路由规则。
       */
      async onConfirm() {
        try {
          await submit();
        } catch {
          // The request/form layer already presents the persistence error.
        }
      },
      /**
       * 打开弹窗时从绑定模板恢复唯一消息源，并加载该来源的动态候选项。
       *
       * @param isOpen - 弹窗最新显隐状态。
       */
      async onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const data = modalApi.getData<MessageSubscriptionModalData>();
        resetSourceRequest();
        selectedTemplateIds.value = [...data.values.templateIds];
        selectedSourceKey.value = data.sourceKey;
        const definition = findSourceDefinition(props.sources, data.sourceKey);
        if (definition) {
          sourceFieldValues.value = pickSourceFieldValues(
            data.values,
            definition,
          );
        } else {
          sourceFieldValues.value = pickUnknownSourceValues(data.values);
        }
        rebuildSchema();
        await resetForm(data.values);
        if (data.sourceKey) await loadSourceOptions(data.sourceKey);
      },
    });

    /**
     * 新建会话不预选模板或订阅者，避免隐式确定来源和投递渠道。
     */
    function openCreate() {
      sessionRevision += 1;
      editingRow.value = undefined;
      modalApi
        .setData({
          sourceKey: '',
          values: {
            enabled: true,
            name: '',
            remark: '',
            subscriberKey: '',
            templateIds: [],
          },
        } satisfies MessageSubscriptionModalData)
        .open();
    }

    /**
     * 将订阅绑定的全部模板、唯一订阅者和来源配置回填到编辑会话。
     *
     * @param row - 待编辑的统一消息订阅。
     */
    function openEdit(row: MessageManagementApi.MessageSubscriptionView) {
      sessionRevision += 1;
      editingRow.value = row;
      modalApi
        .setData({
          sourceKey: row.sourceKey,
          values: {
            ...row.sourceConfig,
            enabled: row.enabled,
            name: row.name,
            remark: row.remark || '',
            subscriberKey: row.subscriberKey,
            templateIds: row.templates.map((template) => template.id),
          },
        } satisfies MessageSubscriptionModalData)
        .open();
    }

    /**
     * 重置订阅表单并写入当前多模板会话值。
     *
     * @param values - 多模板订阅表单的完整值。
     */
    async function resetForm(values: MessageSubscriptionFormValues) {
      await formApi.resetForm();
      await formApi.setValues(values, false);
      await formApi.resetValidate();
    }

    /**
     * 使旧来源候选请求失效并清空来源运行态。
     */
    function resetSourceRequest() {
      sourceRevision += 1;
      sourceOptions.value = {};
      sourceOptionsLoading.value = false;
    }

    /**
     * 用当前模板派生来源重建动态表单结构。
     */
    function rebuildSchema() {
      formApi.setState({
        schema: createFormSchema(
          props,
          selectedSourceKey,
          selectedTemplateIds,
          sourceFieldValues,
          sourceOptions,
          sourceOptionsLoading,
        ),
      });
    }

    /**
     * 根据全部已选模板派生唯一来源，并在来源变化时清理旧动态字段。
     *
     * @param templateIds - 当前按选择顺序排列的消息模板标识。
     */
    async function selectTemplates(templateIds: string[]) {
      const nextSourceKey = deriveTemplateSourceKey(
        props.templates,
        templateIds,
      );
      if (nextSourceKey === null) {
        await formApi.setValues({ templateIds: selectedTemplateIds.value });
        return;
      }
      const sourceChanged = nextSourceKey !== selectedSourceKey.value;
      selectedTemplateIds.value = [...templateIds];
      if (!sourceChanged) {
        rebuildSchema();
        return;
      }

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
      selectedSourceKey.value = nextSourceKey;
      sourceFieldValues.value = {};
      rebuildSchema();
      if (nextSourceKey) await loadSourceOptions(nextSourceKey);
    }

    /**
     * 按模板派生来源加载动态候选项，并忽略快速切换后的迟到响应。
     *
     * @param sourceKey - 当前多模板集合共同绑定的消息源键。
     */
    async function loadSourceOptions(sourceKey: string) {
      const revision = ++sourceRevision;
      sourceOptions.value = {};
      sourceOptionsLoading.value = true;
      rebuildSchema();
      try {
        const result = await getMessageSourceOptions(sourceKey);
        if (
          revision === sourceRevision &&
          selectedSourceKey.value === sourceKey
        ) {
          sourceOptions.value = result;
        }
      } catch {
        // The request layer owns user-facing errors.
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
     * 协议目录热更新后重算可选项，使已打开弹窗不保留失效模板或订阅者展示。
     */
    function handleCatalogChanged() {
      rebuildSchema();
    }

    /**
     * 从有序模板集合派生来源并只提交协议字段，具体渠道配置不会进入通用订阅。
     */
    async function submit() {
      const revision = sessionRevision;
      const editingId = editingRow.value?.id;
      const { valid } = await formApi.validate();
      if (revision !== sessionRevision || !valid) return;
      const values = await formApi.getValues<MessageSubscriptionFormValues>();
      if (revision !== sessionRevision) return;
      const templateIds = normalizeTemplateIds(values.templateIds);
      const sourceKey = deriveTemplateSourceKey(props.templates, templateIds);
      if (!sourceKey) return;
      const definition = findSourceDefinition(props.sources, sourceKey);
      if (!definition) return;
      const sourceConfig = Object.fromEntries(
        definition.subscriptionFields.flatMap((field) => {
          const value = values[field.key];
          if (typeof value === 'string' && value) return [[field.key, value]];
          return [];
        }),
      );
      const payload: MessageManagementApi.MessageSubscriptionInput = {
        enabled: !!values.enabled,
        name: values.name.trim(),
        remark: normalizeOptionalText(values.remark),
        sourceConfig,
        subscriberKey: values.subscriberKey,
        templateIds,
      };

      modalApi.lock();
      try {
        if (editingId) {
          await updateMessageSubscription(editingId, payload);
        } else {
          await createMessageSubscription(payload);
        }
        if (revision !== sessionRevision) return;
        await modalApi.close();
        emit('saved');
      } finally {
        modalApi.unlock();
      }
    }

    watch(
      () => [props.sources, props.subscribers, props.templates],
      handleCatalogChanged,
      { deep: true },
    );

    expose({ openCreate, openEdit } satisfies MessageSubscriptionModalExposed);

    return () => (
      <Modal title={modalTitle.value}>
        <SubscriptionForm class="mx-2" />
      </Modal>
    );
  },
});

/**
 * 表单以模板集合驱动来源字段，并把订阅者限制为服务端注册的统一协议接收方。
 *
 * @param props - 可选模板、来源和订阅者目录。
 * @param selectedSourceKey - 当前模板集合共同绑定的来源键。
 * @param selectedTemplateIds - 当前按顺序选择的模板标识。
 * @param sourceFieldValues - 动态来源字段当前值。
 * @param sourceOptions - 当前来源字段候选项。
 * @param sourceOptionsLoading - 来源候选项是否仍在加载。
 * @returns 可直接交给 Vben Form 的多模板订阅 Schema。
 */
function createFormSchema(
  props: Readonly<{
    sources: MessageManagementApi.SystemMessageSourceDefinition[];
    subscribers: MessageManagementApi.MessageSubscriberDefinition[];
    templates: MessageManagementApi.MessageTemplateView[];
  }>,
  selectedSourceKey: Readonly<{ value: string }>,
  selectedTemplateIds: Readonly<{ value: string[] }>,
  sourceFieldValues: Readonly<{
    value: Record<string, string | undefined>;
  }>,
  sourceOptions: Readonly<{
    value: MessageManagementApi.SystemMessageSourceOptionsResponse;
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
      rules: z.string().trim().min(1, '请输入订阅名称').max(100),
    },
    {
      component: 'Select',
      componentProps: () => ({
        mode: 'multiple',
        options: props.templates.map((template) => ({
          disabled:
            !template.enabled ||
            (!!selectedSourceKey.value &&
              template.sourceKey !== selectedSourceKey.value &&
              !selectedTemplateIds.value.includes(template.id)),
          label: `${template.name} · ${template.sourceName}`,
          value: template.id,
        })),
        optionFilterProp: 'label',
        showSearch: true,
      }),
      fieldName: 'templateIds',
      label: '消息模板',
      rules: z.array(z.string()).min(1, '请至少选择一个消息模板'),
    },
    {
      component: 'Select',
      componentProps: () => ({
        options: props.subscribers.map((subscriber) => ({
          label: subscriber.displayName,
          value: subscriber.subscriberKey,
        })),
      }),
      fieldName: 'subscriberKey',
      label: '消息订阅者',
      rules: z.string().min(1, '请选择消息订阅者'),
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

/**
 * 将消息源字段定义转换为带依赖筛选的选择框 Schema。
 *
 * @param field - 消息源公开字段定义。
 * @param sourceFieldValues - 当前动态字段值。
 * @param sourceOptions - 当前来源候选项。
 * @param sourceOptionsLoading - 候选项加载状态。
 * @returns 单个动态来源字段 Schema。
 */
function createSourceFieldSchema(
  field: MessageManagementApi.SystemMessageSourceFieldDefinition,
  sourceFieldValues: Readonly<{
    value: Record<string, string | undefined>;
  }>,
  sourceOptions: Readonly<{
    value: MessageManagementApi.SystemMessageSourceOptionsResponse;
  }>,
  sourceOptionsLoading: Readonly<{ value: boolean }>,
): VbenFormSchema {
  const requiredMessage = `请选择${field.label}`;
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
    rules: (() => {
      if (field.required) return z.string().min(1, requiredMessage);
      return optionalRule;
    })(),
  };
}

/**
 * 根据字段依赖值筛选动态来源候选项。
 *
 * @param field - 当前来源字段定义。
 * @param sourceOptions - 消息源返回的全部候选项。
 * @param sourceFieldValues - 当前动态字段值。
 * @returns 满足依赖条件的候选项数组。
 */
function getFieldOptions(
  field: MessageManagementApi.SystemMessageSourceFieldDefinition,
  sourceOptions: MessageManagementApi.SystemMessageSourceOptionsResponse,
  sourceFieldValues: Record<string, string | undefined>,
): MessageManagementApi.SystemMessageSourceOptionDefinition[] {
  const options = sourceOptions[field.optionCollection] || [];
  if (!field.dependsOn) return options;
  const dependsOnValue = sourceFieldValues[field.dependsOn];
  if (!dependsOnValue) return [];
  return options.filter((option) => option.dependsOnValue === dependsOnValue);
}

/**
 * 按来源键查找消息管理公开的来源定义。
 *
 * @param sources - 消息管理来源目录。
 * @param sourceKey - 待匹配的稳定来源键。
 * @returns 匹配的来源定义；不存在时返回 undefined。
 */
function findSourceDefinition(
  sources: MessageManagementApi.SystemMessageSourceDefinition[],
  sourceKey: string,
): MessageManagementApi.SystemMessageSourceDefinition | undefined {
  return sources.find((source) => source.sourceKey === sourceKey);
}

/**
 * 从表单值提取当前来源公开声明的字符串字段。
 *
 * @param values - 包含通用字段与动态来源字段的表单值。
 * @param definition - 当前模板集合共同来源的字段定义。
 * @returns 仅包含来源公开字符串字段的配置对象。
 */
function pickSourceFieldValues(
  values: Record<string, unknown>,
  definition: MessageManagementApi.SystemMessageSourceDefinition,
): Record<string, string | undefined> {
  return Object.fromEntries(
    definition.subscriptionFields.map((field): [string, string | undefined] => {
      const value = values[field.key];
      if (typeof value === 'string') return [field.key, value];
      return [field.key, undefined];
    }),
  );
}

/**
 * 在来源元数据尚未返回时保留编辑记录中的动态来源配置。
 *
 * @param values - 当前多模板订阅表单值。
 * @returns 排除通用字段后的字符串配置。
 */
function pickUnknownSourceValues(
  values: MessageSubscriptionFormValues,
): Record<string, string | undefined> {
  const commonFields = new Set([
    'enabled',
    'name',
    'remark',
    'subscriberKey',
    'templateIds',
  ]);
  return Object.fromEntries(
    Object.entries(values).flatMap(([key, value]) => {
      if (!commonFields.has(key) && typeof value === 'string') {
        return [[key, value]];
      }
      return [];
    }),
  ) as Record<string, string | undefined>;
}

/**
 * 将未知表单值规范为不重复且保持选择顺序的模板标识数组。
 *
 * @param value - 多选组件返回的未知模板标识值。
 * @returns 保持首次出现顺序的字符串模板标识。
 */
function normalizeTemplateIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.flatMap((item) => {
        if (typeof item === 'string' && item) return [item];
        return [];
      }),
    ),
  ];
}

/**
 * 从已选模板集合派生共同消息源，混合来源时返回 null。
 *
 * @param templates - 可选择的完整消息模板目录。
 * @param templateIds - 当前按顺序选择的模板标识。
 * @returns 空集合返回空字符串，同源集合返回来源键，混源或缺失模板返回 null。
 */
function deriveTemplateSourceKey(
  templates: MessageManagementApi.MessageTemplateView[],
  templateIds: string[],
): null | string {
  if (templateIds.length === 0) return '';
  const byId = new Map(templates.map((template) => [template.id, template]));
  const firstTemplateId = templateIds[0];
  if (!firstTemplateId) return '';
  const first = byId.get(firstTemplateId);
  if (!first) return null;
  for (const templateId of templateIds) {
    const template = byId.get(templateId);
    if (!template || template.sourceKey !== first.sourceKey) return null;
  }
  return first.sourceKey;
}

/**
 * 将可选文本修剪为请求使用的稳定字符串。
 *
 * @param value - 表单返回的可选文本值。
 * @returns 字符串值的修剪结果，其他类型返回空字符串。
 */
function normalizeOptionalText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  return '';
}
