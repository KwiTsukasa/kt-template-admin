import type { VbenFormSchema } from '#/adapter/form';
import type { SystemNetworkApi } from '#/api/system/network';

import { computed, defineComponent, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Alert, message } from 'antdv-next';

import { useVbenForm, z } from '#/adapter/form';
import {
  createNetworkDdnsRecord,
  getNetworkDdnsSourceOptions,
  updateNetworkDdnsRecord,
} from '#/api/system/network';
import { $t } from '#/locales';

export interface NetworkDdnsRecordModalExposed {
  openCreate: () => void;
  openEdit: (row: SystemNetworkApi.DdnsRecord) => void;
}

interface NetworkDdnsRecordFormValues {
  domain: string;
  enabled: boolean;
  name: string;
  portForwardId?: string;
  recordType: SystemNetworkApi.DdnsRecordType;
  remark?: string;
  subDomain: string;
}

interface NetworkDdnsRecordModalData {
  values: Partial<NetworkDdnsRecordFormValues>;
}

const recordTypeOptions = [
  { label: 'A (IPv4)', value: 'A' },
  { label: 'AAAA (IPv6)', value: 'AAAA' },
];
const dnsLabelPattern = /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i;

export default defineComponent({
  name: 'NetworkDdnsRecordModal',
  emits: ['saved'],
  setup(_, { emit, expose }) {
    const editingRow = ref<SystemNetworkApi.DdnsRecord>();
    const recordType = ref<SystemNetworkApi.DdnsRecordType>('A');
    const sourceOptions = ref<SystemNetworkApi.DdnsSourceOption[]>([]);
    let sourceLoadRevision = 0;
    const [DdnsForm, formApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      async handleValuesChange(values, fieldsChanged) {
        if (!fieldsChanged.includes('recordType')) return;
        const nextRecordType =
          values.recordType === 'AAAA' ? 'AAAA' : ('A' as const);
        recordType.value = nextRecordType;
        await formApi.setValues({ portForwardId: undefined });
        await loadSourceOptions(nextRecordType);
      },
      layout: 'horizontal',
      schema: createFormSchema(sourceOptions),
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const modalTitle = computed(() =>
      editingRow.value
        ? $t('system.network.ddnsEditTitle')
        : $t('system.network.ddnsCreateTitle'),
    );
    const agentIpv6Source = computed(() =>
      sourceOptions.value.find((source) => source.sourceType === 'agent_ipv6'),
    );
    const agentIpv6Summary = computed(() => {
      const source = agentIpv6Source.value;
      if (!source) return $t('system.network.ddnsSourceLoading');
      if (!source.eligible) {
        return formatSourceDisabledReason(source.disabledReasonCode);
      }
      return (
        source.currentAddress || $t('system.network.ddnsWaitingSourceAddress')
      );
    });
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[680px]',
      fullscreenButton: false,
      async onConfirm() {
        await submit();
      },
      async onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = modalApi.getData<NetworkDdnsRecordModalData>();
        const nextRecordType =
          values.recordType === 'AAAA' ? 'AAAA' : ('A' as const);
        recordType.value = nextRecordType;
        await resetForm(values);
        if (recordType.value !== nextRecordType) return;
        await loadSourceOptions(nextRecordType);
      },
    });

    function openCreate() {
      editingRow.value = undefined;
      recordType.value = 'A';
      sourceOptions.value = [];
      modalApi
        .setData({
          values: {
            domain: '',
            enabled: true,
            name: '',
            portForwardId: undefined,
            recordType: 'A',
            remark: '',
            subDomain: '',
          },
        } satisfies NetworkDdnsRecordModalData)
        .open();
    }

    function openEdit(row: SystemNetworkApi.DdnsRecord) {
      editingRow.value = row;
      recordType.value = row.recordType;
      sourceOptions.value = [];
      modalApi
        .setData({
          values: {
            domain: row.domain,
            enabled: row.enabled,
            name: row.name,
            portForwardId:
              row.sourceType === 'port_forward_ipv4'
                ? row.portForwardId || undefined
                : undefined,
            recordType: row.recordType,
            remark: row.remark || '',
            subDomain: row.subDomain,
          },
        } satisfies NetworkDdnsRecordModalData)
        .open();
    }

    async function resetForm(values: Partial<NetworkDdnsRecordFormValues>) {
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

    async function loadSourceOptions(
      nextRecordType: SystemNetworkApi.DdnsRecordType,
    ) {
      const requestRevision = ++sourceLoadRevision;
      const result = await getNetworkDdnsSourceOptions(nextRecordType);
      if (
        requestRevision !== sourceLoadRevision ||
        recordType.value !== nextRecordType
      ) {
        return;
      }
      sourceOptions.value = result.items;
    }

    async function submit() {
      const { valid } = await formApi.validate();
      if (!valid) return;
      const values = await formApi.getValues<NetworkDdnsRecordFormValues>();
      const nextRecordType =
        values.recordType === 'AAAA' ? 'AAAA' : ('A' as const);
      const portForwardId =
        nextRecordType === 'A' ? values.portForwardId?.trim() : undefined;
      if (nextRecordType === 'A' && !portForwardId) {
        message.warning($t('system.network.ddnsSourceRequired'));
        return;
      }
      const payload: SystemNetworkApi.DdnsRecordInput = {
        domain: values.domain.trim().toLowerCase(),
        enabled: !!values.enabled,
        name: values.name.trim(),
        portForwardId,
        recordType: nextRecordType,
        remark: values.remark?.trim() || '',
        sourceType:
          nextRecordType === 'AAAA' ? 'agent_ipv6' : 'port_forward_ipv4',
        subDomain: values.subDomain.trim().toLowerCase(),
      };

      modalApi.lock();
      try {
        await (editingRow.value
          ? updateNetworkDdnsRecord(editingRow.value.id, payload)
          : createNetworkDdnsRecord(payload));
        message.success($t('system.network.ddnsSaved'));
        await modalApi.close();
        emit('saved');
      } finally {
        modalApi.unlock();
      }
    }

    expose({ openCreate, openEdit } satisfies NetworkDdnsRecordModalExposed);

    return () => (
      <Modal title={modalTitle.value}>
        {recordType.value === 'AAAA' ? (
          <Alert
            class="mb-4"
            message={`${$t('system.network.ddnsAgentIpv6Source')}: ${
              agentIpv6Summary.value
            }`}
            showIcon
            type={agentIpv6Source.value?.eligible ? 'info' : 'warning'}
          />
        ) : null}
        <DdnsForm class="mx-2" />
      </Modal>
    );
  },
});

