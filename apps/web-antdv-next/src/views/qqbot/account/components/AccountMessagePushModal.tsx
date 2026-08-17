import type { PropType } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';

import { computed, defineComponent, markRaw, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm, z } from '#/adapter/form';
import {
  createAccountMessagePushBinding,
  updateAccountMessagePushBinding,
} from '#/api/qqbot/message-push';

import MessagePushTargetPicker, {
  isValidMessagePushTargetId,
} from './MessagePushTargetPicker';

export interface AccountMessagePushModalExposed {
  openCreate: () => void;
  openEdit: (row: QqbotMessagePushApi.QqbotMessagePublishBindingView) => void;
}

interface AccountMessagePushFormValues {
  enabled: boolean;
  subscriptionId: string;
  targets: QqbotMessagePushApi.QqbotMessagePublishTargetInput[];
  templateId: string;
}

interface AccountMessagePushModalData {
  selfId: string;
  sessionRevision: number;
  values: AccountMessagePushFormValues;
}

const DECIMAL_ID_PATTERN = /^[1-9]\d*$/;

export default defineComponent({
  name: 'AccountMessagePushModal',
  props: {
    selfId: {
      required: true,
      type: String,
    },
    subscriptions: {
      required: true,
      type: Array as PropType<QqbotMessagePushApi.MessageSubscriptionView[]>,
    },
    targetOptions: {
      default: undefined,
      type: Object as PropType<
        QqbotMessagePushApi.QqbotMessagePushTargetOptionsResponse | undefined
      >,
    },
    targetOptionsLoading: {
      default: false,
      type: Boolean,
    },
    templates: {
      required: true,
      type: Array as PropType<QqbotMessagePushApi.MessageTemplateView[]>,
    },
  },
  emits: ['saved'],
  setup(props, { emit, expose }) {
    const editingId = ref<string>();
    const modalOpen = ref(false);
    const selectedSubscriptionId = ref('');
    let sessionRevision = 0;
    let sessionSelfId = '';
    const [BindingForm, formApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-32 whitespace-nowrap',
      },
      /**
       * 订阅变化时同步当前订阅，并清空与新订阅不兼容的已选模板。
       *
       * @param values - 账号推送表单当前的订阅和模板标识；订阅变化后会校验模板兼容性。
       * @param fieldsChanged - 本次发生变化的表单字段名集合，用于只处理相关依赖字段。
       */
      async handleValuesChange(values, fieldsChanged) {
        if (!fieldsChanged.includes('subscriptionId')) return;
        if (typeof values.subscriptionId === 'string') {
          selectedSubscriptionId.value = values.subscriptionId;
        } else {
          selectedSubscriptionId.value = '';
        }
        const templateId = (() => {
          if (typeof values.templateId === 'string') {
            return values.templateId;
          }
          return '';
        })();
        if (!templateId) return;
        if (
          !isTemplateCompatible(props, selectedSubscriptionId.value, templateId)
        ) {
          await formApi.setValues({ templateId: '' });
        }
      },
      layout: 'horizontal',
      schema: createFormSchema(props, selectedSubscriptionId),
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const modalTitle = computed(() => {
      if (editingId.value) {
        return '编辑消息推送';
      }
      return '新增消息推送';
    });
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[760px]',
      fullscreenButton: false,
      /**
       * 当用户确认账号消息推送弹窗时提交绑定；持久化错误由表单请求层统一展示。
       */
      async onConfirm() {
        try {
          await submit();
        } catch {
          // The request/form layer already presents the persistence error.
        }
      },
      /**
       * 当账号消息推送弹窗打开时校验账号与会话代次；失效会话立即关闭，有效会话恢复绑定字段。
       *
       * @param isOpen - 弹窗或抽屉最新显隐状态；true 表示已打开。
       */
      async onOpenChange(isOpen: boolean) {
        modalOpen.value = isOpen;
        if (!isOpen) return;
        const data = modalApi.getData<AccountMessagePushModalData>();
        if (
          data.sessionRevision !== sessionRevision ||
          data.selfId !== props.selfId
        ) {
          await modalApi.close();
          return;
        }
        selectedSubscriptionId.value = data.values.subscriptionId;
        await resetForm(data.values);
      },
    });

    /**
     * 清除绑定编辑标识，并以启用、空订阅、空模板和空目标开始新会话。
     */
    function openCreate() {
      editingId.value = undefined;
      beginSession({
        enabled: true,
        subscriptionId: '',
        targets: [],
        templateId: '',
      });
    }

    /**
     * 把现有消息推送绑定转换为订阅、模板和目标字段，并开始编辑会话。
     *
     * @param row - 要加载到编辑弹窗的账号消息推送绑定。
     */
    function openEdit(row: QqbotMessagePushApi.QqbotMessagePublishBindingView) {
      editingId.value = row.id;
      beginSession({
        enabled: row.enabled,
        subscriptionId: row.subscriptionId,
        targets: row.targets.map((target) => ({
          targetId: target.targetId,
          ...(() => {
            if (target.targetName) {
              return { targetName: target.targetName };
            }
            return {};
          })(),
          targetType: target.targetType,
        })),
        templateId: row.templateId,
      });
    }

    /**
     * 初始化本次会话标识与心跳状态，并撤销上一轮仍在等待的请求。
     *
     * @param values - 新一轮弹窗会话要写入表单的账号推送绑定字段。
     */
    function beginSession(values: AccountMessagePushFormValues) {
      sessionRevision += 1;
      sessionSelfId = props.selfId;
      selectedSubscriptionId.value = values.subscriptionId;
      modalApi
        .setData({
          selfId: sessionSelfId,
          sessionRevision,
          values,
        } satisfies AccountMessagePushModalData)
        .open();
    }

    /**
     * 清空账号消息推送表单后写入目标绑定值，并移除上一轮校验错误。
     *
     * @param values - 重置后要写入账号消息推送表单的绑定字段。
     */
    async function resetForm(values: AccountMessagePushFormValues) {
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

    /**
     * 校验并规范化账号消息推送绑定；仅当前账号会话仍有效时保存、关闭弹窗并派发 saved。
     */
    async function submit() {
      const revision = sessionRevision;
      const selfId = sessionSelfId;
      const currentEditingId = editingId.value;
      if (!selfId || selfId !== props.selfId) return;
      const { valid } = await formApi.validate();
      if (revision !== sessionRevision || selfId !== props.selfId) return;
      if (!valid) return;
      const values = await formApi.getValues<AccountMessagePushFormValues>();
      if (revision !== sessionRevision || selfId !== props.selfId) return;
      const payload = normalizeBindingPayload(props, values);
      if (!payload) return;
      if (revision !== sessionRevision || selfId !== props.selfId) return;

      modalApi.lock();
      try {
        await (() => {
          if (currentEditingId) {
            return updateAccountMessagePushBinding(
              selfId,
              currentEditingId,
              payload,
            );
          }
          return createAccountMessagePushBinding(selfId, payload);
        })();
        if (revision !== sessionRevision || selfId !== props.selfId) return;
        await modalApi.close();
        emit('saved');
      } finally {
        modalApi.unlock();
      }
    }

    /**
     * 账号切换时使旧请求与旧订阅失效，避免前一账号结果覆盖当前页面。
     */
    async function invalidateForSelfIdChange() {
      sessionRevision += 1;
      sessionSelfId = '';
      editingId.value = undefined;
      selectedSubscriptionId.value = '';
      if (modalOpen.value) await modalApi.close();
    }

    watch(
      () => props.selfId,
      (selfId, previousSelfId) => {
        if (selfId === previousSelfId) return;
        void invalidateForSelfIdChange();
      },
    );

    expose({ openCreate, openEdit } satisfies AccountMessagePushModalExposed);

    return () => (
      <Modal title={modalTitle.value}>
        <BindingForm class="mx-2" />
      </Modal>
    );
  },
});

