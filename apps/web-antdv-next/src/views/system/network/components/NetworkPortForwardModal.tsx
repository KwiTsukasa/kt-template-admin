import type { VbenFormSchema } from '#/adapter/form';
import type { SystemNetworkApi } from '#/api/system/network';

import { computed, defineComponent, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Alert, message } from 'antdv-next';

import { useVbenForm, z } from '#/adapter/form';
import {
  createNetworkPortForward,
  updateNetworkPortForward,
} from '#/api/system/network';
import { $t } from '#/locales';

export interface NetworkPortForwardModalExposed {
  openCreate: (targetIpv4: string) => void;
  openEdit: (row: SystemNetworkApi.PortForward) => void;
}

interface NetworkPortForwardModalData {
  values: Partial<SystemNetworkApi.PortForwardInput>;
}

const protocolOptions = [
  { label: 'TCP', value: 'tcp' },
  { label: 'UDP', value: 'udp' },
];

export default defineComponent({
  name: 'NetworkPortForwardModal',
  emits: ['saved'],
  setup(_, { emit, expose }) {
    const editingRow = ref<SystemNetworkApi.PortForward>();
    const targetIpv4 = ref('');
    const [PortForwardForm, formApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      layout: 'horizontal',
      schema: createFormSchema(),
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
            protocol: 'udp',
            remark: '',
          },
        } satisfies NetworkPortForwardModalData)
        .open();
    }

    function openEdit(row: SystemNetworkApi.PortForward) {
      editingRow.value = row;
      targetIpv4.value = row.targetIpv4;
      modalApi
        .setData({
          values: {
            externalPort: row.externalPort,
            internalPort: row.internalPort,
            name: row.name,
            protocol: row.protocol,
            remark: row.remark || '',
          },
        } satisfies NetworkPortForwardModalData)
        .open();
    }

    async function resetForm(
      values: Partial<SystemNetworkApi.PortForwardInput>,
    ) {
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

    async function submit() {
      const { valid } = await formApi.validate();
      if (!valid) return;

      const values =
        await formApi.getValues<SystemNetworkApi.PortForwardInput>();
      const payload: SystemNetworkApi.PortForwardInput = {
        externalPort: Number(values.externalPort),
        internalPort: Number(values.internalPort),
        name: values.name.trim(),
        protocol: values.protocol,
        remark: values.remark?.trim() || '',
      };
      if (
        editingRow.value?.keeperDesiredEnabled &&
        (payload.protocol !== 'udp' ||
          payload.externalPort !== payload.internalPort)
      ) {
        message.warning($t('system.network.disableKeeperBeforeEdit'));
        return;
      }

      modalApi.lock();
      try {
        await (editingRow.value
          ? updateNetworkPortForward(editingRow.value.id, payload)
          : createNetworkPortForward(payload));
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
          message={`${$t('system.network.targetIpv4')}: ${
            targetIpv4.value || '-'
          }`}
          showIcon
          type="info"
        />
        <PortForwardForm class="mx-2" />
      </Modal>
    );
  },
});

function createFormSchema(): VbenFormSchema[] {
  const portRule = z
    .number()
    .int()
    .min(1, $t('system.network.portRange'))
    .max(65_535, $t('system.network.portRange'));
  return [
    {
      component: 'Input',
      componentProps: { allowClear: true, maxlength: 100 },
      fieldName: 'name',
      label: $t('system.network.name'),
      rules: z.string().trim().min(1).max(100),
    },
    {
      component: 'Select',
      componentProps: { options: protocolOptions },
      defaultValue: 'udp',
      fieldName: 'protocol',
      label: $t('system.network.protocol'),
      rules: z.enum(['tcp', 'udp']),
    },
    {
      component: 'InputNumber',
      componentProps: {
        class: 'w-full',
        max: 65_535,
        min: 1,
        precision: 0,
      },
      fieldName: 'externalPort',
      label: $t('system.network.externalPort'),
      rules: portRule,
    },
    {
      component: 'InputNumber',
      componentProps: {
        class: 'w-full',
        max: 65_535,
        min: 1,
        precision: 0,
      },
      fieldName: 'internalPort',
      label: $t('system.network.internalPort'),
      rules: portRule,
    },
    {
      component: 'Textarea',
      componentProps: { allowClear: true, maxlength: 500, rows: 3 },
      fieldName: 'remark',
      label: $t('system.network.remark'),
      rules: z.string().max(500).optional().or(z.literal('')),
    },
  ];
}
