import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/kt-table';

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
import { KtTable, useKtTable } from '#/components/kt-table';

import {
  getOptionLabel,
  qqbotPermissionTargetOptions,
} from '../modules/options';
import { getQqbotStatusColor, getQqbotStatusLabel } from '../modules/status';

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
      /**
       * 关闭精确用户模式时清空已填写的用户标识，避免提交隐藏字段。
       *
       * @param values - 权限表单当前的精确用户开关；关闭后会清空隐藏的用户标识。
       * @param fieldsChanged - 本次发生变化的表单字段名集合，用于只处理相关依赖字段。
       */
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
            /**
             * 仅当精确名单可编辑且已选择用户目标时显示对应权限字段。
             *
             * @param values - 包含 preciseUser 的权限表单字段，用于决定精确用户输入是否显示。
             * @returns 精确名单可编辑且已选择用户目标时返回 true，否则返回 false。
             */
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
        `${(() => {
          if (editingId.value) {
            return '编辑';
          }
          return '新增';
        })()}${activeTargetLabel.value}${(() => {
          if (activeKind.value === 'allowlist') {
            return '白名单';
          }
          return '黑名单';
        })()}`,
    );
    const targetIdLabel = computed(() => {
      if (activeTargetType.value === 'group') return '群号';
      if (activeTargetType.value === 'channel') return '频道 ID';
      return 'QQ 号';
    });

    const [PermissionModal, permissionModalApi] = useVbenModal({
      class: 'w-[620px]',
      fullscreenButton: false,
      /**
       * 确认权限弹窗时校验并提交目标类型、名单模式和用户标识。
       */
      async onConfirm() {
        await submitPermission();
      },
      /**
       * 仅在权限弹窗打开时读取上下文值，并重置目标类型与名单字段。
       *
       * @param isOpen - 弹窗或抽屉最新显隐状态；true 表示已打开。
       */
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

    /**
     * 加载 QQBot 权限配置并归一化名单与模式后写入页面状态。
     */
    async function loadConfig() {
      const config = await getQqbotPermissionConfig();
      permissionConfig.value = normalizePermissionConfig(config);
    }

    /**
     * 生成默认启用、非精确用户且沿用当前目标类型的权限表单值。
     *
     * @returns 编辑时为当前权限字段，新建时为默认目标类型与名单配置。
     */
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

    /**
     * 清空 QQBot 权限表单后写入目标字段值，并移除上一轮校验错误。
     *
     * @param values - 重置后要写入 QQBot 权限表单的完整字段。
     */
    async function resetPermissionForm(values: QqbotApi.PermissionBody) {
      await permissionFormApi.resetForm();
      await permissionFormApi.setValues(values);
      await permissionFormApi.resetValidate();
    }

    /**
     * 清除权限编辑标识，并用默认目标类型与名单模式打开新建弹窗。
     */
    function openCreate() {
      editingId.value = undefined;
      permissionModalApi
        .setData({ values: getPermissionFormDefaults() })
        .open();
    }

    /**
     * 规范化选中权限的目标类型和精确名单字段，并打开编辑弹窗。
     *
     * @param row - 要加载到权限编辑弹窗的白名单或黑名单记录。
     */
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

    /**
     * 校验并规范化 QQBot 名单目标；精确用户模式要求 QQ 号，保存后关闭弹窗并刷新列表。
     */
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
        preciseUser: (() => {
          if (isPreciseAvailable()) {
            return !!values.preciseUser;
          }
          return false;
        })(),
        targetId,
        targetType: activeTargetType.value,
        userId: (() => {
          if (isPreciseAvailable() && values.preciseUser) {
            return values.userId?.trim();
          }
          return '';
        })(),
      };
      if (!isPreciseAvailable()) {
        payload.preciseUser = false;
        payload.userId = '';
      }

      permissionModalApi.lock();
      try {
        await (() => {
          if (editingId.value) {
            return updateQqbotPermission(activeKind.value, {
              ...payload,
              id: editingId.value,
            });
          }
          return createQqbotPermission(activeKind.value, payload);
        })();
        message.success('名单保存成功');
        await permissionModalApi.close();
        await tableApi.reload();
      } finally {
        permissionModalApi.unlock();
      }
    }

    /**
     * 将用户、群或频道权限目标类型映射为界面标签。
     *
     * @param value - 要显示为用户、群或频道标签的权限目标类型；缺省时读取当前选择。
     * @returns 权限目标类型对应的用户、群或频道标签。
     */
    function getPermissionTargetLabel(value = activeTargetType.value) {
      return getOptionLabel(qqbotPermissionTargetOptions, value);
    }

    /**
     * 只有权限配置已加载且当前名单模式可精确编辑时才允许修改名单。
     *
     * @returns 权限配置已加载且当前名单模式可精确编辑时返回 true，否则返回 false。
     */
    function isPreciseAvailable() {
      return (
        activeTargetType.value === 'group' ||
        activeTargetType.value === 'channel'
      );
    }

    /**
     * 仅接受 QQ、群或频道权限目标类型，其他输入统一回退到 QQ。
     *
     * @param value - 待校验的权限目标类型；非法值回退为 QQ。
     * @returns 合法的 QQ、群或频道目标类型；其他输入回退为 QQ。
     */
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
     * @param checked - 权限模式开关状态；true 选择白名单，false 选择黑名单。
     */
    async function handlePermissionModeChange(checked: boolean) {
      const nextKind: PermissionKind = (() => {
        if (checked) {
          return 'allowlist';
        }
        return 'blocklist';
      })();
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
     * 将后端权限配置规整为单一名单模式，避免白名单与黑名单同时启用。
     *
     * @param config - 后端返回的 QQBot 名单模式与精确用户配置。
     * @returns 仅保留当前名单模式字段、并补齐精确用户数组的权限配置。
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
                const status = (() => {
                  if (row.enabled) {
                    return 'enabled';
                  }
                  return 'disabled';
                })();
                return (
                  <Tag color={getQqbotStatusColor(status)}>
                    {getQqbotStatusLabel(status)}
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
                if (row.preciseUser) {
                  return '是';
                }
                return '否';
              }
              if (column.key === 'userId') {
                if (row.preciseUser) {
                  return row.userId || '-';
                }
                return '-';
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