/**
 * 生成订阅、兼容模板、推送目标与启用状态字段，并约束目标类型、数量和标识格式。
 *
 * @param props - 账号 selfId、订阅与模板列表、目标候选及其加载和可用状态。
 * @param selectedSubscriptionId - 当前选中订阅的唯一标识，用于筛选兼容模板。
 * @returns 包含订阅、兼容模板、推送目标和启用状态约束的表单 Schema。
 */
function createFormSchema(
  props: Readonly<{
    selfId: string;
    subscriptions: QqbotMessagePushApi.MessageSubscriptionView[];
    targetOptions:
      | QqbotMessagePushApi.QqbotMessagePushTargetOptionsResponse
      | undefined;
    targetOptionsLoading: boolean;
    templates: QqbotMessagePushApi.MessageTemplateView[];
  }>,
  selectedSubscriptionId: Readonly<{ value: string }>,
): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: () => ({
        options: props.subscriptions.map((subscription) => ({
          disabled: !subscription.enabled || !subscription.valid,
          label: formatSubscriptionLabel(subscription),
          value: subscription.id,
        })),
      }),
      fieldName: 'subscriptionId',
      label: '消息订阅',
      rules: z
        .string({
          invalid_type_error: '消息订阅格式不正确',
          required_error: '请选择消息订阅',
        })
        .regex(DECIMAL_ID_PATTERN, '请选择消息订阅'),
    },
    {
      component: 'Select',
      componentProps: () => ({
        options: compatibleTemplates(props, selectedSubscriptionId.value).map(
          (template) => ({
            disabled: !template.enabled,
            label: `${template.name} · ${template.sourceName}`,
            value: template.id,
          }),
        ),
      }),
      fieldName: 'templateId',
      label: '消息模板',
      rules: z
        .string({
          invalid_type_error: '消息模板格式不正确',
          required_error: '请选择消息模板',
        })
        .regex(DECIMAL_ID_PATTERN, '请选择消息模板'),
    },
    {
      component: markRaw(MessagePushTargetPicker),
      componentProps: () => ({
        available: props.targetOptions?.available ?? true,
        loading: props.targetOptionsLoading,
        options: props.targetOptions?.options || [],
        reasonCode: props.targetOptions?.reasonCode ?? null,
      }),
      fieldName: 'targets',
      label: '推送目标',
      modelPropName: 'value',
      rules: z
        .array(
          z.object({
            targetId: z
              .string({
                invalid_type_error: '推送目标格式不正确',
                required_error: '请输入推送目标',
              })
              .regex(/^[1-9]\d{4,19}$/, '推送目标必须是有效的 QQ 号或群号'),
            targetName: z
              .string({ invalid_type_error: '推送目标名称格式不正确' })
              .max(120, '推送目标名称不能超过 120 个字符')
              .optional(),
            targetType: z.enum(['group', 'private'], {
              message: '推送目标类型无效',
            }),
          }),
          {
            invalid_type_error: '推送目标格式不正确',
            required_error: '请至少选择一个推送目标',
          },
        )
        .min(1, '请至少选择一个推送目标')
        .max(100, '推送目标不能超过 100 个'),
    },
    {
      component: 'Switch',
      defaultValue: true,
      fieldName: 'enabled',
      label: '启用',
    },
  ];
}

