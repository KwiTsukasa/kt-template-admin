import type { TableColumnType } from 'antdv-next';

import type { SystemDeptApi } from '#/api/system/dept';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/kt-table';

import { defineComponent } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Tag } from 'antdv-next';

import { deleteDept, getDeptList } from '#/api/system/dept';
import { KtTable, useKtTable } from '#/components/kt-table';
import { $t } from '#/locales';

import Form from './modules/form.vue';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'SystemDeptList',
  setup() {
    const [FormModal, formModalApi] = useVbenModal<{
      onSuccess?: () => void;
      title?: string;
    }>({
      connectedComponent: Form,
      destroyOnClose: true,
    });

    const columns: Array<TableColumnType<SystemDeptApi.SystemDept>> = [
      {
        dataIndex: 'name',
        fixed: 'left',
        key: 'name',
        title: $t('system.dept.deptName'),
        width: 180,
      },
      {
        align: 'center',
        dataIndex: 'status',
        key: 'status',
        title: $t('system.dept.status'),
        width: 100,
      },
      {
        dataIndex: 'createTime',
        key: 'createTime',
        title: $t('system.dept.createTime'),
        width: 180,
      },
      {
        dataIndex: 'remark',
        key: 'remark',
        title: $t('system.dept.remark'),
        width: 260,
      },
    ];

    const api: KtTableApi<SystemDeptApi.SystemDept> = {
      list: async () => await getDeptList(),
    };

    const buttons: Array<KtTableButton<SystemDeptApi.SystemDept>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: $t('ui.actionTitle.create', [$t('system.dept.name')]),
        onClick: onCreate,
        permissionCodes: ['System:Dept:Create'],
        type: 'primary',
      },
    ];

    const rowActions: Array<KtTableRowAction<SystemDeptApi.SystemDept>> = [
      {
        key: 'append',
        label: '新增下级',
        onClick: onAppend,
        permissionCodes: ['System:Dept:Create'],
      },
      {
        key: 'edit',
        label: $t('common.edit'),
        onClick: onEdit,
        permissionCodes: ['System:Dept:Edit'],
      },
      {
        confirm: (row) => `确认删除「${row.name}」吗？`,
        danger: true,
        disabled: (row) => !!row.children?.length,
        key: 'delete',
        label: $t('common.delete'),
        onClick: onDelete,
        permissionCodes: ['System:Dept:Delete'],
      },
    ];

    const [registerTable, tableApi] = useKtTable<SystemDeptApi.SystemDept>({
      api,
      buttons,
      columns,
      rowActions,
      showDefaultButtons: false,
      showFooter: false,
      showPagination: false,
      tableTitle: '部门列表',
    });

    /**
     * 将选中部门写入弹窗上下文并打开编辑表单。
     *
     * @param row - 要加载到部门编辑抽屉的部门记录。
     */
    function onEdit(row: SystemDeptApi.SystemDept) {
      formModalApi.setData(row).open();
    }

    /**
     * 把选中部门作为父级上下文并打开新增部门表单。
     *
     * @param row - 作为新部门父级的现有部门记录。
     */
    function onAppend(row: SystemDeptApi.SystemDept) {
      formModalApi.setData({ pid: row.id }).open();
    }

    /**
     * 清空部门弹窗上下文并打开顶级部门新建表单。
     */
    function onCreate() {
      formModalApi.setData(null).open();
    }

    /**
     * 删除选中部门，成功后提示并刷新调用方或默认表格。
     *
     * @param row - 要删除的部门记录。
     * @param context - 删除后优先用于重新加载列表的 KtTable 上下文；缺省时使用当前表格 API。
     */
    async function onDelete(
      row: SystemDeptApi.SystemDept,
      context?: KtTableContext<SystemDeptApi.SystemDept>,
    ) {
      const hideLoading = message.loading({
        content: $t('ui.actionMessage.deleting', [row.name]),
        duration: 0,
        key: 'action_process_msg',
      });

      try {
        await deleteDept(row.id);
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
     * 触发部门表格重新请求当前查询条件下的数据。
     */
    function refreshTable() {
      void tableApi.reload();
    }

    return () => (
      <Page autoContentHeight>
        <FormModal onSuccess={refreshTable} />
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as SystemDeptApi.SystemDept;
              if (column.key !== 'status') return undefined;
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
