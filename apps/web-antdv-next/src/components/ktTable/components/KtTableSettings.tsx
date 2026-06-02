import type { TableColumnType } from 'antdv-next';

import type { PropType, VNodeChild } from 'vue';

import type { KtTableRecord, KtTableSetting, KtTableSize } from '../types';

import { computed, defineComponent, ref } from 'vue';

import {
  Eye,
  EyeOff,
  Fullscreen,
  IconifyIcon,
  Menu,
  Minimize2,
  RotateCw,
  Settings,
} from '@vben/icons';

import { Button, Checkbox, Popover, Space, Tooltip } from 'antdv-next';

import { getColumnKey } from '../utils/index';

const AButton = Button as any;
const ACheckbox = Checkbox as any;
const APopover = Popover as any;
const ASpace = Space as any;
const ATooltip = Tooltip as any;

const SIZE_LABEL: Record<KtTableSize, string> = {
  large: '宽松',
  middle: '默认',
  small: '紧凑',
};

const SIZE_LIST: KtTableSize[] = ['small', 'middle', 'large'];

export default defineComponent({
  name: 'KtTableSettings',
  props: {
    columns: {
      default: () => [],
      type: Array as PropType<Array<TableColumnType<KtTableRecord>>>,
    },
    columnOrderKeys: {
      default: () => [],
      type: Array as PropType<string[]>,
    },
    fullscreen: {
      default: false,
      type: Boolean,
    },
    searchVisible: {
      default: true,
      type: Boolean,
    },
    setting: {
      default: () => ({}),
      type: Object as PropType<KtTableSetting>,
    },
    size: {
      default: 'middle',
      type: String as PropType<KtTableSize>,
    },
    visibleColumnKeys: {
      default: () => [],
      type: Array as PropType<string[]>,
    },
  },
  emits: [
    'columnOrderKeysChange',
    'fullscreenChange',
    'reload',
    'resetColumns',
    'searchVisibleChange',
    'sizeChange',
    'visibleColumnKeysChange',
  ],
  /**
   * 初始化 KtTable 设置栏内部状态和事件。
   *
   * @param props 组件入参，包含列配置、列顺序、可见列、密度、搜索显示和全屏状态。
   * @param emit Vue setup context。
   * @param emit.emit 组件事件发送器，用于把刷新、列设置、密度切换等操作同步给父级表格。
   */
  setup(props, { emit }) {
    const draggingColumnKey = ref('');
    const dragOverColumnKey = ref('');
    const dragInsertPosition = ref<'after' | 'before'>('before');

    const sourceColumnOptions = computed(() =>
      props.columns
        .map((column) => ({
          key: getColumnKey(column),
          title: String(column.title || getColumnKey(column)),
        }))
        .filter((item) => !!item.key),
    );
    const columnOptions = computed(() => {
      const optionMap = new Map(
        sourceColumnOptions.value.map((item) => [item.key, item]),
      );
      const orderedKeys = props.columnOrderKeys.filter((key) =>
        optionMap.has(key),
      );
      const restKeys = sourceColumnOptions.value
        .map((item) => item.key)
        .filter((key) => !orderedKeys.includes(key));

      return [...orderedKeys, ...restKeys]
        .map((key) => optionMap.get(key))
        .filter((item) => !!item);
    });

    /**
     * 切换单个列的显示状态。
     *
     * @param key 当前列的唯一标识，用于和表格列配置、可见列集合对应。
     * @param checked 当前列是否需要显示，true 表示加入可见列，false 表示从可见列中移除。
     */
    function toggleColumn(key: string, checked: boolean) {
      if (!checked) {
        emit(
          'visibleColumnKeysChange',
          props.visibleColumnKeys.filter((item) => item !== key),
        );
        return;
      }

      emit(
        'visibleColumnKeysChange',
        props.visibleColumnKeys.includes(key)
          ? [...props.visibleColumnKeys]
          : [...props.visibleColumnKeys, key],
      );
    }

    /**
     * 清空列拖拽过程中的源列、目标列和插入位置状态。
     */
    function clearColumnDragState() {
      draggingColumnKey.value = '';
      dragOverColumnKey.value = '';
      dragInsertPosition.value = 'before';
    }

    /**
     * 根据拖拽事件计算当前鼠标位于目标列项的上半区还是下半区。
     *
     * @param event 列设置列表项触发的拖拽事件，用于读取鼠标位置和目标元素尺寸。
     */
    function readDropPosition(event: DragEvent) {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();

      return event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
    }

    /**
     * 移动列设置中的列顺序，并把新的顺序通知给父级表格。
     *
     * @param sourceKey 被拖动列的唯一标识。
     * @param targetKey 当前投放目标列的唯一标识。
     */
    function moveColumn(sourceKey: string, targetKey: string) {
      if (!sourceKey || !targetKey || sourceKey === targetKey) return;

      const nextKeys = columnOptions.value.map((item) => item.key);
      const sourceIndex = nextKeys.indexOf(sourceKey);
      const targetIndex = nextKeys.indexOf(targetKey);
      if (sourceIndex === -1 || targetIndex === -1) return;

      const [movedKey] = nextKeys.splice(sourceIndex, 1);
      if (!movedKey) return;
      const nextTargetIndex = nextKeys.indexOf(targetKey);
      nextKeys.splice(
        dragInsertPosition.value === 'after'
          ? nextTargetIndex + 1
          : nextTargetIndex,
        0,
        movedKey,
      );
      emit('columnOrderKeysChange', nextKeys);
    }

    /**
     * 记录列拖拽开始时的源列信息。
     *
     * @param key 被拖动列的唯一标识。
     * @param event 原生拖拽开始事件，用于写入拖拽数据和设置拖拽效果。
     */
    function handleColumnDragStart(key: string, event: DragEvent) {
      draggingColumnKey.value = key;
      dragOverColumnKey.value = key;
      event.dataTransfer?.setData('text/plain', key);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
      }
    }

    /**
     * 处理拖拽经过目标列时的投放提示位置。
     *
     * @param key 当前经过的目标列唯一标识。
     * @param event 原生拖拽经过事件，用于阻止默认行为并计算投放方向。
     */
    function handleColumnDragOver(key: string, event: DragEvent) {
      if (!draggingColumnKey.value || draggingColumnKey.value === key) return;

      event.preventDefault();
      dragOverColumnKey.value = key;
      dragInsertPosition.value = readDropPosition(event);
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    }

    /**
     * 完成列投放并触发列顺序更新。
     *
     * @param key 当前投放目标列的唯一标识。
     * @param event 原生投放事件，用于读取拖拽源列并阻止浏览器默认投放行为。
     */
    function handleColumnDrop(key: string, event: DragEvent) {
      event.preventDefault();
      const sourceKey =
        draggingColumnKey.value ||
        event.dataTransfer?.getData('text/plain') ||
        '';

      moveColumn(sourceKey, key);
      clearColumnDragState();
    }

    /**
     * 按宽松、默认、紧凑的顺序切换表格密度。
     */
    function cycleSize() {
      const currentIndex = SIZE_LIST.indexOf(props.size);
      const next = SIZE_LIST[(currentIndex + 1) % SIZE_LIST.length] || 'middle';
      emit('sizeChange', next);
    }

    /**
     * 渲染设置栏中的图标按钮。
     *
     * @param key 按钮渲染 key，用于让 Vue 稳定追踪按钮节点。
     * @param title 按钮提示文案，同时作为无障碍名称。
     * @param icon 按钮图标节点。
     * @param onClick 点击按钮时执行的回调函数。
     */
    const renderIconButton = (
      key: string,
      title: string,
      icon: VNodeChild,
      onClick: () => void,
    ) => {
      return (
        <ATooltip title={title}>
          <AButton
            aria-label={title}
            class="kt-table__toolbar-button"
            key={key}
            onClick={onClick}
            shape="circle"
            type="text"
          >
            {icon}
          </AButton>
        </ATooltip>
      );
    };

    /**
     * 渲染列设置弹层和列设置触发按钮。
     */
    const renderColumnSetting = () => {
      if (!props.setting.column) return null;

      return (
        <APopover placement="bottomRight" trigger="click">
          {{
            content: () => (
              <div class="kt-table__settings-popover">
                <div class="kt-table__settings-popover-header">
                  <span class="kt-table__settings-popover-title">列设置</span>
                  <AButton
                    onClick={() => emit('resetColumns')}
                    size="small"
                    type="link"
                  >
                    重置
                  </AButton>
                </div>
                <div class="kt-table__settings-popover-list">
                  {columnOptions.value.map((item) => (
                    <div
                      class={[
                        'kt-table__settings-column-item',
                        draggingColumnKey.value === item.key
                          ? 'kt-table__settings-column-item--dragging'
                          : '',
                        dragOverColumnKey.value === item.key &&
                        draggingColumnKey.value !== item.key
                          ? `kt-table__settings-column-item--drop-${dragInsertPosition.value}`
                          : '',
                      ]}
                      key={item.key}
                      onDragend={clearColumnDragState}
                      onDragover={(event: DragEvent) =>
                        handleColumnDragOver(item.key, event)
                      }
                      onDrop={(event: DragEvent) =>
                        handleColumnDrop(item.key, event)
                      }
                    >
                      <button
                        aria-label={`拖拽排序：${item.title}`}
                        class="kt-table__settings-column-drag"
                        draggable
                        onClick={(event) => event.preventDefault()}
                        onDragstart={(event: DragEvent) =>
                          handleColumnDragStart(item.key, event)
                        }
                        type="button"
                      >
                        <IconifyIcon
                          class="kt-table__settings-column-drag-icon"
                          icon="lucide:grip-vertical"
                        />
                      </button>
                      <ACheckbox
                        checked={props.visibleColumnKeys.includes(item.key)}
                        class="kt-table__settings-column-checkbox"
                        onChange={(event: any) =>
                          toggleColumn(item.key, event.target.checked)
                        }
                      >
                        {item.title}
                      </ACheckbox>
                    </div>
                  ))}
                </div>
              </div>
            ),
            default: () =>
              renderIconButton(
                'column',
                '列设置',
                <Settings class="kt-table__toolbar-icon" />,
                () => {},
              ),
          }}
        </APopover>
      );
    };

    return () => (
      <ASpace size={4}>
        {{
          default: () => [
            props.setting.reload
              ? renderIconButton(
                  'reload',
                  '刷新',
                  <RotateCw class="kt-table__toolbar-icon" />,
                  () => emit('reload'),
                )
              : null,
            props.setting.showSearch
              ? renderIconButton(
                  'showSearch',
                  props.searchVisible ? '隐藏搜索' : '显示搜索',
                  props.searchVisible ? (
                    <EyeOff class="kt-table__toolbar-icon" />
                  ) : (
                    <Eye class="kt-table__toolbar-icon" />
                  ),
                  () => emit('searchVisibleChange', !props.searchVisible),
                )
              : null,
            props.setting.density
              ? renderIconButton(
                  'density',
                  `密度：${SIZE_LABEL[props.size]}`,
                  <Menu class="kt-table__toolbar-icon" />,
                  cycleSize,
                )
              : null,
            renderColumnSetting(),
            props.setting.fullscreen
              ? renderIconButton(
                  'fullscreen',
                  props.fullscreen ? '退出全屏' : '全屏',
                  props.fullscreen ? (
                    <Minimize2 class="kt-table__toolbar-icon" />
                  ) : (
                    <Fullscreen class="kt-table__toolbar-icon" />
                  ),
                  () => emit('fullscreenChange', !props.fullscreen),
                )
              : null,
          ],
        }}
      </ASpace>
    );
  },
});
