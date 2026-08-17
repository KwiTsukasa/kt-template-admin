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
        labelClass: 'w-32 whitespace-nowrap',
      },
      /**
       * DNS 记录类型变化时归一为 A 或 AAAA、清空旧转发来源并加载匹配的新来源。
       *
       * @param values - DDNS 表单当前的记录类型；变化后清空旧来源并加载匹配候选。
       * @param fieldsChanged - 本次发生变化的表单字段名集合，用于只处理相关依赖字段。
       */
      async handleValuesChange(values, fieldsChanged) {
        if (!fieldsChanged.includes('recordType')) return;
        const nextRecordType = (() => {
          if (values.recordType === 'AAAA') {
            return 'AAAA';
          }
          return 'A' as const;
        })();
        recordType.value = nextRecordType;
        await formApi.setValues({ portForwardId: undefined });
        await loadSourceOptions(nextRecordType);
      },
      layout: 'horizontal',
      schema: createFormSchema(sourceOptions),
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const modalTitle = computed(() => {
      if (editingRow.value) {
        return $t('system.network.ddnsEditTitle');
      }
      return $t('system.network.ddnsCreateTitle');
    });
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
      /**
       * 确认 DDNS 弹窗时校验域名、记录类型和来源，并提交当前记录。
       */
      async onConfirm() {
        await submit();
      },
      /**
       * 打开 DDNS 弹窗时恢复记录类型与表单，并加载匹配的端口转发来源。
       *
       * @param isOpen - 弹窗或抽屉最新显隐状态；true 表示已打开。
       */
      async onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = modalApi.getData<NetworkDdnsRecordModalData>();
        const nextRecordType = (() => {
          if (values.recordType === 'AAAA') {
            return 'AAAA';
          }
          return 'A' as const;
        })();
        recordType.value = nextRecordType;
        await resetForm(values);
        if (recordType.value !== nextRecordType) return;
        await loadSourceOptions(nextRecordType);
      },
    });

    /**
     * 清除 DDNS 编辑记录和来源选项，并用 A 记录默认值打开新建弹窗。
     */
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

    /**
     * 把 DDNS 记录与匹配的端口转发来源写入表单，并打开编辑弹窗。
     *
     * @param row - 要加载到 DDNS 编辑弹窗的现有记录。
     */
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
            portForwardId: (() => {
              if (row.sourceType === 'port_forward_ipv4') {
                return row.portForwardId || undefined;
              }
              return undefined;
            })(),
            recordType: row.recordType,
            remark: row.remark || '',
            subDomain: row.subDomain,
          },
        } satisfies NetworkDdnsRecordModalData)
        .open();
    }

    /**
     * 清空 DDNS 记录表单后写入目标字段值，并移除上一轮校验错误。
     *
     * @param values - 重置后要写入 DDNS 记录表单的完整字段。
     */
    async function resetForm(values: Partial<NetworkDdnsRecordFormValues>) {
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

    /**
     * 按 DNS 记录类型加载可选转发来源，过期请求结果不会覆盖当前类型。
     *
     * @param nextRecordType - 用户新选择的 DNS 记录类型。
     */
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

    /**
     * 校验并规范化 `DDNS` 记录；`A` 记录要求端口转发来源，`AAAA` 记录自动使用 `Agent IPv6`，保存后派发 `saved` 事件。
     */
    async function submit() {
      const { valid } = await formApi.validate();
      if (!valid) return;
      const values = await formApi.getValues<NetworkDdnsRecordFormValues>();
      const nextRecordType = (() => {
        if (values.recordType === 'AAAA') {
          return 'AAAA';
        }
        return 'A' as const;
      })();
      const portForwardId = (() => {
        if (nextRecordType === 'A') {
          return values.portForwardId?.trim();
        }
        return undefined;
      })();
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
        sourceType: (() => {
          if (nextRecordType === 'AAAA') {
            return 'agent_ipv6';
          }
          return 'port_forward_ipv4';
        })(),
        subDomain: values.subDomain.trim().toLowerCase(),
      };

      modalApi.lock();
      try {
        await (() => {
          if (editingRow.value) {
            return updateNetworkDdnsRecord(editingRow.value.id, payload);
          }
          return createNetworkDdnsRecord(payload);
        })();
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
        {(() => {
          if (recordType.value === 'AAAA') {
            return (
              <Alert
                class="mb-4"
                showIcon
                title={`${$t('system.network.ddnsAgentIpv6Source')}: ${
                  agentIpv6Summary.value
                }`}
                type={(() => {
                  if (agentIpv6Source.value?.eligible) {
                    return 'info';
                  }
                  return 'warning';
                })()}
              />
            );
          }
          return null;
        })()}
        <DdnsForm class="mx-2" />
      </Modal>
    );
  },
});

