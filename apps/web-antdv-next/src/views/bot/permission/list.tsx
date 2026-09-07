import type { TableColumnType } from 'antdv-next';

import type { PermissionTreeRow } from './permissionTree';

import type { BotApi } from '#/api/bot';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/kt-table';

import { computed, defineComponent, onMounted, ref, watch } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Tabs, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createBotPermission,
  deleteBotPermission,
  getBotPermissionList,
  updateBotPermission,
} from '#/api/bot';
import { KtTable, useKtTable } from '#/components/kt-table';

import { botPermissionTargetOptions, getOptionLabel } from '../modules/options';
import { getBotStatusColor, getBotStatusLabel } from '../modules/status';
import { buildPermissionTree } from './permissionTree';
import { usePermissionOptions } from './usePermissionOptions';

const AKtTable = KtTable as any;
const ATabs = Tabs as any;

type PermissionKind = 'allowlist' | 'blocklist';
type PermissionTargetType = Exclude<
  BotApi.PermissionBody['targetType'],
  'private'
>;
const permissionTargetTabItems = botPermissionTargetOptions.map((item) => ({
  key: item.value,
  label: item.label,
}));

export default defineComponent({
  name: 'BotPermissionList',
  setup() {
    const activeKind = ref<PermissionKind>('allowlist');
    const activeTargetType = ref<PermissionTargetType>('qq');
    const editingId = ref<string>();
    const editOptions = usePermissionOptions();
    const searchOptions = usePermissionOptions();
    let restoring = false;
    let formRevision = 0;
    let editScope = { selfId: '', targetId: '', preciseUser: false };
    const [PermissionForm, permissionFormApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      /**
       * 切换账号时清空目标和用户，切换会话或关闭精确模式时清空用户，再加载当前账号的级联候选。
       *
       * @param values - 权限表单当前的精确用户开关；关闭后会清空隐藏的用户标识。
       * @param fieldsChanged - 本次发生变化的表单字段名集合，用于只处理相关依赖字段。
       */
      async handleValuesChange(values, fieldsChanged) {
        if (restoring) return;
        if (
          !fieldsChanged.some((field) =>
            ['preciseUser', 'selfId', 'targetId'].includes(field),
          )
        )
          return;
        const nextScope = {
          selfId: values.selfId || '',
          targetId: values.targetId || '',
          preciseUser: !!values.preciseUser,
        };
        const selfChanged = nextScope.selfId !== editScope.selfId;
        const targetChanged = nextScope.targetId !== editScope.targetId;
        if (
          !selfChanged &&
          !targetChanged &&
          nextScope.preciseUser === editScope.preciseUser
        )
          return;
        if (selfChanged) nextScope.targetId = '';
        editScope = nextScope;
        const revision = formRevision;
        restoring = true;
        try {
          if (selfChanged) {
            await permissionFormApi.setFieldValue('targetId', '');
            values = { ...values, targetId: '' };
          }
          if (selfChanged || targetChanged || !values.preciseUser) {
            await permissionFormApi.setFieldValue('userIds', []);
          }
        } finally {
          if (revision === formRevision) restoring = false;
        }
        if (revision !== formRevision) return;
        await editOptions.load({
          selfId: values.selfId,
          targetId: values.targetId,
          targetType: normalizePermissionTargetType(values.targetType),
        });
      },
      layout: 'horizontal',
      schema: [
        {
          component: 'Select',
          componentProps: () => ({
            allowClear: true,
            showSearch: true,
            optionFilterProp: 'label',
            options: editOptions.data.value.accounts,
            placeholder: '全局（未指定账号）',
          }),
          fieldName: 'selfId',
          label: 'Bot 账号',
        },
        {
          component: 'Select',
          componentProps: {
            disabled: true,
            options: botPermissionTargetOptions,
          },
          fieldName: 'targetType',
          label: '目标类型',
        },
        {
          component: 'Select',
          componentProps: () => ({
            allowClear: true,
            showSearch: true,
            optionFilterProp: 'label',
            loading: editOptions.loading.value,
            options: editOptions.data.value.targets,
            placeholder: `请先选择账号，再选择${targetIdLabel.value}`,
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
          label: '精确用户',
        },
        {
          component: 'Select',
          componentProps: () => ({
            allowClear: true,
            showSearch: true,
            optionFilterProp: 'label',
            loading: editOptions.loading.value,
            options: editOptions.data.value.users,
            mode: 'multiple',
            placeholder: '请先选择群或频道，再选择用户',
          }),
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
          fieldName: 'userIds',
          label: '用户',
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
    const columns: Array<TableColumnType<BotApi.Permission>> = [
      {
        dataIndex: 'selfId',
        key: 'selfId',
        title: 'Bot 账号 / 全局',
        width: 300,
      },
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
    const visibleColumns = computed(() =>
      columns.filter((column) => {
        if (isPreciseAvailable()) return true;
        return column.key !== 'preciseUser' && column.key !== 'userId';
      }),
    );
    const api: KtTableApi<BotApi.Permission> = {
      list: async (params) => {
        const result = await getBotPermissionList(activeKind.value, {
          ...params,
          targetType: activeTargetType.value,
          view: 'tree',
        });
        if (searchOptions.data.value.accounts.length === 0)
          await searchOptions.load();
        return {
          ...result,
          list: buildPermissionTree(
            result.list,
            searchOptions.data.value.accounts,
          ),
        };
      },
    };
    const rowActions: Array<KtTableRowAction<BotApi.Permission>> = [
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        rowVisible: (row) => !(row as PermissionTreeRow).children,
        permissionCodes: ['Bot:Permission:Edit'],
      },
      {
        confirm: (row) =>
          `确认删除名单「${row.targetId || row.targetType}」吗？`,
        danger: true,
        key: 'delete',
        rowVisible: (row) => !(row as PermissionTreeRow).children,
        label: '删除',
        onClick: async (row, context) => {
          await deleteBotPermission(activeKind.value, row.id);
          message.success('名单删除成功');
          await context.reload();
        },
        permissionCodes: ['Bot:Permission:Delete'],
      },
    ];
    const buttons: Array<KtTableButton<BotApi.Permission>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: '新增名单',
        onClick: openCreate,
        permissionCodes: ['Bot:Permission:Create'],
        type: 'primary',
      },
    ];
    const [registerTable, tableApi] = useKtTable<BotApi.Permission>({
      api,
      buttons,
      columns,
      formOptions: {
        /**
         * 按搜索账号重载目标，切换会话时清空旧用户，避免跨账号筛选。
         * @param values - 搜索表单当前账号和会话。
         * @param fieldsChanged - 本次变更的搜索字段集合。
         */
        async handleValuesChange(values, fieldsChanged) {
          if (
            !fieldsChanged.some((field) =>
              ['selfId', 'targetId'].includes(field),
            )
          )
            return;
          if (fieldsChanged.includes('selfId')) {
            await tableApi.formApi.setFieldValue('targetId', '');
            values = { ...values, targetId: '' };
          }
          await tableApi.formApi.setFieldValue('userId', '');
          await searchOptions.load({
            selfId: values.selfId,
            targetId: values.targetId,
            targetType: normalizePermissionTargetType(activeTargetType.value),
          });
        },
        schema: [
          {
            component: 'Select',
            componentProps: () => ({
              allowClear: true,
              showSearch: true,
              optionFilterProp: 'label',
              options: searchOptions.data.value.accounts,
              placeholder: '全部 Bot 账号',
            }),
            fieldName: 'selfId',
            label: 'Bot 账号',
          },
          {
            component: 'Select',
            componentProps: () => ({
              allowClear: true,
              showSearch: true,
              optionFilterProp: 'label',
              loading: searchOptions.loading.value,
              options: searchOptions.data.value.targets,
              placeholder: '请先选择账号',
            }),
            fieldName: 'targetId',
            label: '目标 ID',
          },
          {
            component: 'Select',
            componentProps: () => ({
              allowClear: true,
              showSearch: true,
              optionFilterProp: 'label',
              loading: searchOptions.loading.value,
              options: searchOptions.data.value.users,
              placeholder: '请先选择群或频道',
            }),
            fieldName: 'userId',
            label: 'QQ 号',
            dependencies: {
              if: () => isPreciseAvailable(),
              triggerFields: ['selfId', 'targetId'],
            },
          },
        ],
      },
      rowActions,
      showIndex: false,
      showPagination: false,
    });
    const activeTargetLabel = computed(() => getPermissionTargetLabel());
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
      if (activeTargetType.value === 'group') return '群聊';
      if (activeTargetType.value === 'channel') return '频道';
      return '用户';
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
        if (!isOpen) {
          formRevision += 1;
          restoring = false;
          editOptions.clear();
          return;
        }
        const { values } = permissionModalApi.getData<{
          values?: BotApi.PermissionBody;
        }>();
        void resetPermissionForm(values || getPermissionFormDefaults());
      },
    });

    onMounted(() => {
      void searchOptions.load();
    });

    watch([activeKind, activeTargetType], async () => {
      searchOptions.clear();
      tableApi.formApi.updateSchema([
        {
          fieldName: 'userId',
          dependencies: {
            if: isPreciseAvailable(),
            triggerFields: ['selfId', 'targetId'],
          },
        },
      ]);
      await tableApi.reset();
    });

    /**
     * 生成默认启用、非精确用户且沿用当前目标类型的权限表单值。
     *
     * @returns 编辑时为当前权限字段，新建时为默认目标类型与名单配置。
     */
    function getPermissionFormDefaults(): BotApi.PermissionBody {
      return {
        enabled: true,
        preciseUser: false,
        remark: '',
        selfId: '',
        targetId: '',
        targetType: activeTargetType.value,
        userId: '',
        userIds: [],
      };
    }

    /**
     * 清空 Bot 权限表单后写入目标字段值，并移除上一轮校验错误。
     *
     * @param values - 重置后要写入 Bot 权限表单的完整字段。
     */
    async function resetPermissionForm(values: BotApi.PermissionBody) {
      const revision = ++formRevision;
      restoring = true;
      try {
        await permissionFormApi.resetForm();
        if (revision !== formRevision) return;
        editScope = {
          selfId: values.selfId || '',
          targetId: values.targetId || '',
          preciseUser: !!values.preciseUser,
        };
        await permissionFormApi.setValues(values);
        restoring = false;
        await editOptions.load(
          {
            selfId: values.selfId,
            targetId: values.targetId,
            targetType: normalizePermissionTargetType(values.targetType),
          },
          values,
        );
        if (revision !== formRevision) return;
        await permissionFormApi.resetValidate();
      } finally {
        if (revision === formRevision) restoring = false;
      }
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
    function openEdit(row: BotApi.Permission) {
      editingId.value = row.id;
      activeTargetType.value = normalizePermissionTargetType(row.targetType);
      permissionModalApi
        .setData({
          values: {
            ...row,
            preciseUser: !!row.preciseUser,
            targetType: activeTargetType.value,
            userId: row.userId || '',
            userIds:
              row.userIds ||
              [row.userId].filter((value): value is string => !!value),
          },
        })
        .open();
    }

    /**
     * 校验并规范化 Bot 名单目标；精确用户模式要求 QQ 号，保存后关闭弹窗并刷新列表。
     */
    async function submitPermission() {
      const { valid } = await permissionFormApi.validate();
      if (!valid) return;

      const values = await permissionFormApi.getValues<BotApi.PermissionBody>();
      const targetId = values.targetId?.trim();
      if (!targetId) {
        message.warning(`请填写${targetIdLabel.value}`);
        return;
      }
      if (
        isPreciseAvailable() &&
        values.preciseUser &&
        !values.userIds?.length
      ) {
        message.warning('请至少选择一个精确用户');
        return;
      }

      const payload: BotApi.PermissionBody = {
        ...values,
        preciseUser: (() => {
          if (isPreciseAvailable()) {
            return !!values.preciseUser;
          }
          return false;
        })(),
        targetId,
        targetType: activeTargetType.value,
        userId: '',
        userIds: (() => {
          if (isPreciseAvailable() && values.preciseUser) {
            return values.userIds;
          }
          return [];
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
            return updateBotPermission(activeKind.value, {
              ...payload,
              id: editingId.value,
            });
          }
          return createBotPermission(activeKind.value, payload);
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
      return getOptionLabel(botPermissionTargetOptions, value);
    }

    /**
     * 仅群和频道支持精确成员，QQ 号目标不展示会话成员字段。
     *
     * @returns 当前标签为群或频道时返回 true。
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

    return () => (
      <Page autoContentHeight>
        <AKtTable
          columns={visibleColumns.value}
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as PermissionTreeRow;
              if (row.children) {
                if (column.key === 'selfId')
                  return (
                    <strong>
                      {row.groupLabel}（{row.children.length}）
                    </strong>
                  );
                return <span />;
              }
              if (column.key === 'selfId') return '-';
              if (column.key === 'enabled') {
                const status = (() => {
                  if (row.enabled) {
                    return 'enabled';
                  }
                  return 'disabled';
                })();
                return (
                  <Tag color={getBotStatusColor(status)}>
                    {getBotStatusLabel(status)}
                  </Tag>
                );
              }
              if (column.key === 'targetType') {
                return getPermissionTargetLabel(
                  normalizePermissionTargetType(row.targetType),
                );
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
                  return (
                    (row.userIds || [row.userId].filter(Boolean)).join('、') ||
                    '-'
                  );
                }
                return '-';
              }
              return undefined;
            },
            headerControls: renderHeaderControls,
          }}
        />
        <PermissionModal title={modalTitle.value}>
          <p
            class="mb-3 text-sm text-muted-foreground"
            v-show={!!editOptions.data.value.notice}
          >
            {editOptions.data.value.notice}
          </p>
          <PermissionForm class="mx-2" />
        </PermissionModal>
      </Page>
    );
  },
});
