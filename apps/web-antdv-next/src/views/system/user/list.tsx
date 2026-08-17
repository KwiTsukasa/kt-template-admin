import type { TableColumnType } from 'antdv-next';
import type { DataNode } from 'antdv-next/dist/tree/index';

import type { SystemUserApi } from '#/api';
import type { SystemDeptApi } from '#/api/system/dept';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/kt-table';

import { computed, defineComponent, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Spin, Switch, Tag, Tree } from 'antdv-next';

import { deleteUser, getUserList, updateUser } from '#/api';
import { getDeptList } from '#/api/system/dept';
import { KtTable, useKtTable } from '#/components/kt-table';
import { $t } from '#/locales';

import { useGridFormSchema } from './data';
import Form from './modules/form.vue';

import './list.scss';

const AButton = Button as any;
const AKtTable = KtTable as any;
const ASpin = Spin as any;
const ASwitch = Switch as any;
const ATree = Tree as any;

export default defineComponent({
  name: 'SystemUserList',
  setup() {
    const [FormDrawer, formDrawerApi] = useVbenDrawer<{
      onSuccess?: () => void;
      title?: string;
    }>({
      connectedComponent: Form,
      destroyOnClose: true,
    });

    const { hasAccessByCodes } = useAccess();
    const deptTree = ref<SystemDeptApi.SystemDept[]>([]);
    const deptLoading = ref(false);
    const selectedDeptId = ref<string>();
    const selectedDeptKeys = computed(() => {
      if (selectedDeptId.value) {
        return [selectedDeptId.value];
      }
      return [];
    });
    const deptTreeData = computed<DataNode[]>(() =>
      mapDeptTree(deptTree.value),
    );

    /**
     * 检查当前访问码集合是否包含页面操作要求的权限码。
     *
     * @param code - 当前用户页操作要求的访问权限码。
     * @returns 当前访问码集合包含目标页面操作权限时返回 true，否则返回 false。
     */
    function hasPermission(code: string) {
      return hasAccessByCodes([code]);
    }

    const columns: Array<TableColumnType<SystemUserApi.SystemUser>> = [
      {
        dataIndex: 'username',
        fixed: 'left',
        key: 'username',
        title: $t('system.user.username'),
        width: 180,
      },
      {
        dataIndex: 'realName',
        key: 'realName',
        title: $t('system.user.realName'),
        width: 160,
      },
      {
        dataIndex: 'roleNames',
        key: 'roleNames',
        title: $t('system.user.roles'),
        width: 220,
      },
      {
        dataIndex: 'deptName',
        key: 'deptName',
        title: $t('system.user.dept'),
        width: 160,
      },
      {
        align: 'center',
        dataIndex: 'status',
        key: 'status',
        title: $t('system.user.status'),
        width: 100,
      },
      {
        dataIndex: 'homePath',
        key: 'homePath',
        title: $t('system.user.homePath'),
        width: 160,
      },
      {
        dataIndex: 'timezone',
        key: 'timezone',
        title: $t('system.user.timezone'),
        width: 180,
      },
      {
        dataIndex: 'createTime',
        key: 'createTime',
        title: $t('system.user.createTime'),
        width: 200,
      },
    ];

    const api: KtTableApi<SystemUserApi.SystemUser> = {
      list: async (params) => {
        const { pageNo, pageSize, ...formValues } = params;

        return await getUserList({
          page: pageNo,
          pageSize,
          ...(() => {
            if (selectedDeptId.value) {
              return { deptId: selectedDeptId.value };
            }
            return {};
          })(),
          ...formValues,
        });
      },
    };

    const buttons: Array<KtTableButton<SystemUserApi.SystemUser>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: $t('ui.actionTitle.create', [$t('system.user.name')]),
        onClick: onCreate,
        permissionCodes: ['System:User:Create'],
        type: 'primary',
      },
    ];

    const rowActions: Array<KtTableRowAction<SystemUserApi.SystemUser>> = [
      {
        key: 'edit',
        label: $t('common.edit'),
        onClick: onEdit,
        permissionCodes: ['System:User:Edit'],
      },
      {
        confirm: (row) => `确认删除「${row.username}」吗？`,
        danger: true,
        disabled: (row) => row.username === 'admin',
        key: 'delete',
        label: $t('common.delete'),
        onClick: onDelete,
        permissionCodes: ['System:User:Delete'],
      },
    ];

    const [registerTable, tableApi] = useKtTable<SystemUserApi.SystemUser>({
      api,
      buttons,
      columns,
      formOptions: {
        fieldMappingTime: [['createTime', ['startTime', 'endTime']]],
        schema: useGridFormSchema(),
      },
      rowActions,
      tableTitle: $t('system.user.list'),
    });

    onMounted(() => {
      void loadDeptTree();
    });

    /**
     * 加载部门层级数据并在请求期间维护部门选择器加载态。
     */
    async function loadDeptTree() {
      deptLoading.value = true;
      try {
        deptTree.value = await getDeptList();
      } finally {
        deptLoading.value = false;
      }
    }

    /**
     * 把部门树首个选中键写入用户筛选，清空选择时移除部门条件，并刷新列表。
     *
     * @param keys - 部门树当前选中的标识集合；清空时移除部门筛选。
     */
    function onDeptSelect(keys: Array<number | string>) {
      if (keys.length > 0) {
        selectedDeptId.value = String(keys[0]);
      } else {
        selectedDeptId.value = undefined;
      }
      void tableApi.reload();
    }

    /**
     * 清除用户列表的部门筛选并重新加载表格。
     */
    function clearDeptFilter() {
      selectedDeptId.value = undefined;
      void tableApi.reload();
    }

    /**
     * 递归把部门记录转换为树选择器使用的 key、title 和 children 结构。
     *
     * @param depts - 用于构建层级选项的部门记录集合。
     * @returns 可直接传给树选择器的部门节点数组；无部门时返回空数组。
     */
    function mapDeptTree(depts: SystemDeptApi.SystemDept[]): DataNode[] {
      return depts.map((dept) => ({
        children: (() => {
          if (dept.children) {
            return mapDeptTree(dept.children);
          }
          return undefined;
        })(),
        key: dept.id,
        title: dept.name,
      }));
    }

    /**
     * 把用户开关值转换为数字状态，仅在实际变化时更新用户并刷新列表。
     *
     * @param checked - 控件最新选中状态；true 表示开启，false 表示关闭。
     * @param row - 需要切换启用状态的系统用户。
     */
    async function onStatusSwitchChange(
      checked: boolean | number | string,
      row: SystemUserApi.SystemUser,
    ) {
      const nextStatus = Number(checked) as SystemUserApi.SystemUser['status'];
      if (nextStatus === row.status) return;

      await updateUser(row.id, { status: nextStatus });
      await tableApi.reload();
    }

    /**
     * 将选中用户写入抽屉上下文并打开编辑表单。
     *
     * @param row - 要加载到用户编辑抽屉的记录。
     */
    function onEdit(row: SystemUserApi.SystemUser) {
      formDrawerApi.setData(row).open();
    }

    /**
     * 删除选中用户，成功后提示并刷新调用方或默认表格。
     *
     * @param row - 要删除的系统用户记录。
     * @param context - 删除后优先用于重新加载列表的 KtTable 上下文；缺省时使用当前表格 API。
     */
    async function onDelete(
      row: SystemUserApi.SystemUser,
      context?: KtTableContext<SystemUserApi.SystemUser>,
    ) {
      const hideLoading = message.loading({
        content: $t('ui.actionMessage.deleting', [row.username]),
        duration: 0,
        key: 'action_process_msg',
      });

      try {
        await deleteUser(row.id);
        message.success({
          content: $t('ui.actionMessage.deleteSuccess', [row.username]),
          key: 'action_process_msg',
        });
        await (context || tableApi).reload();
      } catch {
        hideLoading();
      }
    }

    /**
     * 触发系统用户表格重新请求当前数据。
     */
    function onRefresh() {
      void tableApi.reload();
    }

    /**
     * 打开用户新建抽屉，并预填当前选中的部门标识。
     */
    function onCreate() {
      formDrawerApi.setData({ deptId: selectedDeptId.value }).open();
    }

    return () => (
      <Page autoContentHeight>
        <FormDrawer onSuccess={onRefresh} />
        <div class="system-user-page">
          <aside class="system-user-page__dept">
            <div class="system-user-page__dept-header">
              <span class="system-user-page__dept-title">
                {$t('system.user.deptTree')}
              </span>
              <AButton onClick={clearDeptFilter} size="small" type="link">
                {$t('system.user.allDept')}
              </AButton>
            </div>
            <ASpin spinning={deptLoading.value}>
              <ATree
                blockNode
                defaultExpandAll
                onSelect={(keys: Array<number | string>) => onDeptSelect(keys)}
                selectedKeys={selectedDeptKeys.value}
                treeData={deptTreeData.value}
              />
            </ASpin>
          </aside>
          <main class="system-user-page__table">
            <AKtTable
              onRegister={registerTable}
              v-slots={{
                bodyCell: ({ column, record }: any) => {
                  const row = record as SystemUserApi.SystemUser;
                  if (column.key === 'roleNames') {
                    return (
                      <div class="system-user-list__roles">
                        {(row.roleNames || []).map((roleName) => (
                          <Tag color="processing" key={roleName}>
                            {roleName}
                          </Tag>
                        ))}
                      </div>
                    );
                  }
                  if (column.key === 'deptName') {
                    return row.deptName || '-';
                  }
                  if (column.key === 'status') {
                    if (row && hasPermission('System:User:Edit')) {
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
                  }
                  return undefined;
                },
              }}
            />
          </main>
        </div>
      </Page>
    );
  },
});
