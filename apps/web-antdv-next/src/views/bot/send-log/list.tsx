import type { TableColumnType } from 'antdv-next';

import type { BotApi } from '#/api/bot';
import type { KtTableApi, KtTableButton } from '#/components/kt-table';

import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onDeactivated,
  ref,
} from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';

import { message, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { getBotSendLogList, sendBotGroup, sendBotPrivate } from '#/api/bot';
import { KtTable, useKtTable } from '#/components/kt-table';
import { useModalSessionIntent } from '#/hooks/useModalSessionIntent';

import {
  botMessageTypeOptions,
  botSendStatusOptions,
  getOptionLabel,
  getSendStatusOption,
} from '../modules/options';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'BotSendLogList',
  setup() {
    const sendTargetType = ref<'group' | 'private'>('private');
    const session = useModalSessionIntent();
    let lockedRevision: number | undefined;
    let initializationStartedRevision: number | undefined;
    const [SendForm, sendFormApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      /**
       * 发送目标类型字段变化时，把表单值归一为群聊或私聊状态。
       *
       * @param values - 发送表单当前的目标类型字段；非 group 值会归一为 private。
       * @param fieldsChanged - 本次发生变化的表单字段名集合，用于只处理相关依赖字段。
       */
      handleValuesChange(values, fieldsChanged) {
        if (fieldsChanged.includes('targetType')) {
          if (values.targetType === 'group') {
            sendTargetType.value = 'group';
          } else {
            sendTargetType.value = 'private';
          }
        }
      },
      layout: 'horizontal',
      schema: [
        {
          component: 'Input',
          componentProps: {
            placeholder: '留空使用默认启用账号',
          },
          fieldName: 'selfId',
          label: 'Self ID',
        },
        {
          component: 'Select',
          componentProps: {
            options: botMessageTypeOptions,
          },
          fieldName: 'targetType',
          label: '目标类型',
        },
        {
          component: 'Input',
          fieldName: 'targetId',
          label: () => targetLabel.value,
          rules: 'required',
        },
        {
          component: 'Textarea',
          componentProps: {
            autoSize: { maxRows: 6, minRows: 3 },
          },
          fieldName: 'message',
          label: '消息内容',
          rules: 'required',
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const columns: Array<TableColumnType<BotApi.SendLog>> = [
      { dataIndex: 'selfId', key: 'selfId', title: 'Self ID', width: 150 },
      {
        dataIndex: 'targetType',
        key: 'targetType',
        title: '目标类型',
        width: 110,
      },
      { dataIndex: 'targetId', key: 'targetId', title: '目标 ID', width: 160 },
      { dataIndex: 'status', key: 'status', title: '状态', width: 100 },
      {
        dataIndex: 'messageText',
        key: 'messageText',
        title: '消息内容',
        width: 420,
      },
      {
        dataIndex: 'errorMessage',
        key: 'errorMessage',
        title: '错误信息',
        width: 260,
      },
      {
        dataIndex: 'createTime',
        key: 'createTime',
        title: '发送时间',
        width: 190,
      },
    ];
    const api: KtTableApi<BotApi.SendLog> = {
      list: async (params) => await getBotSendLogList(params),
    };
    const buttons: Array<KtTableButton<BotApi.SendLog>> = [
      {
        key: 'send',
        label: '手动发送',
        onClick: openSend,
        permissionCodes: ['Bot:Send:Private', 'Bot:Send:Group'],
        type: 'primary',
      },
    ];
    const [registerTable, tableApi] = useKtTable<BotApi.SendLog>({
      api,
      buttons,
      columns,
      formOptions: {
        schema: [
          {
            component: 'Input',
            componentProps: { allowClear: true, placeholder: 'Self ID' },
            fieldName: 'selfId',
            label: 'Self ID',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: botMessageTypeOptions,
            },
            fieldName: 'targetType',
            label: '目标类型',
          },
          {
            component: 'Input',
            componentProps: { allowClear: true, placeholder: '目标 ID' },
            fieldName: 'targetId',
            label: '目标 ID',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: botSendStatusOptions,
            },
            fieldName: 'status',
            label: '状态',
          },
        ],
      },
      rowActions: [],
      tableTitle: '发送日志',
    });
    const targetLabel = computed(() => {
      if (sendTargetType.value === 'group') {
        return '群号';
      }
      return 'QQ 号';
    });

    const [SendModal, sendModalApi] = useVbenModal({
      class: 'w-[620px]',
      fullscreenButton: false,
      /**
       * 当用户确认消息发送弹窗时，提交目标、账号和消息内容。
       */
      async onConfirm() {
        try {
          await submitSend();
        } catch {
          // 表单和请求层负责各自错误；已发消息的不确定结果由提交阶段提示。
        }
      },
      /**
       * 仅在消息发送弹窗打开时把表单重置为默认目标类型与空内容。
       *
       * @param isOpen - 弹窗或抽屉最新显隐状态；true 表示已打开。
       */
      async onOpenChange(isOpen: boolean) {
        if (!isOpen) {
          session.invalidate();
          return;
        }
        const revision = session.current();
        if (!session.isCurrent(revision)) return;
        await initializeOpenSession(revision);
      },
    });

    onDeactivated(() => {
      session.invalidate();
    });
    onBeforeUnmount(() => {
      session.dispose();
    });

    /**
     * 串行恢复本会话的空账号、私聊目标和空内容，旧重置不能覆盖新输入。
     * @param revision - 发起初始化时的发送弹窗会话身份。
     */
    async function resetSendForm(revision: number) {
      const values = {
        message: '',
        selfId: '',
        targetId: '',
        targetType: 'private',
      };
      await session.initialize(revision, async (stillCurrent) => {
        await sendFormApi.resetForm();
        if (!stillCurrent()) return;
        sendTargetType.value = 'private';
        await sendFormApi.setValues(values);
        if (!stillCurrent()) return;
        await sendFormApi.resetValidate();
      });
    }

    /**
     * 首次打开和已打开弹窗再次选择发送入口共用同轮初始化，防重复重置。
     * @param revision - 本次显式打开动作固定的会话身份。
     */
    async function initializeOpenSession(revision: number) {
      if (
        !session.isCurrent(revision) ||
        initializationStartedRevision === revision
      )
        return;
      initializationStartedRevision = revision;
      await resetSendForm(revision);
    }

    /**
     * 显式开启新的手动发送会话，清除旧锁后由弹窗打开回调初始化表单。
     */
    function openSend() {
      const revision = session.begin();
      if (lockedRevision !== undefined) {
        sendModalApi.unlock();
        lockedRevision = undefined;
      }
      sendModalApi.open();
      void nextTick(() => {
        if (session.isCurrent(revision)) void initializeOpenSession(revision);
      });
    }

    /**
     * 从点击时固定会话意图；只向原目标发送一次，旧完成不能关闭新弹窗。
     */
    async function submitSend() {
      const revision = session.current();
      if (!session.claimConfirm(revision)) return;
      try {
        const { valid } = await sendFormApi.validate();
        if (!session.isCurrent(revision) || !valid) return;
        const values = await sendFormApi.getValues<{
          message: string;
          selfId: string;
          targetId: string;
          targetType: 'group' | 'private';
        }>();
        if (!session.isCurrent(revision)) return;
        const targetId = values.targetId?.trim();
        const messageText = values.message?.trim();
        if (!targetId || !messageText) {
          message.warning('请填写目标和消息内容');
          return;
        }
        sendModalApi.lock();
        lockedRevision = revision;
        try {
          await (() => {
            if (values.targetType === 'group') {
              return sendBotGroup({
                groupId: targetId,
                message: messageText,
                selfId: values.selfId || undefined,
              });
            }
            return sendBotPrivate({
              message: messageText,
              selfId: values.selfId || undefined,
              userId: targetId,
            });
          })();
        } catch {
          if (session.isCurrent(revision))
            message.warning('发送结果未确认，请先查看发送记录再决定是否重试');
          return;
        }
        if (!session.isCurrent(revision)) return;
        message.success('消息已发送');
        await sendModalApi.close();
        await tableApi.reload();
      } finally {
        if (lockedRevision === revision) {
          sendModalApi.unlock();
          lockedRevision = undefined;
        }
        session.releaseConfirm(revision);
      }
    }

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as BotApi.SendLog;
              if (column.key === 'targetType') {
                return getOptionLabel(botMessageTypeOptions, row.targetType);
              }
              if (column.key === 'status') {
                const status = getSendStatusOption(row.status);
                return <Tag color={status.color}>{status.label}</Tag>;
              }
              return undefined;
            },
          }}
        />
        <SendModal confirmDisabled={!session.ready.value} title="手动发送">
          <SendForm class="mx-2" />
        </SendModal>
      </Page>
    );
  },
});
