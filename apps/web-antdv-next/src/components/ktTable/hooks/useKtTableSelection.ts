import type { KtTableProps, KtTableRecord } from '../types';

import { computed, ref } from 'vue';

type KtTableSelectionProps = Readonly<
  Pick<KtTableProps<KtTableRecord>, 'showSelection'>
>;

/**
 * 管理 KtTable 行选择状态。
 *
 * @param props 表格选择列相关配置。
 */
export function useKtTableSelection(props: KtTableSelectionProps) {
  const selectedRowKeys = ref<Array<number | string>>([]);
  const selectedRows = ref<KtTableRecord[]>([]);

  const rowSelection = computed(() =>
    props.showSelection
      ? {
          onChange: (
            keys: Array<number | string>,
            tableRows: KtTableRecord[],
          ) => {
            selectedRowKeys.value = keys;
            selectedRows.value = tableRows;
          },
          selectedRowKeys: selectedRowKeys.value,
        }
      : undefined,
  );

  /**
   * 清空当前选中的行 key 和行数据。
   */
  function clearSelection() {
    selectedRowKeys.value = [];
    selectedRows.value = [];
  }

  return {
    clearSelection,
    rowSelection,
    selectedRowKeys,
    selectedRows,
  };
}