/**
 * 将订阅名称、来源和失效原因，生成绑定下拉框的展示文本。
 *
 * @param subscription - 当前编辑或匹配的消息订阅记录。
 * @returns 包含订阅名称、来源及可选失效原因的下拉选项文本。
 */
function formatSubscriptionLabel(
  subscription: QqbotMessagePushApi.MessageSubscriptionView,
): string {
  const reason = (() => {
    if (subscription.valid && subscription.enabled) {
      return '';
    }
    return ` · ${subscription.invalidReasonCode || 'disabled'}`;
  })();
  return `${subscription.name} · ${subscription.sourceName}${reason}`;
}

/**
 * 根据订阅来源能力筛出可绑定的消息模板，排除事件类型不兼容的选项。
 *
 * @param props - 用于按来源关联的消息订阅和模板集合。
 * @param subscriptionId - 用于查找消息订阅及其来源能力的唯一标识。
 * @returns 与指定订阅来源兼容的消息模板列表。
 */
function compatibleTemplates(
  props: Readonly<{
    subscriptions: QqbotMessagePushApi.MessageSubscriptionView[];
    templates: QqbotMessagePushApi.MessageTemplateView[];
  }>,
  subscriptionId: string,
): QqbotMessagePushApi.MessageTemplateView[] {
  const sourceKey = props.subscriptions.find(
    (subscription) => subscription.id === subscriptionId,
  )?.sourceKey;
  if (!sourceKey) return [];
  return props.templates.filter((template) => template.sourceKey === sourceKey);
}

