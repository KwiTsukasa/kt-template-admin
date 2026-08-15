import type { VbenFormSchema } from '#/adapter/form';
import type { SystemNetworkApi } from '#/api/system/network';

import { computed, defineComponent, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Alert, message } from 'antdv-next';

import { useVbenForm, z } from '#/adapter/form';
import {
  createNetworkPortForwardGroup,
  updateNetworkPortForwardGroup,
} from '#/api/system/network';
import { $t } from '#/locales';

export interface NetworkPortForwardModalExposed {
  openCreate: (targetIpv4: string) => void;
  openEdit: (row: SystemNetworkApi.PortForwardGroup) => void;
}

interface NetworkPortForwardModalData {
  values: Partial<SystemNetworkApi.PortForwardGroupInput>;
}

const protocolModeOptions = [
  { label: 'TCP', value: 'tcp' },
  { label: 'UDP', value: 'udp' },
  { label: 'TCP+UDP', value: 'tcp_udp' },
];

export default defineComponent({
  name: 'NetworkPortForwardModal',
  emits: ['saved'],
  setup(_, { emit, expose }) {
    const editingRow = ref<SystemNetworkApi.PortForwardGroup>();
    const targetIpv4 = ref('');
    const structuralEditDisabledReason = computed(() =>
      getStructuralEditDisabledReason(editingRow.value),
    );
    const structuralEditDisabled = computed(
      () => !!structuralEditDisabledReason.value,
    );
    const [PortForwardForm, formApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-28 whitespace-nowrap',
      },
      layout: 'horizontal',
      schema: createFormSchema(structuralEditDisabled),
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const modalTitle = computed(() =>
      editingRow.value
        ? $t('system.network.editTitle')
        : $t('system.network.createTitle'),
    );
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[640px]',
      fullscreenButton: false,
      async onConfirm() {
        await submit();
      },
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = modalApi.getData<NetworkPortForwardModalData>();
        void resetForm(values);
      },
    });

    function openCreate(fixedTargetIpv4: string) {
      editingRow.value = undefined;
      targetIpv4.value = fixedTargetIpv4;
      modalApi
        .setData({
          values: {
            externalPort: undefined,
            internalPort: undefined,
            name: '',
            protocolMode: 'udp',
            remark: '',
          },
        } satisfies NetworkPortForwardModalData)
        .open();
    }

    function openEdit(row: SystemNetworkApi.PortForwardGroup) {
      editingRow.value = row;
      targetIpv4.value = row.targetIpv4;
      modalApi
        .setData({
          values: {
            externalPort: row.externalPort,
            internalPort: row.internalPort,
            name: row.name,
            protocolMode: row.protocolMode,
            remark: row.remark || '',
          },
        } satisfies NetworkPortForwardModalData)
        .open();
    }

    async function resetForm(
      values: Partial<SystemNetworkApi.PortForwardGroupInput>,
    ) {
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

    async function submit() {
      const { valid } = await formApi.validate();
      if (!valid) return;

      const values =
        await formApi.getValues<SystemNetworkApi.PortForwardGroupInput>();
      const payload: SystemNetworkApi.PortForwardGroupInput = {
        externalPort: Number(values.externalPort),
        internalPort: Number(values.internalPort),
        name: values.name.trim(),
        protocolMode: values.protocolMode,
        remark: values.remark?.trim() || '',
      };
      if (
        editingRow.value &&
        structuralEditDisabledReason.value &&
        isStructuralPayloadChanged(editingRow.value, payload)
      ) {
        message.warning(structuralEditDisabledReason.value);
        return;
      }

      modalApi.lock();
      try {
        await (editingRow.value
          ? updateNetworkPortForwardGroup(editingRow.value.id, payload)
          : createNetworkPortForwardGroup(payload));
        message.success($t('system.network.desiredSaved'));
        await modalApi.close();
        emit('saved');
      } finally {
        modalApi.unlock();
      }
    }

    expose({ openCreate, openEdit } satisfies NetworkPortForwardModalExposed);

    return () => (
      <Modal title={modalTitle.value}>
        <Alert
          class="mb-4"
          showIcon
          title={`${$t('system.network.targetIpv4')}: ${
            targetIpv4.value || '—'
          }`}
          type="info"
        />
        {structuralEditDisabledReason.value ? (
          <Alert
            class="mb-4"
            showIcon
            title={structuralEditDisabledReason.value}
            type="warning"
          />
        ) : null}
        <PortForwardForm class="mx-2" />
      </Modal>
    );
  },
});