function createFormSchema(
  sourceOptions: Readonly<{
    value: SystemNetworkApi.DdnsSourceOption[];
  }>,
): VbenFormSchema[] {
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
      componentProps: { options: recordTypeOptions },
      defaultValue: 'A',
      fieldName: 'recordType',
      label: $t('system.network.ddnsRecordType'),
      rules: z.enum(['A', 'AAAA']),
    },
    {
      component: 'Input',
      componentProps: { allowClear: true, maxlength: 253 },
      fieldName: 'domain',
      label: $t('system.network.ddnsDomain'),
      rules: z
        .string()
        .trim()
        .min(1)
        .max(253)
        .refine(isValidDdnsDomain, $t('system.network.ddnsDomainInvalid')),
    },
    {
      component: 'Input',
      componentProps: { allowClear: true, maxlength: 253 },
      fieldName: 'subDomain',
      label: $t('system.network.ddnsSubDomain'),
      rules: z
        .string()
        .trim()
        .min(1)
        .max(253)
        .refine(
          isValidDdnsSubDomain,
          $t('system.network.ddnsSubDomainInvalid'),
        ),
    },
    {
      component: 'Select',
      componentProps: () => ({
        allowClear: true,
        options: sourceOptions.value.map((source) =>
          formatSourceOption(source),
        ),
        placeholder: $t('system.network.ddnsSelectSource'),
      }),
      dependencies: {
        if(values) {
          return values.recordType !== 'AAAA';
        },
        triggerFields: ['recordType'],
      },
      fieldName: 'portForwardId',
      label: $t('system.network.ddnsSource'),
      rules: z.string().min(1),
    },
    {
      component: 'Switch',
      defaultValue: true,
      fieldName: 'enabled',
      label: $t('system.network.ddnsEnabled'),
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

function formatSourceOption(source: SystemNetworkApi.DdnsSourceOption) {
  const endpoint =
    source.protocol && source.externalPort
      ? `${source.protocol.toUpperCase()}:${source.externalPort}`
      : source.sourceType;
  const currentAddress =
    source.currentAddress || $t('system.network.ddnsWaitingSourceAddress');
  const reason = source.eligible
    ? ''
    : ` · ${formatSourceDisabledReason(source.disabledReasonCode)}`;
  return {
    disabled: !source.eligible,
    label: `${source.name} · ${endpoint} · ${currentAddress}${reason}`,
    value: String(source.id),
  };
}

function formatSourceDisabledReason(reasonCode?: null | string): string {
  return reasonCode
    ? `${$t('system.network.ddnsSourceUnavailable')}: ${reasonCode}`
    : $t('system.network.ddnsSourceUnavailable');
}

export function isValidDdnsDomain(value: string): boolean {
  const normalized = value.trim();
  if (
    normalized.length > 253 ||
    normalized.endsWith('.') ||
    !normalized.includes('.')
  ) {
    return false;
  }
  return normalized.split('.').every((label) => dnsLabelPattern.test(label));
}

export function isValidDdnsSubDomain(value: string): boolean {
  const normalized = value.trim();
  if (normalized === '@') return true;
  if (normalized.length > 253 || normalized.endsWith('.')) return false;
  return normalized.split('.').every((label) => dnsLabelPattern.test(label));
}
