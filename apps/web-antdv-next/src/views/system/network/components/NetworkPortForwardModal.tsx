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
    const modalTitle = computed(() => {
      if (editingRow.value) {
        return $t('system.network.editTitle');
      }
      return $t('system.network.createTitle');
    });
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[640px]',
      fullscreenButton: false,
      /**
       * 确认端口转发弹窗时校验端口、协议和受控结构字段，并提交当前分组。
       */
      async onConfirm() {
        await submit();
      },
      /**
       * 仅在端口转发弹窗打开时恢复上下文中的表单字段与校验状态。
       *
       * @param isOpen - 弹窗或抽屉最新显隐状态；true 表示已打开。
       */
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = modalApi.getData<NetworkPortForwardModalData>();
        void resetForm(values);
      },
    });

    /**
     * 清除端口转发编辑记录，并以固定目标 IPv4 和 UDP 默认协议打开新建弹窗。
     *
     * @param fixedTargetIpv4 - 端口转发固定使用的目标 IPv4 地址。
     */
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

    /**
     * 把端口转发分组的目标、端口和协议写入表单，并打开编辑弹窗。
     *
     * @param row - 要加载到端口转发编辑弹窗的现有分组。
     */
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

    /**
     * 清空端口转发表单后写入目标字段值，并移除上一轮校验错误。
     *
     * @param values - 重置后要写入端口转发表单的完整字段。
     */
    async function resetForm(
      values: Partial<SystemNetworkApi.PortForwardGroupInput>,
    ) {
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

    /**
     * 校验端口转发字段并阻止受控结构变更，随后新建或更新记录并派发 saved。
     */
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
        await (() => {
          if (editingRow.value) {
            return updateNetworkPortForwardGroup(editingRow.value.id, payload);
          }
          return createNetworkPortForwardGroup(payload);
        })();
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
        {(() => {
          if (structuralEditDisabledReason.value) {
            return (
              <Alert
                class="mb-4"
                showIcon
                title={structuralEditDisabledReason.value}
                type="warning"
              />
            );
          }
          return null;
        })()}
        <PortForwardForm class="mx-2" />
      </Modal>
    );
  },
});

/**
 * 生成端口转发名称、协议、内外端口和备注字段，并在编辑受控记录时锁定结构字段。
 *
 * @param structuralEditDisabled - 结构字段当前是否禁止编辑。
 * @returns 包含端口转发名称、协议、端口、备注及结构锁定状态的表单 Schema。
 */
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

/**
 * 当通道未同步、正在删除或 NATMap、UDP 保活器未停用时阻止修改结构字段。
 *
 * @param row - 提供 TCP、UDP 通道同步和机制状态的现有端口转发组。
 * @returns 阻止结构编辑的通道状态说明；全部通道可变更时返回 undefined。
 */
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

/**
 * 通过比较端口转发固定目标与协议等结构字段，判断本次提交是否包含结构变更。
 *
 * @param row - 作为结构字段比较基准的现有端口转发分组。
 * @param payload - 待提交的协议模式、内外端口和固定目标 IPv4。
 * @returns 任一结构字段与原记录不同时返回 true，否则返回 false。
 */
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