function createFormSchema(
  structuralEditDisabled: Readonly<{ value: boolean }>,
): VbenFormSchema[] {
  const portRule = z
    .number({
      invalid_type_error: $t('system.network.portRequired'),
      required_error: $t('system.network.portRequired'),
    })
    .int($t('system.network.portRange'))
    .min(1, $t('system.network.portRange'))
    .max(65_535, $t('system.network.portRange'));
  return [
    {
      component: 'Input',
      componentProps: { allowClear: true, maxlength: 100 },
      fieldName: 'name',
      label: $t('system.network.name'),
      rules: z
        .string({
          invalid_type_error: $t('system.network.nameRequired'),
          required_error: $t('system.network.nameRequired'),
        })
        .trim()
        .min(1, $t('system.network.nameRequired'))
        .max(100, $t('system.network.nameTooLong')),
    },
    {
      component: 'Select',
      componentProps: () => ({
        disabled: structuralEditDisabled.value,
        options: protocolModeOptions,
      }),
      defaultValue: 'udp',
      fieldName: 'protocolMode',
      label: $t('system.network.protocolMode'),
      rules: z
        .string({
          invalid_type_error: $t('system.network.protocolModeRequired'),
          required_error: $t('system.network.protocolModeRequired'),
        })
        .refine(
          (value) => ['tcp', 'tcp_udp', 'udp'].includes(value),
          $t('system.network.protocolModeRequired'),
        ),
    },
    {
      component: 'InputNumber',
      componentProps: () => ({
        class: 'w-full',
        disabled: structuralEditDisabled.value,
        max: 65_535,
        min: 1,
        precision: 0,
      }),
      fieldName: 'externalPort',
      label: $t('system.network.externalPort'),
      rules: portRule,
    },
    {
      component: 'InputNumber',
      componentProps: () => ({
        class: 'w-full',
        disabled: structuralEditDisabled.value,
        max: 65_535,
        min: 1,
        precision: 0,
      }),
      fieldName: 'internalPort',
      label: $t('system.network.internalPort'),
      rules: portRule,
    },
    {
      component: 'Textarea',
      componentProps: { allowClear: true, maxlength: 500, rows: 3 },
      fieldName: 'remark',
      label: $t('system.network.remark'),
      rules: z
        .string({ invalid_type_error: $t('system.network.remarkInvalid') })
        .max(500, $t('system.network.remarkTooLong'))
        .optional()
        .or(z.literal('')),
    },
  ];
}

function getStructuralEditDisabledReason(
  row?: SystemNetworkApi.PortForwardGroup,
): string | undefined {
  if (!row) return undefined;
  const channels = [row.channels.tcp, row.channels.udp].filter(
    (channel): channel is SystemNetworkApi.PortForwardChannel => !!channel,
  );
  if (
    row.isDeleted ||
    channels.some(
      (channel) =>
        channel.isDeleted ||
        channel.desiredPresence !== 'present' ||
        channel.syncStatus !== 'synced',
    )
  ) {
    return $t('system.network.groupCoordinatingEditDisabled');
  }
  if (
    channels.some(
      (channel) =>
        channel.keeperDesiredEnabled ||
        channel.natmapDesiredEnabled ||
        channel.keeperStatus !== 'disabled' ||
        channel.natmapStatus !== 'disabled',
    )
  ) {
    return $t('system.network.disableMechanismsBeforeEdit');
  }
  return undefined;
}

function isStructuralPayloadChanged(
  row: SystemNetworkApi.PortForwardGroup,
  payload: SystemNetworkApi.PortForwardGroupInput,
): boolean {
  return (
    row.protocolMode !== payload.protocolMode ||
    row.externalPort !== payload.externalPort ||
    row.internalPort !== payload.internalPort
  );
}
