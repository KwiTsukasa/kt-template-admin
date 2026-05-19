import type { PropType } from 'vue';

import { defineComponent } from 'vue';

import { Pagination } from 'antdv-next';

const APagination = Pagination as any;

export default defineComponent({
  name: 'KtTableFooter',
  props: {
    current: {
      default: 1,
      type: Number,
    },
    pageSize: {
      default: 10,
      type: Number,
    },
    pageSizeOptions: {
      default: () => ['10', '20', '50', '100'],
      type: Array as PropType<string[]>,
    },
    selectedCount: {
      default: 0,
      type: Number,
    },
    showPagination: {
      default: true,
      type: Boolean,
    },
    showSelection: {
      default: false,
      type: Boolean,
    },
    total: {
      default: 0,
      type: Number,
    },
  },
  emits: ['pageChange'],
  /**
   * 初始化表格底部选择状态和分页区域。
   *
   * @param props 底部分页、选择数量和显示开关配置。
   * @param emit Vue setup context。
   * @param emit.emit 分页变化事件发送器。
   * @param emit.slots 底部左侧自定义内容插槽。
   */
  setup(props, { emit, slots }) {
    /**
     * 将 Antdv Pagination 的页码变化转成 KtTable 分页事件。
     *
     * @param current 当前页码。
     * @param pageSize 当前每页条数。
     */
    function handlePageChange(current: number, pageSize: number) {
      emit('pageChange', { current, pageSize });
    }

    return () => (
      <div class="kt-table__footer">
        <div class="kt-table__footer-settings">
          {props.showSelection ? (
            <span class="kt-table__footer-selection">
              {props.selectedCount > 0 ? (
                <>
                  已选中
                  <span class="kt-table__footer-selection-count">
                    {props.selectedCount}
                  </span>
                  条
                </>
              ) : (
                '选中激活'
              )}
            </span>
          ) : null}
          {slots.default?.()}
        </div>
        {props.showPagination ? (
          <APagination
            current={props.current}
            onChange={handlePageChange}
            pageSize={props.pageSize}
            pageSizeOptions={props.pageSizeOptions}
            showSizeChanger
            showTotal={(total: number) => `共 ${total} 条`}
            total={props.total}
          />
        ) : null}
      </div>
    );
  },
});
