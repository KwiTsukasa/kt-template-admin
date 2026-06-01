import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/ktTable';

import {
  computed,
  defineComponent,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Button,
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
  getQqbotPermissionConfig,
  getQqbotPermissionList,
  updateQqbotPermission,
  updateQqbotPermissionConfig,
} from '#/api/qqbot';
import { KtTable, useKtTable } from '#/components/ktTable';

import {
  getOptionLabel,
  qqbotPermissionTargetOptions,
} from '../modules/options';

const AKtTable = KtTable as any;
const AButton = Button as any;
const AInput = Input as any;
const AModal = Modal as any;
const ASelect = Select as any;
const ASwitch = Switch as any;
const ATabs = Tabs as any;

type PermissionKind = 'allowlist' | 'blocklist';
type PermissionTargetType = QqbotApi.PermissionBody['targetType'];
const permissionTargetTabItems = qqbotPermissionTargetOptions.map((item) => ({
  key: item.value,
  label: item.label,
}));

export default defineComponent({
  name: 'QqBotPermissionList',
  setup() {
    const activeKind = ref<PermissionKind>('allowlist');
    const activeTargetType = ref<PermissionTargetType>('qq');
    const configSaving = ref(false);
    const saving = ref(false);
    const modalOpen = ref(false);
    const editingId = ref<string>();
    const permissionConfig = reactive<QqbotApi.PermissionConfig>({
      allowlistEnabled: false,
      blocklistEnabled: true,
    });
    const form = reactive<QqbotApi.PermissionBody>({
      enabled: true,
      preciseUser: false,
      remark: '',
      selfId: '',
      targetId: '',
      targetType: 'qq',
      userId: '',
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
      {
        dataIndex: 'preciseUser',
        key: 'preciseUser',
        title: '精确 QQ',
        width: 100,
      },
      { dataIndex: 'userId', key: 'userId', title: 'QQ 号', width: 150 },
      { dataIndex: 'enabled', key: 'enabled', title: '状态', width: 100 },
      { dataIndex: 'remark', key: 'remark', title: '备注', width: 260 },
    ];
    const api: KtTableApi<QqbotApi.Permission> = {
      list: async (params) =>
        await getQqbotPermissionList(activeKind.value, {
          ...params,
          targetType: activeTargetType.value,
        }),
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
            component: 'Input',
            componentProps: { allowClear: true, placeholder: '目标 ID' },
            fieldName: 'targetId',
            label: '目标 ID',
          },
          {
            component: 'Input',
            componentProps: { allowClear: true, placeholder: 'QQ 号' },
            fieldName: 'userId',
            label: 'QQ 号',
          },
        ],
      },
      rowActions,
      tableTitle: '权限名单',
    });
    const activeTargetLabel = computed(() => getPermissionTargetLabel());
    const modalTitle = computed(
      () =>
        `${editingId.value ? '编辑' : '新增'}${activeTargetLabel.value}${activeKind.value === 'allowlist' ? '白名单' : '黑名单'}`,
    );
    const targetIdLabel = computed(() => {
      if (activeTargetType.value === 'group') return '群号';
      if (activeTargetType.value === 'channel') return '频道 ID';
      return 'QQ 号';
    });

    onMounted(() => {
      void loadConfig();
    });

    watch([activeKind, activeTargetType], async () => {
      await tableApi.reset();
    });

    async function loadConfig() {
      Object.assign(permissionConfig, await getQqbotPermissionConfig());
    }

    async function saveConfig() {
      configSaving.value = true;
      try {
        Object.assign(
          permissionConfig,
          await updateQqbotPermissionConfig(permissionConfig),
        );
        message.success('权限配置保存成功');
      } finally {
        configSaving.value = false;
      }
    }

    function openCreate() {
      editingId.value = undefined;
      Object.assign(form, {
        enabled: true,
        preciseUser: false,
        remark: '',
        selfId: '',
        targetId: '',
        targetType: activeTargetType.value,
        userId: '',
      });
      modalOpen.value = true;
    }

    function openEdit(row: QqbotApi.Permission) {
      editingId.value = row.id;
      activeTargetType.value = normalizePermissionTargetType(row.targetType);
      Object.assign(form, {
        ...row,
        preciseUser: !!row.preciseUser,
        targetType: activeTargetType.value,
        userId: row.userId || '',
      });
      modalOpen.value = true;
    }

    async function submitPermission() {
      form.targetType = activeTargetType.value;
      if (!form.targetId.trim()) {
        message.warning(`请填写${targetIdLabel.value}`);
        return;
      }
      if (isPreciseAvailable() && form.preciseUser && !form.userId?.trim()) {
        message.warning('开启精确到 QQ 号后必须填写 QQ 号');
        return;
      }
      if (!isPreciseAvailable()) {
        form.preciseUser = false;
        form.userId = '';
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

    function getPermissionTargetLabel(value = activeTargetType.value) {
      return getOptionLabel(qqbotPermissionTargetOptions, value);
    }

    function isPreciseAvailable() {
      return (
        activeTargetType.value === 'group' ||
        activeTargetType.value === 'channel'
      );
    }

    function normalizePermissionTargetType(
      value?: string,
    ): PermissionTargetType {
      if (value === 'group' || value === 'channel' || value === 'qq') {
        return value;
      }
      return 'qq';
    }

    return () => (
      <Page autoContentHeight>
        <div style={{ display: 'grid', gap: '12px' }}>
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              gap: '20px',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: '20px' }}>
              <span>
                白名单过滤：
                <ASwitch
                  checked={permissionConfig.allowlistEnabled}
                  {...{
                    'onUpdate:checked': (value: boolean) => {
                      permissionConfig.allowlistEnabled = value;
                    },
                  }}
                />
              </span>
              <span>
                黑名单过滤：
                <ASwitch
                  checked={permissionConfig.blocklistEnabled}
                  {...{
                    'onUpdate:checked': (value: boolean) => {
                      permissionConfig.blocklistEnabled = value;
                    },
                  }}
                />
              </span>
            </div>
            <AButton loading={configSaving.value} onClick={saveConfig}>
              保存配置
            </AButton>
          </div>
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
          <ATabs
            activeKey={activeTargetType.value}
            items={permissionTargetTabItems}
            {...{
              'onUpdate:activeKey': (value: PermissionTargetType) => {
                activeTargetType.value = value;
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
                  return getPermissionTargetLabel(row.targetType);
                }
                if (column.key === 'preciseUser') {
                  if (row.targetType === 'qq' || row.targetType === 'private') {
                    return '-';
                  }
                  return row.preciseUser ? '是' : '否';
                }
                if (column.key === 'userId') {
                  return row.preciseUser ? row.userId || '-' : '-';
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
                disabled
                options={qqbotPermissionTargetOptions}
                value={activeTargetType.value}
              />
            </FormItem>
            <FormItem label={targetIdLabel.value}>
              <AInput
                {...{
                  'onUpdate:value': (value: string) => {
                    form.targetId = value;
                  },
                }}
                placeholder={`请填写${targetIdLabel.value}`}
                value={form.targetId}
              />
            </FormItem>
            {isPreciseAvailable() && (
              <>
                <FormItem label="精确 QQ">
                  <ASwitch
                    checked={form.preciseUser}
                    {...{
                      'onUpdate:checked': (value: boolean) => {
                        form.preciseUser = value;
                        if (!value) form.userId = '';
                      },
                    }}
                  />
                </FormItem>
                {form.preciseUser && (
                  <FormItem label="QQ 号">
                    <AInput
                      {...{
                        'onUpdate:value': (value: string) => {
                          form.userId = value;
                        },
                      }}
                      placeholder="请填写需要精确匹配的 QQ 号"
                      value={form.userId}
                    />
                  </FormItem>
                )}
              </>
            )}
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
