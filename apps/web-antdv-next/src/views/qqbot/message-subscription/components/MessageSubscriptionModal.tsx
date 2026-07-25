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
  setup(props, { emit, expose }) {
    const editingRow = ref<QqbotMessagePushApi.MessageSubscriptionView>();
    const selectedPortForwardId = ref<string>();
    let sessionRevision = 0;
    const [SubscriptionForm, formApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
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
        selectedPortForwardId.value = values.portForwardId;
        await resetForm(values);
      },
    });

    function openCreate() {
      sessionRevision += 1;
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

    function openEdit(row: QqbotMessagePushApi.MessageSubscriptionView) {
      sessionRevision += 1;
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

    async function resetForm(values: MessageSubscriptionFormValues) {
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

    async function submit() {
      const revision = sessionRevision;
      const editingId = editingRow.value?.id;
      const { valid } = await formApi.validate();
      if (revision !== sessionRevision) return;
      if (!valid) return;
      const values = await formApi.getValues<MessageSubscriptionFormValues>();
      if (revision !== sessionRevision) return;
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

    expose({ openCreate, openEdit } satisfies MessageSubscriptionModalExposed);

    return () => (
      <Modal title={modalTitle.value}>
        <SubscriptionForm class="mx-2" />
      </Modal>
    );
  },
});

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
