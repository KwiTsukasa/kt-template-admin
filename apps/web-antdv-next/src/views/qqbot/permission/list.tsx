import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/ktTable';

import { computed, defineComponent, reactive, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Switch,
  Tabs,
  Tag,
} from 'antdv-next';

import {
  createQqbotPermission,
  deleteQqbotPermission,
  getQqbotPermissionList,
  updateQqbotPermission,
} from '#/api/qqbot';
import { KtTable, useKtTable } from '#/components/ktTable';

import { getOptionLabel, qqbotTargetTypeOptions } from '../modules/options';

const AKtTable = KtTable as any;
const AInput = Input as any;
const AModal = Modal as any;
const ASelect = Select as any;
const ASwitch = Switch as any;
const ATabs = Tabs as any;

type PermissionKind = 'allowlist' | 'blocklist';

export default defineComponent({
  name: 'QqBotPermissionList',
  setup() {
    const activeKind = ref<PermissionKind>('allowlist');
    const saving = ref(false);
    const modalOpen = ref(false);
    const editingId = ref<string>();
    const form = reactive<QqbotApi.PermissionBody>({
      enabled: true,
      remark: '',
      selfId: '',
      targetId: '',
      targetType: 'private',
    });
    const columns: Array<TableColumnType<QqbotApi.Permission>> = [
      { dataIndex: 'selfId', key: 'selfId', title: 'Self ID', width: 150 },
      {
        dataIndex: 'targetType',
        key: 'targetType',
        title: '目标类型',
        width: 110,
      },
      { dataIndex: 'targetId', key: 'targetId', title: '目标 ID', width: 160 },
      { dataIndex: 'enabled', key: 'enabled', title: '状态', width: 100 },
      { dataIndex: 'remark', key: 'remark', title: '备注', width: 260 },
    ];
    const api: KtTableApi<QqbotApi.Permission> = {
      list: async (params) =>
        await getQqbotPermissionList(activeKind.value, params),
    };
    const buttons: Array<KtTableButton<QqbotApi.Permission>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: '新增名单',
        onClick: openCreate,
        permissionCodes: ['QqBot:Permission:Create'],
        type: 'primary',
      },
    ];
    const rowActions: Array<KtTableRowAction<QqbotApi.Permission>> = [
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        permissionCodes: ['QqBot:Permission:Edit'],
      },
      {
        confirm: (row) =>
          `确认删除名单「${row.targetId || row.targetType}」吗？`,
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: async (row, context) => {
          await deleteQqbotPermission(activeKind.value, row.id);
          message.success('名单删除成功');
          await context.reload();
        },
        permissionCodes: ['QqBot:Permission:Delete'],
      },
    ];
    const [registerTable, tableApi] = useKtTable<QqbotApi.Permission>({
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
              options: qqbotTargetTypeOptions,
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
        ],
      },
      rowActions,
      tableTitle: '权限名单',
    });
    const modalTitle = computed(
      () =>
        `${editingId.value ? '编辑' : '新增'}${activeKind.value === 'allowlist' ? '白名单' : '黑名单'}`,
    );

    watch(activeKind, async () => {
      await tableApi.reset();
    });

    function openCreate() {
      editingId.value = undefined;
      Object.assign(form, {
        enabled: true,
        remark: '',
        selfId: '',
        targetId: '',
        targetType: 'private',
      });
      modalOpen.value = true;
    }

    function openEdit(row: QqbotApi.Permission) {
      editingId.value = row.id;
      Object.assign(form, { ...row });
      modalOpen.value = true;
    }

    async function submitPermission() {
      if (form.targetType !== 'all' && !form.targetId.trim()) {
        message.warning('请填写目标 ID');
        return;
      }

      saving.value = true;
      try {
        await (editingId.value
          ? updateQqbotPermission(activeKind.value, {
              ...form,
              id: editingId.value,
            })
          : createQqbotPermission(activeKind.value, form));
        message.success('名单保存成功');
        modalOpen.value = false;
        await tableApi.reload();
      } finally {
        saving.value = false;
      }
    }

    return () => (
      <Page autoContentHeight>
        <div style={{ display: 'grid', gap: '12px' }}>
          <ATabs
            activeKey={activeKind.value}
            items={[
              { key: 'allowlist', label: '白名单' },
              { key: 'blocklist', label: '黑名单' },
            ]}
            {...{
              'onUpdate:activeKey': (value: PermissionKind) => {
                activeKind.value = value;
              },
            }}
          />
          <AKtTable
            onRegister={registerTable}
            v-slots={{
              bodyCell: ({ column, record }: any) => {
                const row = record as QqbotApi.Permission;
                if (column.key === 'enabled') {
                  return (
                    <Tag color={row.enabled ? 'success' : 'default'}>
                      {row.enabled ? '启用' : '停用'}
                    </Tag>
                  );
                }
                if (column.key === 'targetType') {
                  return getOptionLabel(qqbotTargetTypeOptions, row.targetType);
                }
                return undefined;
              },
            }}
          />
        </div>
        <AModal
          confirmLoading={saving.value}
          onOk={submitPermission}
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
            <FormItem label="Self ID">
              <AInput
                {...{
                  'onUpdate:value': (value: string) => {
                    form.selfId = value;
                  },
                }}
                placeholder="留空代表全部账号"
                value={form.selfId}
              />
            </FormItem>
            <FormItem label="目标类型">
              <ASelect
                {...{
                  'onUpdate:value': (
                    value: QqbotApi.PermissionBody['targetType'],
                  ) => {
                    form.targetType = value;
                  },
                }}
                options={qqbotTargetTypeOptions}
                value={form.targetType}
              />
            </FormItem>
            <FormItem label="目标 ID">
              <AInput
                disabled={form.targetType === 'all'}
                {...{
                  'onUpdate:value': (value: string) => {
                    form.targetId = value;
                  },
                }}
                placeholder="私聊填 QQ 号，群聊填群号"
                value={form.targetId}
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
