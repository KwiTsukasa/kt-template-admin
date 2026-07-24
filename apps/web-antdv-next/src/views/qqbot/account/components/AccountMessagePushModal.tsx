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
  /** Owns one account-scoped create/edit session without selecting another account. */
  setup(props, { emit, expose }) {
    const editingId = ref<string>();
    const modalOpen = ref(false);
    const selectedSubscriptionId = ref('');
    let sessionRevision = 0;
    let sessionSelfId = '';
    const [BindingForm, formApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      /**
       * Keeps the selected template only while it remains source-compatible.
       * @param values - Current form values after the update.
       * @param fieldsChanged - Exact form fields changed by this event.
       */
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
    /** Derives the title from the current isolated binding identity. */
    const modalTitle = computed(() =>
      editingId.value ? '编辑消息推送' : '新增消息推送',
    );
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[760px]',
      fullscreenButton: false,
      /** Validates and persists the active account-scoped session. */
      async onConfirm() {
        await submit();
      },
      /**
       * Restores only the latest session after destroy-on-close content mounts.
       * @param isOpen - Whether the modal content is currently mounted.
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

    /** Opens a fresh four-field binding session for the current account path. */
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
     * Opens an edit session with only API-provided editable binding values.
     * @param row - Account binding selected from the panel-owned KtTable.
     */
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

    /**
     * Stores one revision-bound modal payload before opening its content.
     * @param values - Exact four editable values for the new modal session.
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
     * Resets the mounted form before installing one isolated session.
     * @param values - Exact values captured before opening the modal.
     */
    async function resetForm(values: AccountMessagePushFormValues) {
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

    /** Validates and persists one session without putting selfId in the body. */
    async function submit() {
      const revision = sessionRevision;
      const selfId = sessionSelfId;
      if (!selfId || selfId !== props.selfId) return;
      const { valid } = await formApi.validate();
      if (!valid) return;
      const values = await formApi.getValues<AccountMessagePushFormValues>();
      const payload = normalizeBindingPayload(props, values);
      if (!payload) return;
      const currentEditingId = editingId.value;

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

    /**
     * Invalidates an open old-account session before its path identity changes.
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
 * Builds the exact account-binding schema with the local controlled picker.
 * @param props - Page-owned subscriptions, templates, and target candidates.
 * @param selectedSubscriptionId - Current subscription driving template options.
 * @returns Four fields in subscription/template/targets/enabled order.
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
      rules: z.string().regex(DECIMAL_ID_PATTERN),
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
      rules: z.string().regex(DECIMAL_ID_PATTERN),
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
            targetId: z.string().regex(/^[1-9]\d{4,19}$/),
            targetName: z.string().max(120).optional(),
            targetType: z.enum(['group', 'private']),
          }),
        )
        .min(1)
        .max(100),
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
 * Formats one subscription while retaining server validity information.
 * @param subscription - Global subscription available to the current account.
 * @returns Select label with a stable invalid reason when applicable.
 */
function formatSubscriptionLabel(
  subscription: QqbotMessagePushApi.MessageSubscriptionView,
): string {
  const reason =
    subscription.valid && subscription.enabled
      ? ''
      : ` · ${subscription.invalidReasonCode || 'disabled'}`;
  return `${subscription.name} · ${subscription.sourceName}${reason}`;
}

/**
 * Returns templates whose source matches the selected global subscription.
 * @param props - Current page-owned subscription/template collections.
 * @param subscriptionId - Exact selected subscription string ID.
 * @returns Source-compatible template rows in server order.
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
 * Checks template/source compatibility without interpreting numeric IDs.
 * @param props - Current subscription/template collections.
 * @param subscriptionId - Selected subscription string ID.
 * @param templateId - Existing template string ID.
 * @returns Whether both rows exist and share the exact source key.
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
 * Validates the exact four-field payload before invoking the account API.
 * @param props - Current source-compatible metadata.
 * @param values - Form-owned binding values.
 * @returns A clean API payload or undefined when any ID/target is invalid.
 */
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
