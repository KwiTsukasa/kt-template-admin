import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type { KtTableApi, KtTableButton } from '#/components/ktTable';

import { computed, defineComponent, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';

import { message, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  getQqbotSendLogList,
  sendQqbotGroup,
  sendQqbotPrivate,
} from '#/api/qqbot';
import { KtTable, useKtTable } from '#/components/ktTable';

import {
  getOptionLabel,
  getSendStatusOption,
  qqbotMessageTypeOptions,
  qqbotSendStatusOptions,
} from '../modules/options';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'QqBotSendLogList',
  setup() {
    const sendTargetType = ref<'group' | 'private'>('private');
    const [SendForm, sendFormApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      handleValuesChange(values, fieldsChanged) {
        if (fieldsChanged.includes('targetType')) {
          sendTargetType.value =
            values.targetType === 'group' ? 'group' : 'private';
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
            options: qqbotMessageTypeOptions,
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
    const columns: Array<TableColumnType<QqbotApi.SendLog>> = [
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
    const api: KtTableApi<QqbotApi.SendLog> = {
      list: async (params) => await getQqbotSendLogList(params),
    };
    const buttons: Array<KtTableButton<QqbotApi.SendLog>> = [
      {
        key: 'send',
        label: '手动发送',
        onClick: openSend,
        permissionCodes: ['QqBot:Send:Private', 'QqBot:Send:Group'],
        type: 'primary',
      },
    ];
    const [registerTable, tableApi] = useKtTable<QqbotApi.SendLog>({
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
              options: qqbotMessageTypeOptions,
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
              options: qqbotSendStatusOptions,
            },
            fieldName: 'status',
            label: '状态',
          },
        ],
      },
      rowActions: [],
      tableTitle: '发送日志',
    });
    const targetLabel = computed(() =>
      sendTargetType.value === 'group' ? '群号' : 'QQ 号',
    );

    const [SendModal, sendModalApi] = useVbenModal({
      class: 'w-[620px]',
      fullscreenButton: false,
      async onConfirm() {
        await submitSend();
      },
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        void resetSendForm();
      },
    });

    async function resetSendForm() {
      const values = {
        message: '',
        selfId: '',
        targetId: '',
        targetType: 'private',
      };
      sendTargetType.value = values.targetType as 'private';
      await sendFormApi.resetForm();
      await sendFormApi.setValues(values);
      await sendFormApi.resetValidate();
    }

    function openSend() {
      sendModalApi.open();
    }

    async function submitSend() {
      const { valid } = await sendFormApi.validate();
      if (!valid) return;

      const values = await sendFormApi.getValues<{
        message: string;
        selfId: string;
        targetId: string;
        targetType: 'group' | 'private';
      }>();
      const targetId = values.targetId?.trim();
      const messageText = values.message?.trim();
      if (!targetId || !messageText) {
        message.warning('请填写目标和消息内容');
        return;
      }

      sendModalApi.lock();
      try {
        await (values.targetType === 'group'
          ? sendQqbotGroup({
              groupId: targetId,
              message: messageText,
              selfId: values.selfId || undefined,
            })
          : sendQqbotPrivate({
              message: messageText,
              selfId: values.selfId || undefined,
              userId: targetId,
            }));
        message.success('消息已发送');
        await sendModalApi.close();
        await tableApi.reload();
      } finally {
        sendModalApi.unlock();
      }
    }

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as QqbotApi.SendLog;
              if (column.key === 'targetType') {
                return getOptionLabel(qqbotMessageTypeOptions, row.targetType);
              }
              if (column.key === 'status') {
                const status = getSendStatusOption(row.status);
                return <Tag color={status.color}>{status.label}</Tag>;
              }
              return undefined;
            },
          }}
        />
        <SendModal title="手动发送">
          <SendForm class="mx-2" />
        </SendModal>
      </Page>
    );
  },
});
