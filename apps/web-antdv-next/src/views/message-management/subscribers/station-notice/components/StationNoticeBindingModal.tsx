import type { PropType } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { MessageManagementApi } from '#/api/message-management';
import type { StationNoticeMessageSubscriberApi } from '#/api/message-management/subscribers/station-notice';

import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onDeactivated,
  ref,
} from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm, z } from '#/adapter/form';
import {
  createStationNoticeMessageBinding,
  updateStationNoticeMessageBinding,
} from '#/api/message-management/subscribers/station-notice';
import { useModalSessionIntent } from '#/hooks/useModalSessionIntent';

export interface StationNoticeBindingModalExposed {
  openCreate: () => void;
  openEdit: (row: StationNoticeMessageSubscriberApi.BindingView) => void;
}

interface StationNoticeBindingFormValues {
  enabled: boolean;
  notifyRoleCode: string;
  subscriptionId: string;
  title: string;
}

const DECIMAL_ID_PATTERN = /^[1-9]\d*$/;

export default defineComponent({
  name: 'StationNoticeBindingModal',
  props: {
    subscriptions: {
      required: true,
      type: Array as PropType<MessageManagementApi.MessageSubscriptionView[]>,
    },
  },
  emits: ['saved'],
  setup(props, { emit, expose }) {
    const editingId = ref<string>();
    const session = useModalSessionIntent();
    let lockedRevision: number | undefined;
    let initializationStartedRevision: number | undefined;
    const [BindingForm, formApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-28 whitespace-nowrap',
      },
      layout: 'horizontal',
      schema: createFormSchema(props),
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const modalTitle = computed(() => {
      if (editingId.value) return '编辑站内信投递';
      return '新增站内信投递';
    });
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[680px]',
      fullscreenButton: false,
      /**
       * 校验站内信订阅者表单并保存当前私有投递配置。
       */
      async onConfirm() {
        try {
          await submit();
        } catch {
          // 请求层负责展示持久化错误，弹窗保持打开供用户修正。
        }
      },
      /**
       * 仅在进入可见态时恢复会话快照，关闭事件不覆盖用户下一次显式初始化的数据。
       *
       * @param isOpen - 弹窗最新显隐状态。
       */
      async onOpenChange(isOpen: boolean) {
        if (!isOpen) {
          session.invalidate();
          return;
        }
        const revision = session.current();
        if (!session.isCurrent(revision)) return;
        const values = modalApi.getData<StationNoticeBindingFormValues>();
        await initializeOpenSession(values, revision);
      },
    });

    onDeactivated(() => {
      session.invalidate();
    });
    onBeforeUnmount(() => {
      session.dispose();
    });

    /**
     * 新建会话默认面向超级管理员角色但不预选订阅，避免隐式接收任意来源消息。
     */
    function openCreate() {
      const revision = session.begin();
      editingId.value = undefined;
      if (lockedRevision !== undefined) {
        modalApi.unlock();
        lockedRevision = undefined;
      }
      const values: StationNoticeBindingFormValues = {
        enabled: true,
        notifyRoleCode: 'super',
        subscriptionId: '',
        title: '',
      };
      modalApi.setData(values).open();
      void nextTick(() => {
        if (session.isCurrent(revision))
          void initializeOpenSession(values, revision);
      });
    }

    /**
     * 将已有站内信订阅者配置写入表单并进入编辑会话。
     *
     * @param row - 待编辑的站内信订阅者私有配置。
     */
    function openEdit(row: StationNoticeMessageSubscriberApi.BindingView) {
      const revision = session.begin();
      editingId.value = row.id;
      if (lockedRevision !== undefined) {
        modalApi.unlock();
        lockedRevision = undefined;
      }
      const values: StationNoticeBindingFormValues = {
        enabled: row.enabled,
        notifyRoleCode: row.notifyRoleCode,
        subscriptionId: row.subscriptionId,
        title: row.title,
      };
      modalApi.setData(values).open();
      void nextTick(() => {
        if (session.isCurrent(revision))
          void initializeOpenSession(values, revision);
      });
    }

    /**
     * 打开回调与已打开弹窗再次选择记录共用同轮初始化，避免重复重置。
     * @param values - 当前新建或编辑意图的完整表单值。
     * @param revision - 打开时固定的会话身份。
     */
    async function initializeOpenSession(
      values: StationNoticeBindingFormValues,
      revision: number,
    ) {
      if (
        !session.isCurrent(revision) ||
        initializationStartedRevision === revision
      )
        return;
      initializationStartedRevision = revision;
      await resetForm(values, revision);
    }

    /**
     * 清空表单状态后写入当前新建或编辑会话的稳定值。
     *
     * @param values - 需要恢复的站内信订阅者配置字段。
     * @param revision - 发起本次表单初始化的弹窗会话身份。
     */
    async function resetForm(
      values: StationNoticeBindingFormValues,
      revision: number,
    ) {
      await session.initialize(revision, async (stillCurrent) => {
        await formApi.resetForm();
        if (!stillCurrent()) return;
        await formApi.setValues(values);
        if (!stillCurrent()) return;
        await formApi.resetValidate();
      });
    }

    /**
     * 从点击起固定编辑 id 并互斥确认；仅原会话可持久化与关闭弹窗。
     */
    async function submit() {
      const revision = session.current();
      if (!session.claimConfirm(revision)) return;
      const targetId = editingId.value;
      try {
        const { valid } = await formApi.validate();
        if (!session.isCurrent(revision) || !valid) return;
        const values =
          await formApi.getValues<StationNoticeBindingFormValues>();
        if (!session.isCurrent(revision)) return;
        const payload = normalizeBindingPayload(props.subscriptions, values);
        if (!payload) return;
        modalApi.lock();
        lockedRevision = revision;
        if (targetId) {
          await updateStationNoticeMessageBinding(targetId, payload);
        } else {
          await createStationNoticeMessageBinding(payload);
        }
        if (!session.isCurrent(revision)) return;
        await modalApi.close();
        emit('saved');
      } finally {
        if (lockedRevision === revision) {
          modalApi.unlock();
          lockedRevision = undefined;
        }
        session.releaseConfirm(revision);
      }
    }

    expose({ openCreate, openEdit } satisfies StationNoticeBindingModalExposed);

    return () => (
      <Modal confirmDisabled={!session.ready.value} title={modalTitle.value}>
        <BindingForm class="mx-2" />
      </Modal>
    );
  },
});