/**
 * 生成 DDNS 名称、记录类型、域名、来源和启用状态字段，并配置 DNS 与长度约束。
 *
 * @param sourceOptions - 可供 DDNS A 记录选择的端口转发来源选项。
 * @returns 包含 DDNS 名称、记录类型、域名、来源和启用约束的表单 Schema。
 */
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
      rules: z
        .string({
          invalid_type_error: $t('system.network.ddnsNameRequired'),
          required_error: $t('system.network.ddnsNameRequired'),
        })
        .trim()
        .min(1, $t('system.network.ddnsNameRequired'))
        .max(100, $t('system.network.nameTooLong')),
    },
    {
      component: 'Select',
      componentProps: { options: recordTypeOptions },
      defaultValue: 'A',
      fieldName: 'recordType',
      label: $t('system.network.ddnsRecordType'),
      rules: z
        .string({
          invalid_type_error: $t('system.network.ddnsRecordTypeRequired'),
          required_error: $t('system.network.ddnsRecordTypeRequired'),
        })
        .refine(
          (value) => ['A', 'AAAA'].includes(value),
          $t('system.network.ddnsRecordTypeRequired'),
        ),
    },
    {
      component: 'Input',
      componentProps: { allowClear: true, maxlength: 253 },
      fieldName: 'domain',
      label: $t('system.network.ddnsDomain'),
      rules: z
        .string({
          invalid_type_error: $t('system.network.ddnsDomainRequired'),
          required_error: $t('system.network.ddnsDomainRequired'),
        })
        .trim()
        .min(1, $t('system.network.ddnsDomainRequired'))
        .max(253, $t('system.network.ddnsDomainTooLong'))
        .refine(isValidDdnsDomain, $t('system.network.ddnsDomainInvalid')),
    },
    {
      component: 'Input',
      componentProps: { allowClear: true, maxlength: 253 },
      fieldName: 'subDomain',
      label: $t('system.network.ddnsSubDomain'),
      rules: z
        .string({
          invalid_type_error: $t('system.network.ddnsSubDomainRequired'),
          required_error: $t('system.network.ddnsSubDomainRequired'),
        })
        .trim()
        .min(1, $t('system.network.ddnsSubDomainRequired'))
        .max(253, $t('system.network.ddnsSubDomainTooLong'))
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
        /**
         * 仅在记录类型不是 AAAA 时显示端口转发来源字段。
         *
         * @param values - 包含 recordType 的 DDNS 表单字段，用于隐藏 AAAA 记录的端口转发来源。
         * @returns 记录类型不是 AAAA 时返回 true，否则返回 false。
         */
        if(values) {
          return values.recordType !== 'AAAA';
        },
        triggerFields: ['recordType'],
      },
      fieldName: 'portForwardId',
      label: $t('system.network.ddnsSource'),
      rules: z
        .string({
          invalid_type_error: $t('system.network.ddnsSourceRequired'),
          required_error: $t('system.network.ddnsSourceRequired'),
        })
        .min(1, $t('system.network.ddnsSourceRequired')),
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
      rules: z
        .string({ invalid_type_error: $t('system.network.remarkInvalid') })
        .max(500, $t('system.network.remarkTooLong'))
        .optional()
        .or(z.literal('')),
    },
  ];
}

/**
 * 把 DDNS 来源状态转换为下拉选项，并对不可用来源附加原因与禁用标记。
 *
 * @param source - 包含来源类型、转发名称、当前地址、端口及可用性原因的 DDNS 来源选项。
 * @returns 包含标签、值、禁用状态及可选禁用原因的 DDNS 来源选项。
 */
function formatSourceOption(source: SystemNetworkApi.DdnsSourceOption) {
  const currentEndpoint = (() => {
    if (source.currentAddress && source.currentPort) {
      return `${source.currentAddress}:${source.currentPort}`;
    }
    return (
      source.currentAddress || $t('system.network.ddnsWaitingSourceAddress')
    );
  })();
  const reason = (() => {
    if (source.eligible) {
      return '';
    }
    return ` · ${formatSourceDisabledReason(source.disabledReasonCode)}`;
  })();
  return {
    disabled: !source.eligible,
    label: `${source.name} · ${currentEndpoint}${reason}`,
    value: String(source.id),
  };
}

/**
 * 根据 DDNS 来源不可用代码生成提示，缺少代码时只返回通用说明。
 *
 * @param reasonCode - 用于选择禁用提示或失败说明的原因代码。
 * @returns DDNS 来源不可选时的原因文本；来源可用时返回 undefined。
 */
function formatSourceDisabledReason(reasonCode?: null | string): string {
  if (reasonCode) {
    return `${$t('system.network.ddnsSourceUnavailable')}: ${reasonCode}`;
  }
  return $t('system.network.ddnsSourceUnavailable');
}

/**
 * 根据 DNS 标签、总长度与字符规则校验 DDNS 主域名。
 *
 * @param value - 待校验的主域名；必须符合 DNS 标签字符与总长度限制。
 * @returns 主域名满足总长度、标签长度和字符规则时返回 true，否则返回 false。
 */
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

/**
 * 根据 DNS 标签规则校验 DDNS 子域，允许根记录使用约定空值。
 *
 * @param value - 待校验的子域文本；约定空值和 `@` 表示根记录。
 * @returns 子域满足 DNS 标签规则或表示根记录时返回 true，否则返回 false。
 */
export function isValidDdnsSubDomain(value: string): boolean {
  const normalized = value.trim();
  if (normalized === '@') return true;
  if (normalized.length > 253 || normalized.endsWith('.')) return false;
  return normalized.split('.').every((label) => dnsLabelPattern.test(label));
}
