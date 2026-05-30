import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/ktTable';

import { computed, defineComponent, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Form, FormItem, Input, message, Modal, Switch, Tag } from 'antdv-next';

import {
  createQqbotAccount,
  deleteQqbotAccount,
  getQqbotAccountList,
  kickQqbotAccount,
  updateQqbotAccount,
} from '#/api/qqbot';
import { KtTable, useKtTable } from '#/components/ktTable';

const AKtTable = KtTable as any;
const AInput = Input as any;
const AModal = Modal as any;
const ASwitch = Switch as any;

export default defineComponent({
  name: 'QqBotAccountList',
  setup() {
    const saving = ref(false);
    const modalOpen = ref(false);
    const editingId = ref<string>();
    const form = reactive<QqbotApi.AccountBody>({
      accessToken: '',
      connectionMode: 'reverse-ws',
      enabled: true,
      name: '',
      remark: '',
      selfId: '',
    });

    const columns: Array<TableColumnType<QqbotApi.Account>> = [
      { dataIndex: 'selfId', key: 'selfId', title: 'Self ID', width: 160 },
      { dataIndex: 'name', key: 'name', title: '账号名称', width: 180 },
      {
        dataIndex: 'connectStatus',
        key: 'connectStatus',
        title: '连接状态',
        width: 120,
      },
      {
        dataIndex: 'clientRole',
        key: 'clientRole',
        title: '连接角色',
        width: 120,
      },
      {
        dataIndex: 'lastHeartbeatAt',
        key: 'lastHeartbeatAt',
        title: '最后心跳',
        width: 190,
      },
      {
        dataIndex: 'lastError',
        key: 'lastError',
        title: '错误信息',
        width: 260,
      },
    ];

    const api: KtTableApi<QqbotApi.Account> = {
      list: async (params) => await getQqbotAccountList(params),
    };
    const buttons: Array<KtTableButton<QqbotApi.Account>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: '新建账号',
        onClick: openCreate,
        permissionCodes: ['QqBot:Account:Create'],
        type: 'primary',
      },
    ];
    const rowActions: Array<KtTableRowAction<QqbotApi.Account>> = [
      {
        disabled: (row) => row.connectStatus !== 'online',
        key: 'kick',
        label: '断开',
        onClick: async (row, context) => {
          await kickQqbotAccount(row.selfId);
          message.success('连接已断开');
          await context.reload();
        },
        permissionCodes: ['QqBot:Account:Kick'],
      },
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        permissionCodes: ['QqBot:Account:Edit'],
      },
      {
        confirm: (row) => `确认删除账号「${row.selfId}」吗？`,
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: async (row, context) => {
          await deleteQqbotAccount(row.id);
          message.success('账号删除成功');
          await context.reload();
        },
        permissionCodes: ['QqBot:Account:Delete'],
      },
    ];
    const [registerTable, tableApi] = useKtTable<QqbotApi.Account>({
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
            component: 'Input',
            componentProps: { allowClear: true, placeholder: '账号名称' },
            fieldName: 'name',
            label: '账号名称',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: [
                { label: '在线', value: 'online' },
                { label: '离线', value: 'offline' },
              ],
            },
            fieldName: 'connectStatus',
            label: '连接状态',
          },
        ],
      },
      rowActions,
      tableTitle: 'QQBot 账号连接',
    });
    const modalTitle = computed(() =>
      editingId.value ? '编辑账号' : '新建账号',
    );

    function openCreate() {
      editingId.value = undefined;
      Object.assign(form, {
        accessToken: '',
        connectionMode: 'reverse-ws',
        enabled: true,
        name: '',
        remark: '',
        selfId: '',
      });
      modalOpen.value = true;
    }

    function openEdit(row: QqbotApi.Account) {
      editingId.value = row.id;
      Object.assign(form, {
        accessToken: '',
        connectionMode: row.connectionMode,
        enabled: row.enabled,
        id: row.id,
        name: row.name,
        remark: row.remark || '',
        selfId: row.selfId,
      });
      modalOpen.value = true;
    }

    async function submitAccount() {
      if (!form.selfId.trim()) {
        message.warning('请填写 Self ID');
        return;
      }

      saving.value = true;
      try {
        const payload = {
          ...form,
          id: editingId.value,
          selfId: form.selfId.trim(),
        };
        if (!payload.accessToken) delete payload.accessToken;
        await (editingId.value
          ? updateQqbotAccount(payload)
          : createQqbotAccount(payload));
        message.success('账号保存成功');
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
              const row = record as QqbotApi.Account;
              if (column.key === 'connectStatus') {
                return (
                  <Tag
                    color={
                      row.connectStatus === 'online' ? 'success' : 'default'
                    }
                  >
                    {row.connectStatus === 'online' ? '在线' : '离线'}
                  </Tag>
                );
              }
              return undefined;
            },
          }}
        />
        <AModal
          confirmLoading={saving.value}
          onOk={submitAccount}
          {...{
            'onUpdate:open': (value: boolean) => {
              modalOpen.value = value;
            },
          }}
          open={modalOpen.value}
          title={modalTitle.value}
          width="620px"
        >
          <Form labelCol={{ span: 5 }} model={form} wrapperCol={{ span: 18 }}>
            <FormItem label="Self ID" required>
              <AInput
                {...{
                  'onUpdate:value': (value: string) => {
                    form.selfId = value;
                  },
                }}
                placeholder="NapCat 当前登录 QQ"
                value={form.selfId}
              />
            </FormItem>
            <FormItem label="账号名称">
              <AInput
                {...{
                  'onUpdate:value': (value: string) => {
                    form.name = value;
                  },
                }}
                placeholder="便于后台识别"
                value={form.name}
              />
            </FormItem>
            <FormItem label="Token">
              <AInput.Password
                {...{
                  'onUpdate:value': (value: string) => {
                    form.accessToken = value;
                  },
                }}
                placeholder={
                  editingId.value ? '留空表示不修改' : 'OneBot 反向 WS token'
                }
                value={form.accessToken}
              />
            </FormItem>
            <FormItem label="启用">
              <ASwitch
                checked={form.enabled}
                {...{
                  'onUpdate:checked': (value: boolean) => {
                    form.enabled = value;
                  },
                }}
              />
            </FormItem>
            <FormItem label="备注">
              <AInput
                {...{
                  'onUpdate:value': (value: string) => {
                    form.remark = value;
                  },
                }}
                value={form.remark}
              />
            </FormItem>
          </Form>
        </AModal>
      </Page>
    );
  },
});