/**
 * 把站内信订阅目录投影为选择项，禁用不可用订阅，并为标题、角色和启用状态附加领域校验。
 *
 * @param props - 归属站内信订阅者的统一订阅目录。
 * @returns 站内信订阅者私有配置表单 Schema。
 */
function createFormSchema(
  props: Readonly<{
    subscriptions: MessageManagementApi.MessageSubscriptionView[];
  }>,
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
        showSearch: true,
      }),
      fieldName: 'subscriptionId',
      label: '消息订阅',
      rules: z.string().regex(DECIMAL_ID_PATTERN, '请选择消息订阅'),
    },
    {
      component: 'Input',
      componentProps: {
        maxlength: 255,
        placeholder: '例如：网络连接状态变化',
      },
      fieldName: 'title',
      label: '站内信标题',
      rules: z.string().trim().min(1, '请输入站内信标题').max(255),
    },
    {
      component: 'Input',
      componentProps: {
        maxlength: 64,
        placeholder: '默认 super，可填写实际角色编码',
      },
      defaultValue: 'super',
      fieldName: 'notifyRoleCode',
      label: '接收角色编码',
      rules: z.string().trim().min(1, '请输入接收角色编码').max(64),
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
 * 将订阅名称、来源和全部模板数量组合为站内信订阅选项文本。
 *
 * @param subscription - 归属站内信订阅者的统一消息订阅。
 * @returns 包含来源与模板数量的订阅展示文本。
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
 * 校验订阅归属并规范化站内信订阅者私有配置载荷。
 *
 * @param subscriptions - 当前可见的站内信统一订阅目录。
 * @param values - 表单回传的订阅、标题、角色和启用状态。
 * @returns 合法的站内信私有配置；订阅不存在或归属错误时返回 undefined。
 */
function normalizeBindingPayload(
  subscriptions: MessageManagementApi.MessageSubscriptionView[],
  values: StationNoticeBindingFormValues,
): StationNoticeMessageSubscriberApi.BindingInput | undefined {
  if (!DECIMAL_ID_PATTERN.test(values.subscriptionId)) return undefined;
  const subscription = subscriptions.find(
    (item) => item.id === values.subscriptionId,
  );
  if (!subscription || subscription.subscriberKey !== 'station-notice') {
    return undefined;
  }
  const title = values.title.trim();
  const notifyRoleCode = values.notifyRoleCode.trim();
  if (!title || !notifyRoleCode) return undefined;
  return {
    enabled: Boolean(values.enabled),
    notifyRoleCode,
    subscriptionId: values.subscriptionId,
    title,
  };
}
