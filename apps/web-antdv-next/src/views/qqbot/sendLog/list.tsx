import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type { KtTableApi, KtTableButton } from '#/components/ktTable';

import { computed, defineComponent, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Form, FormItem, Input, message, Modal, Select, Tag } from 'antdv-next';

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
const AInput = Input as any;
const AModal = Modal as any;
const ASelect = Select as any;

export default defineComponent({
  name: 'QqBotSendLogList',
  setup() {
    const saving = ref(false);
    const modalOpen = ref(false);
    const sendForm = reactive({
      message: '',
      selfId: '',
      targetId: '',
      targetType: 'private' as 'group' | 'private',
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
      sendForm.targetType === 'group' ? '群号' : 'QQ 号',
    );

    function openSend() {
      Object.assign(sendForm, {
        message: '',
        selfId: '',
        targetId: '',
        targetType: 'private',
      });
      modalOpen.value = true;
    }

    async function submitSend() {
      if (!sendForm.targetId.trim() || !sendForm.message.trim()) {
        message.warning('请填写目标和消息内容');
        return;
      }

      saving.value = true;
      try {
        await (sendForm.targetType === 'group'
          ? sendQqbotGroup({
              groupId: sendForm.targetId,
              message: sendForm.message,
              selfId: sendForm.selfId || undefined,
            })
          : sendQqbotPrivate({
              message: sendForm.message,
              selfId: sendForm.selfId || undefined,
              userId: sendForm.targetId,
            }));
        message.success('消息已发送');
        modalOpen.value = false;
        await tableApi.reload();
      } finally {
        saving.value = false;
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
        <AModal
          confirmLoading={saving.value}
          onOk={submitSend}
          {...{
            'onUpdate:open': (value: boolean) => {
              modalOpen.value = value;
            },
          }}
          open={modalOpen.value}
          title="手动发送"
          width="620px"
        >
          <Form
            labelCol={{ span: 5 }}
            model={sendForm}
            wrapperCol={{ span: 18 }}
          >
            <FormItem label="Self ID">
              <AInput
                {...{
                  'onUpdate:value': (value: string) => {
                    sendForm.selfId = value;
                  },
                }}
                placeholder="留空使用默认启用账号"
                value={sendForm.selfId}
              />
            </FormItem>
            <FormItem label="目标类型">
              <ASelect
                {...{
                  'onUpdate:value': (value: 'group' | 'private') => {
                    sendForm.targetType = value;
                  },
                }}
                options={qqbotMessageTypeOptions}
                value={sendForm.targetType}
              />
            </FormItem>
            <FormItem label={targetLabel.value} required>
              <AInput
                {...{
                  'onUpdate:value': (value: string) => {
                    sendForm.targetId = value;
                  },
                }}
                value={sendForm.targetId}
              />
            </FormItem>
            <FormItem label="消息内容" required>
              <AInput.TextArea
                autoSize={{ maxRows: 6, minRows: 3 }}
                {...{
                  'onUpdate:value': (value: string) => {
                    sendForm.message = value;
                  },
                }}
                value={sendForm.message}
              />
            </FormItem>
          </Form>
        </AModal>
      </Page>
    );
  },
});
