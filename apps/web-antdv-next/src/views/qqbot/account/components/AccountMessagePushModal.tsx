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
      async handleValuesChange(values, fieldsChanged) {
        if (!fieldsChanged.includes('subscriptionId')) return;
        selectedSubscriptionId.value =
          typeof values.subscriptionId === 'string'
            ? values.subscriptionId
            : '';
        const templateId =
          typeof values.templateId === 'string' ? values.templateId : '';
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
    const modalTitle = computed(() =>
      editingId.value ? '编辑消息推送' : '新增消息推送',
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

    function openCreate() {
      editingId.value = undefined;
      beginSession({
        enabled: true,
        subscriptionId: '',
        targets: [],
        templateId: '',
      });
    }

    function openEdit(row: QqbotMessagePushApi.QqbotMessagePublishBindingView) {
      editingId.value = row.id;
      beginSession({
        enabled: row.enabled,
        subscriptionId: row.subscriptionId,
        targets: row.targets.map((target) => ({
          targetId: target.targetId,
          ...(target.targetName ? { targetName: target.targetName } : {}),
          targetType: target.targetType,
        })),
        templateId: row.templateId,
      });
    }

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

    async function resetForm(values: AccountMessagePushFormValues) {
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

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
        await (currentEditingId
          ? updateAccountMessagePushBinding(selfId, currentEditingId, payload)
          : createAccountMessagePushBinding(selfId, payload));
        if (revision !== sessionRevision || selfId !== props.selfId) return;
        await modalApi.close();
        emit('saved');
      } finally {
        modalApi.unlock();
      }
    }

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

function formatSubscriptionLabel(
  subscription: QqbotMessagePushApi.MessageSubscriptionView,
): string {
  const reason =
    subscription.valid && subscription.enabled
      ? ''
      : ` · ${subscription.invalidReasonCode || 'disabled'}`;
  return `${subscription.name} · ${subscription.sourceName}${reason}`;
}

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

function normalizeBindingPayload(
  props: Readonly<{
    subscriptions: QqbotMessagePushApi.MessageSubscriptionView[];
    templates: QqbotMessagePushApi.MessageTemplateView[];
  }>,
  values: AccountMessagePushFormValues,
): QqbotMessagePushApi.QqbotMessagePublishBindingInput | undefined {
  if (
    !DECIMAL_ID_PATTERN.test(values.subscriptionId) ||
    !DECIMAL_ID_PATTERN.test(values.templateId) ||
    !isTemplateCompatible(props, values.subscriptionId, values.templateId) ||
    !Array.isArray(values.targets) ||
    values.targets.length === 0 ||
    values.targets.length > 100
  ) {
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
      ...(target.targetName?.trim() ? { targetName: target.targetName } : {}),
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
