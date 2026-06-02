import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/ktTable';

import { computed, defineComponent, onMounted, ref, watch } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Switch, Tabs, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
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
    const editingId = ref<string>();
    const permissionConfig = ref<QqbotApi.PermissionConfig>({
      allowlistEnabled: false,
      blocklistEnabled: true,
    });
    const [PermissionForm, permissionFormApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      handleValuesChange(values, fieldsChanged) {
        if (fieldsChanged.includes('preciseUser') && !values.preciseUser) {
          void permissionFormApi.setFieldValue('userId', '');
        }
      },
      layout: 'horizontal',
      schema: [
        {
          component: 'Input',
          componentProps: {
            placeholder: '留空代表全部账号',
          },
          fieldName: 'selfId',
          label: 'Self ID',
        },
        {
          component: 'Select',
          componentProps: {
            disabled: true,
            options: qqbotPermissionTargetOptions,
          },
          fieldName: 'targetType',
          label: '目标类型',
        },
        {
          component: 'Input',
          componentProps: () => ({
            placeholder: `请填写${targetIdLabel.value}`,
          }),
          fieldName: 'targetId',
          label: () => targetIdLabel.value,
          rules: 'required',
        },
        {
          component: 'Switch',
          dependencies: {
            if: () => isPreciseAvailable(),
            triggerFields: ['targetType'],
          },
          fieldName: 'preciseUser',
          label: '精确 QQ',
        },
        {
          component: 'Input',
          componentProps: {
            placeholder: '请填写需要精确匹配的 QQ 号',
          },
          dependencies: {
            if(values) {
              return isPreciseAvailable() && !!values.preciseUser;
            },
            triggerFields: ['preciseUser', 'targetType'],
          },
          fieldName: 'userId',
          label: 'QQ 号',
          rules: 'required',
        },
        {
          component: 'Switch',
          fieldName: 'enabled',
          label: '启用',
        },
        {
          component: 'Input',
          fieldName: 'remark',
          label: '备注',
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
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
    });
    const activeTargetLabel = computed(() => getPermissionTargetLabel());
    const permissionModeChecked = computed({
      get: () => permissionConfig.value.allowlistEnabled,
      set: (checked: boolean) => {
        void handlePermissionModeChange(checked);
      },
    });
    const modalTitle = computed(
      () =>
        `${editingId.value ? '编辑' : '新增'}${activeTargetLabel.value}${activeKind.value === 'allowlist' ? '白名单' : '黑名单'}`,
    );
    const targetIdLabel = computed(() => {
      if (activeTargetType.value === 'group') return '群号';
      if (activeTargetType.value === 'channel') return '频道 ID';
      return 'QQ 号';
    });

    const [PermissionModal, permissionModalApi] = useVbenModal({
      class: 'w-[620px]',
      fullscreenButton: false,
      async onConfirm() {
        await submitPermission();
      },
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = permissionModalApi.getData<{
          values?: QqbotApi.PermissionBody;
        }>();
        void resetPermissionForm(values || getPermissionFormDefaults());
      },
    });

    onMounted(() => {
      void loadConfig();
    });

    watch([activeKind, activeTargetType], async () => {
      await tableApi.reset();
    });

    async function loadConfig() {
      const config = await getQqbotPermissionConfig();
      permissionConfig.value = normalizePermissionConfig(config);
    }

    function getPermissionFormDefaults(): QqbotApi.PermissionBody {
      return {
        enabled: true,
        preciseUser: false,
        remark: '',
        selfId: '',
        targetId: '',
        targetType: activeTargetType.value,
        userId: '',
      };
    }

    async function resetPermissionForm(values: QqbotApi.PermissionBody) {
      await permissionFormApi.resetForm();
      await permissionFormApi.setValues(values);
      await permissionFormApi.resetValidate();
    }

    function openCreate() {
      editingId.value = undefined;
      permissionModalApi
        .setData({ values: getPermissionFormDefaults() })
        .open();
    }

    function openEdit(row: QqbotApi.Permission) {
      editingId.value = row.id;
      activeTargetType.value = normalizePermissionTargetType(row.targetType);
      permissionModalApi
        .setData({
          values: {
            ...row,
            preciseUser: !!row.preciseUser,
            targetType: activeTargetType.value,
            userId: row.userId || '',
          },
        })
        .open();
    }

    async function submitPermission() {
      const { valid } = await permissionFormApi.validate();
      if (!valid) return;

      const values =
        await permissionFormApi.getValues<QqbotApi.PermissionBody>();
      const targetId = values.targetId?.trim();
      if (!targetId) {
        message.warning(`请填写${targetIdLabel.value}`);
        return;
      }
      if (
        isPreciseAvailable() &&
        values.preciseUser &&
        !values.userId?.trim()
      ) {
        message.warning('开启精确到 QQ 号后必须填写 QQ 号');
        return;
      }

      const payload: QqbotApi.PermissionBody = {
        ...values,
        preciseUser: isPreciseAvailable() ? !!values.preciseUser : false,
        targetId,
        targetType: activeTargetType.value,
        userId:
          isPreciseAvailable() && values.preciseUser
            ? values.userId?.trim()
            : '',
      };
      if (!isPreciseAvailable()) {
        payload.preciseUser = false;
        payload.userId = '';
      }

      permissionModalApi.lock();
      try {
        await (editingId.value
          ? updateQqbotPermission(activeKind.value, {
              ...payload,
              id: editingId.value,
            })
          : createQqbotPermission(activeKind.value, payload));
        message.success('名单保存成功');
        await permissionModalApi.close();
        await tableApi.reload();
      } finally {
        permissionModalApi.unlock();
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

    /**
     * 切换权限名单过滤模式，并立刻保存互斥后的配置。
     *
     * @param checked switch 选中状态；true 表示白名单，false 表示黑名单。
     */
    async function handlePermissionModeChange(checked: boolean) {
      const nextKind: PermissionKind = checked ? 'allowlist' : 'blocklist';
      const nextConfig = {
        allowlistEnabled: nextKind === 'allowlist',
        blocklistEnabled: nextKind === 'blocklist',
      };

      configSaving.value = true;
      try {
        Object.assign(
          permissionConfig.value,
          normalizePermissionConfig(
            await updateQqbotPermissionConfig(nextConfig),
          ),
        );
        activeKind.value = nextKind;
        message.success('权限配置已更新');
      } finally {
        configSaving.value = false;
      }
    }

    /**
     * 归一化后端配置，保证页面展示始终只有一种名单过滤模式。
     *
     * @param config 后端返回的权限配置。
     */
    function normalizePermissionConfig(
      config: QqbotApi.PermissionConfig,
    ): QqbotApi.PermissionConfig {
      const allowlistEnabled = !!config.allowlistEnabled;

      return {
        allowlistEnabled,
        blocklistEnabled: !allowlistEnabled,
      };
    }

    /**
     * 渲染 KtTable 表头控制区。
     */
    const renderHeaderControls = () => {
      return (
        <>
          <div class="kt-table__header-control-group">
            <ATabs
              class="kt-table__header-tabs"
              items={[
                { key: 'allowlist', label: '白名单' },
                { key: 'blocklist', label: '黑名单' },
              ]}
              v-model:activeKey={activeKind.value}
            />
          </div>
          <div class="kt-table__header-control-group kt-table__header-control-group--grow">
            <ATabs
              class="kt-table__header-tabs"
              items={permissionTargetTabItems}
              v-model:activeKey={activeTargetType.value}
            />
          </div>
        </>
      );
    };

    /**
     * 渲染 KtTable 按钮区里的权限过滤模式。
     */
    const renderPermissionModeToolbar = () => {
      return (
        <div class="kt-table__header-control-group">
          <span class="kt-table__header-control-muted">过滤模式</span>
          <ASwitch
            checkedChildren="白名单"
            loading={configSaving.value}
            unCheckedChildren="黑名单"
            v-model:checked={permissionModeChecked.value}
          />
        </div>
      );
    };

    return () => (
      <Page autoContentHeight>
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
            headerControls: renderHeaderControls,
            toolbar: renderPermissionModeToolbar,
          }}
        />
        <PermissionModal title={modalTitle.value}>
          <PermissionForm class="mx-2" />
        </PermissionModal>
      </Page>
    );
  },
});
