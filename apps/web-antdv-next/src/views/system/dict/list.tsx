import type { TableColumnType } from 'antdv-next';

import type { SystemDictApi } from '#/api/system/dict';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTablePageResult,
  KtTableRegisterApi,
  KtTableRowAction,
} from '#/components/kt-table';

import { defineComponent, nextTick, ref, watch } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Tag } from 'antdv-next';

import {
  deleteDict,
  getDictGroups,
  getDictList,
  toggleDictStatus,
} from '#/api/system/dict';
import { KtTable, useKtTable } from '#/components/kt-table';
import { clearDictCache } from '#/hooks/useDict';
import { $t } from '#/locales';

import {
  getStatusOptions,
  useGridFormSchema,
  useGroupFormSchema,
} from './data';
import Form from './modules/form.vue';

import './list.scss';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'SystemDictList',
  setup() {
    const [FormModal, formModalApi] = useVbenModal<{
      onSuccess?: () => void;
      title?: string;
    }>({
      connectedComponent: Form,
      destroyOnClose: true,
    });

    const statusOptions = getStatusOptions();
    const selectedDictCode = ref('');
    const itemTableRegistered = ref(false);

    const groupColumns: Array<TableColumnType<SystemDictApi.DictGroup>> = [
      {
        dataIndex: 'dictCode',
        key: 'dictCode',
        title: $t('system.dict.dictCode'),
      },
      {
        align: 'right',
        dataIndex: 'itemCount',
        key: 'itemCount',
        title: '项数',
        width: 88,
      },
    ];

    const columns: Array<TableColumnType<SystemDictApi.DictItem>> = [
      {
        dataIndex: 'dictCode',
        fixed: 'left',
        key: 'dictCode',
        title: $t('system.dict.dictCode'),
        width: 220,
      },
      {
        dataIndex: 'label',
        key: 'label',
        title: $t('system.dict.label'),
        width: 180,
      },
      {
        dataIndex: 'value',
        key: 'value',
        title: $t('system.dict.value'),
        width: 180,
      },
      {
        dataIndex: 'childrenCode',
        key: 'childrenCode',
        title: $t('system.dict.childrenCode'),
        width: 180,
      },
      {
        align: 'center',
        dataIndex: 'sort',
        key: 'sort',
        title: $t('system.dict.sort'),
        width: 100,
      },
      {
        align: 'center',
        dataIndex: 'status',
        key: 'status',
        title: $t('system.dict.status'),
        width: 100,
      },
      {
        dataIndex: 'updateTime',
        key: 'updateTime',
        title: $t('system.dict.updateTime'),
        width: 200,
      },
    ];

    const groupApi: KtTableApi<SystemDictApi.DictGroup> = {
      list: async (params) => await getDictGroups(params),
    };

    const api: KtTableApi<SystemDictApi.DictItem> = {
      list: async (params) => {
        if (!selectedDictCode.value) {
          return {
            items: [],
            total: 0,
          };
        }

        return await getDictList({
          ...params,
          dictCode: selectedDictCode.value,
        });
      },
    };

    const buttons: Array<KtTableButton<SystemDictApi.DictItem>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: $t('ui.actionTitle.create', [$t('system.dict.name')]),
        onClick: onCreate,
        permissionCodes: ['System:Dict:Create'],
        type: 'primary',
      },
    ];

    const rowActions: Array<KtTableRowAction<SystemDictApi.DictItem>> = [
      {
        key: 'toggle',
        label: $t('system.dict.toggle'),
        onClick: onToggle,
        permissionCodes: ['System:Dict:Edit'],
      },
      {
        key: 'edit',
        label: $t('common.edit'),
        onClick: onEdit,
        permissionCodes: ['System:Dict:Edit'],
      },
      {
        confirm: (row) =>
          $t('system.dict.deleteConfirm', [row.dictCode, row.label]),
        danger: true,
        key: 'delete',
        label: $t('common.delete'),
        onClick: onDelete,
        permissionCodes: ['System:Dict:Delete'],
      },
    ];

    const [registerGroupTable, groupTableApi] =
      useKtTable<SystemDictApi.DictGroup>({
        activeRowKey: selectedDictCode.value,
        afterFetch: onGroupAfterFetch,
        api: groupApi,
        columns: groupColumns,
        formOptions: {
          formGrid: {
            actionMinWidth: 180,
            actionSpan: 8,
            contentSpan: 16,
            fieldSpan: 16,
          },
          schema: useGroupFormSchema(),
        },
        onRowClick: onGroupRowClick,
        pageSize: 20,
        rowKey: 'dictCode',
        showIndex: false,
        showSelection: false,
        showTableSetting: false,
        tableTitle: '字典编码',
      });

    const [registerItemTable, tableApi] = useKtTable<SystemDictApi.DictItem>({
      api,
      buttons,
      columns,
      formOptions: {
        schema: useGridFormSchema().filter(
          (item) => item.fieldName !== 'dictCode',
        ),
      },
      immediate: false,
      rowActions,
      rowKey: 'id',
      showPagination: true,
      tableTitle: getItemTableTitle(),
    });

    watch(selectedDictCode, (dictCode) => {
      groupTableApi.setProps({
        activeRowKey: dictCode,
      });
      tableApi.setProps({
        tableTitle: getItemTableTitle(),
      });
    });

    /**
     * 根据当前字典分组编码生成字典项表格标题，未选择分组时显示通用标题。
     *
     * @returns 包含当前字典编码的表格标题；未选择分组时返回“字典项”。
     */
    function getItemTableTitle() {
      if (selectedDictCode.value) {
        return `字典项：${selectedDictCode.value}`;
      }
      return '字典项';
    }

    /**
     * 从字典状态选项中查找与数值匹配的标签颜色；未知状态返回 undefined。
     *
     * @param status - 字典项的 0 或 1 状态，用于匹配禁用或启用选项。
     * @returns 与字典状态匹配的选项；未知状态回退为默认选项。
     */
    function getStatusOption(status: SystemDictApi.DictItem['status']) {
      return statusOptions.find((item) => item.value === status);
    }

    /**
     * 把数组或多种分页响应结构统一提取为字典分组行数组。
     *
     * @param result - 表格请求返回、需要归一为行数组的原始结果。
     * @returns 补齐分组字典键后的列表记录；非数组结果返回空数组。
     */
    function normalizeGroupRows(
      result:
        | KtTablePageResult<SystemDictApi.DictGroup>
        | SystemDictApi.DictGroup[],
    ) {
      if (Array.isArray(result)) return result;

      return result.items || result.list || result.records || [];
    }

    /**
     * 在字典分组加载后修正失效选择并刷新字典项表格，同时原样返回列表结果。
     *
     * @param result - 字典分组表格返回的原始结果；非数组值会归一为空数组。
     * @returns 表格原始加载结果，供 KtTable 继续完成列表写入。
     */
    async function onGroupAfterFetch(
      result:
        | KtTablePageResult<SystemDictApi.DictGroup>
        | SystemDictApi.DictGroup[],
    ) {
      const rows = normalizeGroupRows(result);
      const selectedExists = rows.some(
        (item) => item.dictCode === selectedDictCode.value,
      );
      if (!selectedExists) {
        selectedDictCode.value = rows[0]?.dictCode || '';
      }

      await reloadItemTable();
      return result;
    }

    /**
     * 切换当前字典分组并刷新其字典项；重复点击已选分组时不发请求。
     *
     * @param row - 用户选中的字典分组，用于切换右侧字典项列表。
     */
    async function onGroupRowClick(row: SystemDictApi.DictGroup) {
      if (selectedDictCode.value === row.dictCode) return;

      selectedDictCode.value = row.dictCode;
      await reloadItemTable();
    }

    /**
     * 保存字典项表格 API、标记注册完成，并触发首次字典项加载。
     *
     * @param registerApi - 由表单组件注册、供组合式函数保存的 API 实例。
     */
    function onItemTableRegister(
      registerApi: KtTableRegisterApi<SystemDictApi.DictItem>,
    ) {
      registerItemTable(registerApi);
      itemTableRegistered.value = true;
      void reloadItemTable();
    }

    /**
     * 按当前字典分组重新加载字典项表格，保持主从列表数据一致。
     */
    async function reloadItemTable() {
      if (!itemTableRegistered.value) return;

      await nextTick();
      await tableApi.search();
    }

    /**
     * 打开字典新建弹窗，并在已选择分组时预填其字典编码。
     */
    function onCreate() {
      formModalApi
        .setData(
          (() => {
            if (selectedDictCode.value) {
              return {
                dictCode: selectedDictCode.value,
              };
            }
            return undefined;
          })(),
        )
        .open();
    }

    /**
     * 将选中字典项写入弹窗上下文并打开编辑表单。
     *
     * @param row - 要加载到字典项编辑抽屉的记录。
     */
    function onEdit(row: SystemDictApi.DictItem) {
      formModalApi.setData(row).open();
    }

    /**
     * 切换字典启停状态、清除对应字典缓存并刷新列表。
     *
     * @param row - 要切换启用状态的字典记录。
     * @param context - 状态切换完成后用于重新加载列表的 KtTable 行操作上下文。
     */
    async function onToggle(
      row: SystemDictApi.DictItem,
      context: KtTableContext<SystemDictApi.DictItem>,
    ) {
      const nextStatus = (() => {
        if (row.status === 1) {
          return 0;
        }
        return 1;
      })();
      await toggleDictStatus(row.id, nextStatus);
      clearDictCache(row.dictCode);
      message.success(
        (() => {
          if (nextStatus === 1) {
            return $t('system.dict.enableSuccess');
          }
          return $t('system.dict.disableSuccess');
        })(),
      );
      await context.reload();
    }

    /**
     * 删除选中字典、清除对应缓存，并刷新字典项与分组表格。
     *
     * @param row - 要删除并清除缓存的字典记录。
     * @param context - 删除后优先用于重新加载字典项的 KtTable 上下文；缺省时使用当前表格 API。
     */
    async function onDelete(
      row: SystemDictApi.DictItem,
      context?: KtTableContext<SystemDictApi.DictItem>,
    ) {
      const hideLoading = message.loading({
        content: $t('ui.actionMessage.deleting', [row.label]),
        duration: 0,
        key: 'action_process_msg',
      });

      try {
        await deleteDict(row.id);
        clearDictCache(row.dictCode);
        message.success({
          content: $t('ui.actionMessage.deleteSuccess', [row.label]),
          key: 'action_process_msg',
        });
        await (context || tableApi).reload();
        await groupTableApi.reload();
      } catch {
        hideLoading();
      }
    }

    /**
     * 依次刷新字典分组和当前分组的字典项列表。
     */
    async function onRefresh() {
      await groupTableApi.reload();
      await tableApi.reload();
    }

    return () => (
      <Page autoContentHeight>
        <FormModal onSuccess={onRefresh} />
        <div class="dict-page">
          <section class="dict-page__groups">
            <AKtTable onRegister={registerGroupTable} />
          </section>
          <section class="dict-page__items">
            <AKtTable
              onRegister={onItemTableRegister}
              v-slots={{
                bodyCell: ({ column, record }: any) => {
                  const row = record as SystemDictApi.DictItem;
                  if (column.key === 'childrenCode') {
                    return row.childrenCode || '-';
                  }
                  if (column.key === 'status') {
                    return (
                      <Tag color={getStatusOption(row.status)?.color}>
                        {getStatusOption(row.status)?.label || row.status}
                      </Tag>
                    );
                  }
                  return undefined;
                },
              }}
            />
          </section>
        </div>
      </Page>
    );
  },
});