/**
 * 根据订阅来源支持的事件类型判断消息模板能否绑定。
 *
 * @param props - 用于核对订阅来源与模板来源的订阅和模板集合。
 * @param subscriptionId - 用于查找消息订阅及其来源能力的唯一标识。
 * @param templateId - 用于查找待绑定消息模板的唯一标识。
 * @returns 订阅来源支持模板事件类型时返回 true；找不到来源、模板或能力时返回 false。
 */
function isTemplateCompatible(
  props: Readonly<{
    subscriptions: QqbotMessagePushApi.MessageSubscriptionView[];
    templates: QqbotMessagePushApi.MessageTemplateView[];
  }>,
  subscriptionId: string,
  templateId: string,
): boolean {
  return compatibleTemplates(props, subscriptionId).some(
    (template) => template.id === templateId,
  );
}

/**
 * 校验订阅、模板和最多一百个推送目标，并生成可提交的账号绑定载荷。
 *
 * @param props - 用于验证订阅存在且模板来源兼容的订阅和模板集合。
 * @param values - 待校验的订阅标识、模板标识、启用状态和推送目标表单值。
 * @returns 校验通过的账号消息推送绑定载荷；订阅、模板或目标非法时返回 undefined。
 */
function normalizeBindingPayload(
  props: Readonly<{
    subscriptions: QqbotMessagePushApi.MessageSubscriptionView[];
    templates: QqbotMessagePushApi.MessageTemplateView[];
  }>,
  values: AccountMessagePushFormValues,
): QqbotMessagePushApi.QqbotMessagePublishBindingInput | undefined {
  if (!DECIMAL_ID_PATTERN.test(values.subscriptionId)) return undefined;
  if (!DECIMAL_ID_PATTERN.test(values.templateId)) return undefined;
  if (!isTemplateCompatible(props, values.subscriptionId, values.templateId)) {
    return undefined;
  }
  if (!Array.isArray(values.targets)) return undefined;
  if (values.targets.length === 0 || values.targets.length > 100) {
    return undefined;
  }
  const targets: QqbotMessagePushApi.QqbotMessagePublishTargetInput[] = [];
  for (const target of values.targets) {
    if (
      !target ||
      typeof target.targetId !== 'string' ||
      !isValidMessagePushTargetId(target.targetId) ||
      (target.targetType !== 'group' && target.targetType !== 'private')
    ) {
      return undefined;
    }
    targets.push({
      targetId: target.targetId,
      ...(() => {
        if (target.targetName?.trim()) {
          return { targetName: target.targetName };
        }
        return {};
      })(),
      targetType: target.targetType,
    });
  }
  return {
    enabled: !!values.enabled,
    subscriptionId: values.subscriptionId,
    targets,
    templateId: values.templateId,
  };
}
