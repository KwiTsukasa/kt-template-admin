import type { KtTableProps, KtTableRecord } from '../types';

import { computed, ref } from 'vue';

type KtTableSelectionProps = Readonly<
  Pick<KtTableProps<KtTableRecord>, 'showSelection'>
>;

/**
 * 通过受控或内部状态维护选中行键与记录，并提供清空方法。
 *
 * @param props - 行键解析、选择配置与数据源引用。
 * @returns 选中行键、选中记录、Antdv rowSelection 配置和清空方法。
 */
export function useKtTableSelection(props: KtTableSelectionProps) {
  const selectedRowKeys = ref<Array<number | string>>([]);
  const selectedRows = ref<KtTableRecord[]>([]);

  const rowSelection = computed(() => {
    if (props.showSelection) {
      return {
        onChange: (
          keys: Array<number | string>,
          tableRows: KtTableRecord[],
        ) => {
          selectedRowKeys.value = keys;
          selectedRows.value = tableRows;
        },
        selectedRowKeys: selectedRowKeys.value,
      };
    }
    return undefined;
  });

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
