import type { PropType } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { MessageManagementApi } from '#/api/message-management';
import type { BotMessageSubscriberApi } from '#/api/message-management/subscribers/bot';

import { computed, defineComponent, markRaw, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm, z } from '#/adapter/form';
import {
  createBotMessageBinding,
  updateBotMessageBinding,
} from '#/api/message-management/subscribers/bot';

import MessagePushTargetPicker, {
  isValidMessagePushTargetId,
} from './MessagePushTargetPicker';

export interface AccountMessagePushModalExposed {
  openCreate: () => void;
  openEdit: (row: BotMessageSubscriberApi.PublishBindingView) => void;
}

interface AccountMessagePushFormValues {
  enabled: boolean;
  subscriptionId: string;
  targets: BotMessageSubscriberApi.PublishTargetInput[];
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
      type: Array as PropType<MessageManagementApi.MessageSubscriptionView[]>,
    },
    targetOptions: {
      default: undefined,
      type: Object as PropType<
        BotMessageSubscriberApi.TargetOptionsResponse | undefined
      >,
    },
    targetOptionsLoading: {
      default: false,
      type: Boolean,
    },
  },
  emits: ['saved'],
  setup(props, { emit, expose }) {
    const editingId = ref<string>();
    const modalOpen = ref(false);
    let sessionRevision = 0;
    let sessionSelfId = '';
    const [BindingForm, formApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-32 whitespace-nowrap',
      },
      layout: 'horizontal',
      schema: createFormSchema(props),
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const modalTitle = computed(() => {
      if (editingId.value) return '编辑 Bot 投递';
      return '新增 Bot 投递';
    });
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[760px]',
      fullscreenButton: false,
      /**
       * 校验 Bot 私有目标表单并提交统一订阅绑定。
       */
      async onConfirm() {
        try {
          await submit();
        } catch {
          // The request/form layer already presents the persistence error.
        }
      },
      /**
       * 打开弹窗时校验账号与会话代次，并恢复通用订阅和 QQ 目标字段。
       *
       * @param isOpen - 弹窗最新显隐状态。
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
        await resetForm(data.values);
      },
    });

    /**
     * 新建会话故意不预选订阅或目标，避免把上一账号和模板选择泄漏到当前账号。
     */
    function openCreate() {
      editingId.value = undefined;
      beginSession({ enabled: true, subscriptionId: '', targets: [] });
    }

    /**
     * 把现有 Bot 私有配置转换为通用订阅和 QQ 目标表单值。
     *
     * @param row - 待编辑的 Bot 订阅者配置。
     */
    function openEdit(row: BotMessageSubscriberApi.PublishBindingView) {
      editingId.value = row.id;
      beginSession({
        enabled: row.enabled,
        subscriptionId: row.subscriptionId,
        targets: row.targets.map((target) => {
          const value: BotMessageSubscriberApi.PublishTargetInput = {
            targetId: target.targetId,
            targetType: target.targetType,
          };
          if (target.targetName) value.targetName = target.targetName;
          return value;
        }),
      });
    }

    /**
     * 初始化本次账号弹窗会话并写入表单值。
     *
     * @param values - 新会话的通用订阅、QQ 目标和启用状态。
     */
    function beginSession(values: AccountMessagePushFormValues) {
      sessionRevision += 1;
      sessionSelfId = props.selfId;
      modalApi
        .setData({
          selfId: sessionSelfId,
          sessionRevision,
          values,
        } satisfies AccountMessagePushModalData)
        .open();
    }

    /**
     * 清空 Bot 订阅者表单后写入当前会话值。
     *
     * @param values - 当前通用订阅、QQ 目标和启用状态。
     */
    async function resetForm(values: AccountMessagePushFormValues) {
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

    /**
     * 校验 Bot 订阅归属和目标后保存私有配置，不提交任何模板标识。
     */
    async function submit() {
      const revision = sessionRevision;
      const selfId = sessionSelfId;
      const currentEditingId = editingId.value;
      if (!selfId || selfId !== props.selfId) return;
      const { valid } = await formApi.validate();
      if (!valid || revision !== sessionRevision || selfId !== props.selfId) {
        return;
      }
      const values = await formApi.getValues<AccountMessagePushFormValues>();
      if (revision !== sessionRevision || selfId !== props.selfId) return;
      const payload = normalizeBindingPayload(
        props.subscriptions,
        values,
        props.targetOptions?.connectionMode || null,
      );
      if (!payload) return;

      modalApi.lock();
      try {
        if (currentEditingId) {
          await updateBotMessageBinding(selfId, currentEditingId, payload);
        } else {
          await createBotMessageBinding(selfId, payload);
        }
        if (revision !== sessionRevision || selfId !== props.selfId) return;
        await modalApi.close();
        emit('saved');
      } finally {
        modalApi.unlock();
      }
    }

    /**
     * 账号切换时使旧会话失效并关闭仍打开的弹窗。
     */
    async function invalidateForSelfIdChange() {
      sessionRevision += 1;
      sessionSelfId = '';
      editingId.value = undefined;
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
 * Bot 渠道配置仅允许选择 `subscriberKey=bot` 的订阅和账号目标，模板集合保持只读。
 *
 * @param props - Bot 订阅目录与目标候选状态。
 * @returns 不包含消息模板选择的 Bot 私有配置表单 Schema。
 */
function createFormSchema(
  props: Readonly<{
    subscriptions: MessageManagementApi.MessageSubscriptionView[];
    targetOptions: BotMessageSubscriberApi.TargetOptionsResponse | undefined;
    targetOptionsLoading: boolean;
  }>,
): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: () => ({
        options: props.subscriptions
          .filter((subscription) => subscription.subscriberKey === 'bot')
          .map((subscription) => ({
            disabled: !subscription.enabled || !subscription.valid,
            label: formatSubscriptionLabel(subscription),
            value: subscription.id,
          })),
      }),
      fieldName: 'subscriptionId',
      label: '消息订阅',
      rules: z.string().regex(DECIMAL_ID_PATTERN, '请选择消息订阅'),
    },
    {
      component: markRaw(MessagePushTargetPicker),
      componentProps: () => ({
        available: props.targetOptions?.available ?? true,
        connectionMode: props.targetOptions?.connectionMode ?? null,
        loading: props.targetOptionsLoading,
        manualEntry: props.targetOptions?.manualEntry ?? false,
        options: props.targetOptions?.options || [],
        reasonCode: props.targetOptions?.reasonCode ?? null,
      }),
      fieldName: 'targets',
      label: 'QQ 投递目标',
      modelPropName: 'value',
      rules: z
        .array(
          z.object({
            targetId: z
              .string()
              .regex(
                /^[\w-]{1,64}$/u,
                '目标必须符合当前账号的 QQ 号、群号或 OpenID 格式',
              ),
            targetName: z.string().max(120).optional(),
            targetType: z.enum(['group', 'private']),
          }),
        )
        .min(1, '请至少选择一个 QQ 投递目标')
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
 * 将订阅名称、来源、多模板摘要和失效原因组合为下拉展示文本。
 *
 * @param subscription - 归属 Bot 的统一消息订阅。
 * @returns 包含来源和全部模板数量的订阅选项文本。
 */
function formatSubscriptionLabel(
  subscription: MessageManagementApi.MessageSubscriptionView,
): string {
  let reason = '';
  if (!subscription.valid || !subscription.enabled) {
    reason = ` · ${subscription.invalidReasonCode || 'disabled'}`;
  }
  return `${subscription.name} · ${subscription.sourceName} · ${subscription.templates.length} 个模板${reason}`;
}

/**
 * 校验订阅归属 Bot 及全部目标，并生成不含模板标识的私有配置载荷。
 *
 * @param subscriptions - 当前可见的统一消息订阅目录。
 * @param values - 待校验的通用订阅、启用状态和 QQ 目标。
 * @param connectionMode - 当前 Bot 账号接入方式，决定目标 ID 合同。
 * @returns 校验通过的 Bot 私有配置；非法时返回 undefined。
 */
function normalizeBindingPayload(
  subscriptions: MessageManagementApi.MessageSubscriptionView[],
  values: AccountMessagePushFormValues,
  connectionMode: BotMessageSubscriberApi.TargetOptionsResponse['connectionMode'],
): BotMessageSubscriberApi.PublishBindingInput | undefined {
  if (!DECIMAL_ID_PATTERN.test(values.subscriptionId)) return undefined;
  const subscription = subscriptions.find(
    (item) => item.id === values.subscriptionId,
  );
  if (!subscription || subscription.subscriberKey !== 'bot') {
    return undefined;
  }
  if (!Array.isArray(values.targets)) return undefined;
  if (values.targets.length === 0 || values.targets.length > 100) {
    return undefined;
  }
  const targets: BotMessageSubscriberApi.PublishTargetInput[] = [];
  for (const target of values.targets) {
    if (
      !target ||
      typeof target.targetId !== 'string' ||
      !isValidMessagePushTargetId(target.targetId, connectionMode) ||
      (target.targetType !== 'group' && target.targetType !== 'private')
    ) {
      return undefined;
    }
    const normalized: BotMessageSubscriberApi.PublishTargetInput = {
      targetId: target.targetId,
      targetType: target.targetType,
    };
    if (target.targetName?.trim()) {
      normalized.targetName = target.targetName.trim();
    }
    targets.push(normalized);
  }
  return {
    enabled: !!values.enabled,
    subscriptionId: values.subscriptionId,
    targets,
  };
}
