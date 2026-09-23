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

import { defineComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { useMediaQuery } from '@vueuse/core';
import { Button, message, Select, Tag } from 'antdv-next';

import {
  deleteDict,
  getDictCodeOptions,
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
const AButton = Button as any;
const ASelect = Select as any;

interface DictItemSnapshot extends SystemDictApi.PageResult<SystemDictApi.DictItem> {
  dictCode: string;
}

interface CodeLoadResult {
  loaded: boolean;
  selectionChanged: boolean;
}

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
    const requestedDictCode = ref('');
    const displayedDictCode = ref('');
    const compactGroups = useMediaQuery('(max-width: 1024px)');
    const codeOptions = ref<SystemDictApi.DictCodeOption[]>([]);
    const codesLoading = ref(false);
    const codesLoaded = ref(false);
    const codesError = ref('');
    const itemTableRegistered = ref(false);
    let itemLoadPending = false;
    let codesRequest: Promise<CodeLoadResult> | undefined;
    let codesRequestInvalidated = false;
    let preserveGroupSelectionOnMount = false;
    let disposed = false;

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
        const dictCode = requestedDictCode.value;
        if (!dictCode) {
          return {
            dictCode,
            items: [],
            total: 0,
          };
        }

        const page = await getDictList({
          ...params,
          dictCode,
        });
        return { ...page, dictCode };
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
        activeRowKey: displayedDictCode.value,
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
        hooks: [
          { name: 'dict-group-selection', onAfterFetch: onGroupAfterFetch },
        ],
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
        formGrid: {
          actionMinWidth: 160,
          actionSpan: 6,
          contentSpan: 18,
          fieldSpan: 6,
        },
        schema: useGridFormSchema().filter(
          (item) => item.fieldName !== 'dictCode',
        ),
      },
      hooks: [{ name: 'dict-item-identity', onAfterFetch: onItemAfterFetch }],
      immediate: false,
      rowActions,
      rowKey: 'id',
      showPagination: true,
      tableTitle: getItemTableTitle(),
    });

    watch(displayedDictCode, (dictCode) => {
      groupTableApi.setProps({
        activeRowKey: dictCode,
      });
      tableApi.setProps({
        tableTitle: getItemTableTitle(),
      });
    });

    watch(
      compactGroups,
      (compact, previous) => {
        if (compact) {
          if (codesLoaded.value || codesRequest) return;
          onLoadCodeOptions();
        } else if (previous && requestedDictCode.value) {
          preserveGroupSelectionOnMount = true;
        }
      },
      { immediate: true },
    );

    onBeforeUnmount(() => {
      disposed = true;
    });

    /**
     * 根据当前字典分组编码生成字典项表格标题，未选择分组时显示通用标题。
     *
     * @returns 包含当前字典编码的表格标题；未选择分组时返回“字典项”。
     */
    function getItemTableTitle() {
      if (displayedDictCode.value) {
        return `字典项：${displayedDictCode.value}`;
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
     * 只在分组表格采纳行后校正当前请求目标，并触发一次独立的字典项读取。
     * @param result - 已被分组表格采纳、用于校正选择的分页或数组行。
     */
    function onGroupAfterFetch(
      result:
        | KtTablePageResult<SystemDictApi.DictGroup>
        | SystemDictApi.DictGroup[],
    ) {
      if (preserveGroupSelectionOnMount) {
        preserveGroupSelectionOnMount = false;
        return;
      }
      const rows = normalizeGroupRows(result);
      const selectedExists = rows.some(
        (item) => item.dictCode === requestedDictCode.value,
      );
      if (!selectedExists) {
        requestedDictCode.value = rows[0]?.dictCode || '';
      }
      void reloadItemTable().catch(() => undefined);
    }

    /**
     * 仅在从表请求通过准入后提交编码，令标题与桌面高亮对应已显示的行。
     * @param result - 携带本轮请求编码的已采纳字典项分页快照。
     */
    function onItemAfterFetch(
      result:
        | KtTablePageResult<SystemDictApi.DictItem>
        | SystemDictApi.DictItem[],
    ) {
      if (Array.isArray(result)) return;
      displayedDictCode.value = (result as DictItemSnapshot).dictCode;
    }

    /**
     * 切换分组请求目标，已显示相同组才跳过，失败由字典项表格呈现供重试。
     * @param row - 用户点选的真实分组行。
     */
    function onGroupRowClick(row: SystemDictApi.DictGroup) {
      if (
        requestedDictCode.value === row.dictCode &&
        displayedDictCode.value === row.dictCode
      )
        return;
      requestedDictCode.value = row.dictCode;
      void reloadItemTable().catch(() => undefined);
    }

    /**
     * 保存从表命令接口，并在目录先于组件就绪时兑现一次排队读取。
     * @param registerApi - 表格实例暴露的请求与配置接口。
     */
    function onItemTableRegister(
      registerApi: KtTableRegisterApi<SystemDictApi.DictItem>,
    ) {
      registerItemTable(registerApi);
      itemTableRegistered.value = true;
      if (itemLoadPending) void reloadItemTable().catch(() => undefined);
    }

    /**
     * 按当前字典分组重新加载字典项表格，保持主从列表数据一致。
     */
    async function reloadItemTable() {
      if (!itemTableRegistered.value) {
        itemLoadPending = true;
        return;
      }

      itemLoadPending = false;
      await nextTick();
      await tableApi.search();
    }

    /**
     * 仅读取完整字典编码目录；失败保留旧选项，写后失效的旧请求不得覆盖新目录。
     * @returns 目录是否成功读取，以及本次目录是否实际校正了请求目标。
     */
    async function loadCodeOptions(): Promise<CodeLoadResult> {
      if (codesRequest) return codesRequest;
      codesRequestInvalidated = false;
      codesLoading.value = true;
      codesError.value = '';
      codesRequest = getDictCodeOptions()
        .then((options) => {
          if (disposed || !compactGroups.value || codesRequestInvalidated) {
            return { loaded: false, selectionChanged: false };
          }
          const previous = requestedDictCode.value;
          codeOptions.value = options;
          codesLoaded.value = true;
          if (!options.some((item) => item.value === requestedDictCode.value)) {
            requestedDictCode.value = options[0]?.value || '';
          }
          return {
            loaded: true,
            selectionChanged: requestedDictCode.value !== previous,
          };
        })
        .catch(() => {
          if (!disposed && !codesRequestInvalidated) {
            codesLoaded.value = false;
            codesError.value = '字典编码读取失败，请重试。';
          }
          return { loaded: false, selectionChanged: false };
        })
        .finally(() => {
          if (!disposed) codesLoading.value = false;
          codesRequest = undefined;
          codesRequestInvalidated = false;
        });
      return codesRequest;
    }

    /**
     * 首次进入窄屏或重试目录时，只在校正选择后读取对应字典项。
     */
    function onLoadCodeOptions() {
      void loadCodeOptions().then(({ loaded, selectionChanged }) => {
        if (loaded && compactGroups.value && selectionChanged)
          void reloadItemTable().catch(() => undefined);
      });
    }

    /**
     * 只接受完整目录中的真实编码，保留已显示分组直到新请求被采纳。
     * @param value - Antdv Select 返回的字典编码。
     */
    function onCodeChange(value: string) {
      if (!codeOptions.value.some((option) => option.value === value)) return;
      if (
        requestedDictCode.value === value &&
        displayedDictCode.value === value
      )
        return;
      requestedDictCode.value = value;
      void reloadItemTable().catch(() => undefined);
    }

    /**
     * 打开字典新建弹窗，仅以已成功显示的分组编码预填新记录。
     */
    function onCreate() {
      formModalApi
        .setData(
          (() => {
            if (displayedDictCode.value) {
              return {
                dictCode: displayedDictCode.value,
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
     * 删除选中字典并清缓存，再按当前视口刷新唯一目录与字典项。
     * @param row - 要删除并清除缓存的字典记录。
     */
    async function onDelete(row: SystemDictApi.DictItem) {
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
        await refreshDirectories();
      } catch {
        hideLoading();
      }
    }

    /**
     * 按当前布局刷新所需目录，并且只发一次字典项请求。
     */
    async function refreshDirectories() {
      if (compactGroups.value) {
        if (codesRequest) {
          codesRequestInvalidated = true;
          await codesRequest;
        }
        codesLoaded.value = false;
        await loadCodeOptions();
        await reloadItemTable();
        return;
      }
      codesLoaded.value = false;
      try {
        await groupTableApi.reload();
      } catch {
        await reloadItemTable();
      }
    }

    /**
     * 表单保存事件只消费已由目录或从表展示的失败，避免产生未处理拒绝。
     */
    function onRefresh() {
      void refreshDirectories().catch(() => undefined);
    }

    return () => (
      <Page autoContentHeight>
        <FormModal onSuccess={onRefresh} />
        <div class="dict-page">
          {compactGroups.value && (
            <section class="dict-page__selector">
              <label for="dict-code-select">字典编码</label>
              <ASelect
                id="dict-code-select"
                loading={codesLoading.value}
                onChange={onCodeChange}
                optionFilterProp="label"
                options={codeOptions.value}
                placeholder={codesError.value || '选择字典编码'}
                showSearch
                value={displayedDictCode.value || undefined}
              />
              {codesError.value && (
                <AButton onClick={onLoadCodeOptions} size="small">
                  重试
                </AButton>
              )}
              {codesError.value && (
                <span role="status">{codesError.value}</span>
              )}
              {codesLoaded.value && codeOptions.value.length === 0 && (
                <span role="status">暂无字典编码</span>
              )}
            </section>
          )}
          {!compactGroups.value && (
            <section class="dict-page__groups">
              <AKtTable onRegister={registerGroupTable} />
            </section>
          )}
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
