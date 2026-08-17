import type { TableColumnType } from 'antdv-next';

import type { Recordable } from '@vben/types';

import type { SystemRoleApi } from '#/api';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/kt-table';

import { defineComponent } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Modal, Switch, Tag } from 'antdv-next';

import { deleteRole, getRoleList, updateRole } from '#/api';
import { KtTable, useKtTable } from '#/components/kt-table';
import { $t } from '#/locales';

import { useGridFormSchema } from './data';
import Form from './modules/form.vue';

const AKtTable = KtTable as any;
const ASwitch = Switch as any;

export default defineComponent({
  name: 'SystemRoleList',
  setup() {
    const [FormDrawer, formDrawerApi] = useVbenDrawer<{
      onSuccess?: () => void;
      title?: string;
    }>({
      connectedComponent: Form,
      destroyOnClose: true,
    });

    const { hasAccessByCodes } = useAccess();

    /**
     * 检查当前访问码集合是否包含页面操作要求的权限码。
     *
     * @param code - 当前角色页操作要求的访问权限码。
     * @returns 当前访问码集合包含目标页面操作权限时返回 true，否则返回 false。
     */
    function hasPermission(code: string) {
      return hasAccessByCodes([code]);
    }

    const columns: Array<TableColumnType<SystemRoleApi.SystemRole>> = [
      {
        dataIndex: 'name',
        key: 'name',
        title: $t('system.role.roleName'),
        width: 200,
      },
      {
        dataIndex: 'id',
        key: 'id',
        title: $t('system.role.id'),
        width: 200,
      },
      {
        dataIndex: 'status',
        key: 'status',
        title: $t('system.role.status'),
        width: 100,
      },
      {
        dataIndex: 'remark',
        key: 'remark',
        title: $t('system.role.remark'),
        width: 180,
      },
      {
        dataIndex: 'createTime',
        key: 'createTime',
        title: $t('system.role.createTime'),
        width: 200,
      },
    ];

    const api: KtTableApi<SystemRoleApi.SystemRole> = {
      list: async (params) => {
        const { pageNo, pageSize, ...formValues } = params;

        return await getRoleList({
          page: pageNo,
          pageSize,
          ...formValues,
        });
      },
    };

    const buttons: Array<KtTableButton<SystemRoleApi.SystemRole>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: $t('ui.actionTitle.create', [$t('system.role.name')]),
        onClick: onCreate,
        permissionCodes: ['System:Role:Create'],
        type: 'primary',
      },
    ];

    const rowActions: Array<KtTableRowAction<SystemRoleApi.SystemRole>> = [
      {
        key: 'edit',
        label: $t('common.edit'),
        onClick: onEdit,
        permissionCodes: ['System:Role:Edit'],
      },
      {
        confirm: (row) => `确认删除「${row.name}」吗？`,
        danger: true,
        key: 'delete',
        label: $t('common.delete'),
        onClick: onDelete,
        permissionCodes: ['System:Role:Delete'],
      },
    ];

    const [registerTable, tableApi] = useKtTable<SystemRoleApi.SystemRole>({
      api,
      buttons,
      columns,
      formOptions: {
        fieldMappingTime: [['createTime', ['startTime', 'endTime']]],
        schema: useGridFormSchema(),
      },
      rowActions,
      tableTitle: $t('system.role.list'),
    });

    /**
     * 将 Antd 的 Modal.confirm 封装为 Promise，方便在异步函数中调用。
     *
     * @param content - 确认框向用户说明状态切换影响的正文。
     * @param title - 确认框标题。
     * @returns 用户点击确定时兑现、取消时为 false 的布尔 Promise。
     */
    function confirm(content: string, title: string) {
      return new Promise<boolean>((resolve, reject) => {
        Modal.confirm({
          content,
          /**
           * 用户取消角色分配时以“已取消”错误拒绝等待中的 Promise。
           */
          onCancel() {
            reject(new Error('已取消'));
          },
          /**
           * 通过户确认角色分配弹窗时兑现等待中的 Promise。
           */
          onOk() {
            resolve(true);
          },
          title,
        });
      });
    }

    /**
     * 请求用户确认角色状态变更，确认后更新后端；取消或失败时恢复开关状态。
     *
     * @param newStatus - 角色状态开关准备切换到的数值状态。
     * @param row - 状态即将切换的角色记录。
     * @returns 用户确认并完成后端更新时为 true；取消或失败时为 false。
     */
    async function onStatusChange(
      newStatus: number,
      row: SystemRoleApi.SystemRole,
    ) {
      const status: Recordable<string> = {
        0: '禁用',
        1: '启用',
      };
      try {
        await confirm(
          `你要将${row.name}的状态切换为 【${status[newStatus.toString()]}】 吗？`,
          '切换状态',
        );
        await updateRole(row.id, { status: newStatus });
        await tableApi.reload();
        return true;
      } catch {
        return false;
      }
    }

    /**
     * 把角色开关值转换为数字状态，仅在实际变化时提交状态更新。
     *
     * @param checked - 控件最新选中状态；true 表示开启，false 表示关闭。
     * @param row - 需要切换启用状态的角色记录。
     */
    async function onStatusSwitchChange(
      checked: boolean | number | string,
      row: SystemRoleApi.SystemRole,
    ) {
      const nextStatus = Number(checked) as SystemRoleApi.SystemRole['status'];
      if (nextStatus === row.status) return;

      await onStatusChange(nextStatus, row);
    }

    /**
     * 将选中角色写入抽屉上下文并打开编辑表单。
     *
     * @param row - 要加载到角色编辑抽屉的记录。
     */
    function onEdit(row: SystemRoleApi.SystemRole) {
      formDrawerApi.setData(row).open();
    }

    /**
     * 删除选中角色，成功后提示并刷新调用方或默认表格。
     *
     * @param row - 要删除的系统角色记录。
     * @param context - 删除后优先用于重新加载列表的 KtTable 上下文；缺省时使用当前表格 API。
     */
    async function onDelete(
      row: SystemRoleApi.SystemRole,
      context?: KtTableContext<SystemRoleApi.SystemRole>,
    ) {
      const hideLoading = message.loading({
        content: $t('ui.actionMessage.deleting', [row.name]),
        duration: 0,
        key: 'action_process_msg',
      });

      try {
        await deleteRole(row.id);
        message.success({
          content: $t('ui.actionMessage.deleteSuccess', [row.name]),
          key: 'action_process_msg',
        });
        await (context || tableApi).reload();
      } catch {
        hideLoading();
      }
    }

    /**
     * 触发角色表格重新请求当前数据。
     */
    function onRefresh() {
      void tableApi.reload();
    }

    /**
     * 通过空角色上下文打开角色新建抽屉。
     */
    function onCreate() {
      formDrawerApi.setData({}).open();
    }

    return () => (
      <Page autoContentHeight>
        <FormDrawer onSuccess={onRefresh} />
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as SystemRoleApi.SystemRole;
              if (column.key !== 'status') return undefined;
              if (row && hasPermission('System:Role:Edit')) {
                return (
                  <ASwitch
                    checked={row.status}
                    checkedValue={1}
                    onChange={(checked: boolean | number | string) =>
                      void onStatusSwitchChange(checked, row)
                    }
                    unCheckedValue={0}
                  />
                );
              }
              return (
                <Tag
                  color={(() => {
                    if (row.status === 1) {
                      return 'success';
                    }
                    return 'default';
                  })()}
                >
                  {(() => {
                    if (row.status === 1) {
                      return $t('common.enabled');
                    }
                    return $t('common.disabled');
                  })()}
                </Tag>
              );
            },
          }}
        />
      </Page>
    );
  },
});
