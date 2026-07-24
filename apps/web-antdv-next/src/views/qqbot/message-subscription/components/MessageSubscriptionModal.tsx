import type { PropType } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';

import { computed, defineComponent, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm, z } from '#/adapter/form';
import {
  createMessageSubscription,
  updateMessageSubscription,
} from '#/api/qqbot/message-push';

export interface MessageSubscriptionModalExposed {
  openCreate: () => void;
  openEdit: (row: QqbotMessagePushApi.MessageSubscriptionView) => void;
}

interface MessageSubscriptionFormValues {
  ddnsRecordId?: string;
  enabled: boolean;
  name: string;
  portForwardId?: string;
  remark?: string;
  sourceKey: string;
}

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
    stunOptions: {
      default: undefined,
      type: Object as PropType<
        QqbotMessagePushApi.StunMappingPortChangedOptionsResponse | undefined
      >,
    },
  },
  emits: ['saved'],
  /**
   * Owns one source-only create/edit form without fetching page metadata or lists.
   */
  setup(props, { emit, expose }) {
    const editingRow = ref<QqbotMessagePushApi.MessageSubscriptionView>();
    const selectedPortForwardId = ref<string>();
    const [SubscriptionForm, formApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      /**
       * Keeps the DDNS choice compatible with the selected port-forward option.
       * @param values - Current form values after the change.
       * @param fieldsChanged - Field names changed by this form event.
       */
      async handleValuesChange(values, fieldsChanged) {
        if (!fieldsChanged.includes('portForwardId')) return;
        selectedPortForwardId.value =
          typeof values.portForwardId === 'string'
            ? values.portForwardId
            : undefined;
        const currentDdnsId =
          typeof values.ddnsRecordId === 'string'
            ? values.ddnsRecordId
            : undefined;
        if (!currentDdnsId) return;
        const currentDdns = props.stunOptions?.ddnsRecords.find(
          (option) => option.id === currentDdnsId,
        );
        if (
          !currentDdns ||
          currentDdns.portForwardId !== selectedPortForwardId.value
        ) {
          await formApi.setValues({ ddnsRecordId: undefined });
        }
      },
      layout: 'horizontal',
      schema: createFormSchema(props, selectedPortForwardId),
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const modalTitle = computed(() =>
      editingRow.value ? '编辑消息订阅' : '新建消息订阅',
    );
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[680px]',
      fullscreenButton: false,
      /** Validates and persists the current modal session. */
      async onConfirm() {
        await submit();
      },
      /**
       * Restores session values after destroy-on-close modal content has mounted.
       * @param isOpen - Whether the modal content is visible.
       */
      async onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = modalApi.getData<MessageSubscriptionModalData>();
        selectedPortForwardId.value = values.portForwardId;
        await resetForm(values);
      },
    });

    /** Opens a fresh subscription form with no values retained from an edit. */
    function openCreate() {
      editingRow.value = undefined;
      modalApi
        .setData({
          values: {
            ddnsRecordId: undefined,
            enabled: true,
            name: '',
            portForwardId: undefined,
            remark: '',
            sourceKey: props.sources[0]?.sourceKey || '',
          },
        } satisfies MessageSubscriptionModalData)
        .open();
    }

    /**
     * Opens an edit session with only the six user-editable values.
     * @param row - Subscription row selected from the page-owned KtTable.
     */
    function openEdit(row: QqbotMessagePushApi.MessageSubscriptionView) {
      editingRow.value = row;
      modalApi
        .setData({
          values: {
            ddnsRecordId: row.sourceConfig.ddnsRecordId,
            enabled: row.enabled,
            name: row.name,
            portForwardId: row.sourceConfig.portForwardId,
            remark: row.remark || '',
            sourceKey: row.sourceKey,
          },
        } satisfies MessageSubscriptionModalData)
        .open();
    }

    /**
     * Resets the mounted form before installing one isolated modal session.
     * @param values - Exact editable values for the current create/edit session.
     */
    async function resetForm(values: MessageSubscriptionFormValues) {
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

    /** Persists the exact source-only payload and closes only after success. */
    async function submit() {
      const { valid } = await formApi.validate();
      if (!valid) return;
      const values = await formApi.getValues<MessageSubscriptionFormValues>();
      const payload: QqbotMessagePushApi.MessageSubscriptionInput = {
        enabled: !!values.enabled,
        name: values.name.trim(),
        remark: values.remark?.trim() || '',
        sourceConfig: {
          ddnsRecordId: values.ddnsRecordId,
          portForwardId: values.portForwardId,
        },
        sourceKey: values.sourceKey,
      };

      modalApi.lock();
      try {
        await (editingRow.value
          ? updateMessageSubscription(editingRow.value.id, payload)
          : createMessageSubscription(payload));
        await modalApi.close();
        emit('saved');
      } finally {
        modalApi.unlock();
      }
    }

    expose({ openCreate, openEdit } satisfies MessageSubscriptionModalExposed);

    return () => (
      <Modal title={modalTitle.value}>
        <SubscriptionForm class="mx-2" />
      </Modal>
    );
  },
});

/**
 * Builds the locked six-field schema from page-owned metadata.
 * @param props - Source catalog and STUN choices loaded once by the page.
 * @param selectedPortForwardId - Current port used to filter matching DDNS rows.
 * @returns Vben form fields in the approved source-only order.
 */
function createFormSchema(
  props: Readonly<{
    sources: QqbotMessagePushApi.SystemMessageSourceDefinition[];
    stunOptions:
      | QqbotMessagePushApi.StunMappingPortChangedOptionsResponse
      | undefined;
  }>,
  selectedPortForwardId: Readonly<{ value: string | undefined }>,
): VbenFormSchema[] {
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
      component: 'Select',
      componentProps: () => ({
        allowClear: true,
        options: (props.stunOptions?.portForwards || []).map((option) =>
          formatPortForwardOption(option),
        ),
      }),
      fieldName: 'portForwardId',
      label: '端口转发',
      rules: z.string().min(1),
    },
    {
      component: 'Select',
      componentProps: () => ({
        allowClear: true,
        options: (props.stunOptions?.ddnsRecords || [])
          .filter(
            (option) => option.portForwardId === selectedPortForwardId.value,
          )
          .map((option) => formatDdnsOption(option)),
      }),
      fieldName: 'ddnsRecordId',
      label: 'IPv4 DDNS',
      rules: z.string().min(1),
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

/**
 * Formats one server-evaluated port choice without coercing its string ID.
 * @param option - Port-forward option returned by the source options API.
 * @returns Select option preserving eligibility and stable reason code.
 */
function formatPortForwardOption(
  option: QqbotMessagePushApi.StunMappingPortChangedOptionsResponse['portForwards'][number],
) {
  const reason = option.eligible
    ? ''
    : ` · ${option.disabledReasonCode || 'unavailable'}`;
  return {
    disabled: !option.eligible,
    label: `${option.name} · ${option.protocol.toUpperCase()}:${option.externalPort}${reason}`,
    value: option.id,
  };
}

/**
 * Formats one server-evaluated DDNS choice without coercing its string ID.
 * @param option - DDNS option already filtered to the selected port.
 * @returns Select option preserving eligibility and stable reason code.
 */
function formatDdnsOption(
  option: QqbotMessagePushApi.StunMappingPortChangedOptionsResponse['ddnsRecords'][number],
) {
  const reason = option.eligible
    ? ''
    : ` · ${option.disabledReasonCode || 'unavailable'}`;
  return {
    disabled: !option.eligible,
    label: `${option.name} · ${option.fqdn}${reason}`,
    value: option.id,
  };
}
