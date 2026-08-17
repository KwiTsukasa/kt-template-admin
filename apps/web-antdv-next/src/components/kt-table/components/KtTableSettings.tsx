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
     * 根据复选框状态更新指定业务列显隐，并保留系统列可见。
     *
     * @param key - 列设置面板中目标列的稳定键。
     * @param checked - 列复选框状态；true 保留该列，false 将其隐藏。
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
        (() => {
          if (props.visibleColumnKeys.includes(key)) {
            return [...props.visibleColumnKeys];
          }
          return [...props.visibleColumnKeys, key];
        })(),
      );
    }

    /**
     * 清空列拖拽的源列与目标列，并把默认插入位置恢复为目标列之前。
     */
    function clearColumnDragState() {
      draggingColumnKey.value = '';
      dragOverColumnKey.value = '';
      dragInsertPosition.value = 'before';
    }

    /**
     * 根据拖拽事件计算当前鼠标位于目标列项的上半区还是下半区。
     *
     * @param event - 列设置面板收到的原生拖拽事件。
     * @returns 指针在目标列上半区时为 `before`，下半区时为 `after`。
     */
    function readDropPosition(event: DragEvent) {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();

      if (event.clientY > rect.top + rect.height / 2) {
        return 'after';
      }
      return 'before';
    }

    /**
     * 移动列设置中的列顺序，并把新的顺序通知给父级表格。
     *
     * @param sourceKey - 被拖拽列的稳定键。
     * @param targetKey - 列拖拽当前指向的目标列键。
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
        (() => {
          if (dragInsertPosition.value === 'after') {
            return nextTargetIndex + 1;
          }
          return nextTargetIndex;
        })(),
        0,
        movedKey,
      );
      emit('columnOrderKeysChange', nextKeys);
    }

    /**
     * 记录拖拽源列、初始化投放目标，并把列键写入原生拖拽数据。
     *
     * @param key - 本次开始拖拽的源列稳定键。
     * @param event - 列设置面板收到的原生拖拽事件。
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
     * 根据指针位于目标列的上半区或下半区更新投放提示。
     *
     * @param key - 列设置面板中目标列的稳定键。
     * @param event - 列设置面板收到的原生拖拽事件。
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
     * @param key - 列设置面板中目标列的稳定键。
     * @param event - 列设置面板收到的原生拖拽事件。
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
     * 根据宽松、默认、紧凑的顺序切换表格密度。
     */
    function cycleSize() {
      const currentIndex = SIZE_LIST.indexOf(props.size);
      const next = SIZE_LIST[(currentIndex + 1) % SIZE_LIST.length] || 'middle';
      emit('sizeChange', next);
    }

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
                        (() => {
                          if (draggingColumnKey.value === item.key) {
                            return 'kt-table__settings-column-item--dragging';
                          }
                          return '';
                        })(),
                        (() => {
                          if (
                            dragOverColumnKey.value === item.key &&
                            draggingColumnKey.value !== item.key
                          ) {
                            return `kt-table__settings-column-item--drop-${dragInsertPosition.value}`;
                          }
                          return '';
                        })(),
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
            (() => {
              if (props.setting.reload) {
                return renderIconButton(
                  'reload',
                  '刷新',
                  <RotateCw class="kt-table__toolbar-icon" />,
                  () => emit('reload'),
                );
              }
              return null;
            })(),
            (() => {
              if (props.setting.showSearch) {
                return renderIconButton(
                  'showSearch',
                  (() => {
                    if (props.searchVisible) {
                      return '隐藏搜索';
                    }
                    return '显示搜索';
                  })(),
                  (() => {
                    if (props.searchVisible) {
                      return <EyeOff class="kt-table__toolbar-icon" />;
                    }
                    return <Eye class="kt-table__toolbar-icon" />;
                  })(),
                  () => emit('searchVisibleChange', !props.searchVisible),
                );
              }
              return null;
            })(),
            (() => {
              if (props.setting.density) {
                return renderIconButton(
                  'density',
                  `密度：${SIZE_LABEL[props.size]}`,
                  <Menu class="kt-table__toolbar-icon" />,
                  cycleSize,
                );
              }
              return null;
            })(),
            renderColumnSetting(),
            (() => {
              if (props.setting.fullscreen) {
                return renderIconButton(
                  'fullscreen',
                  (() => {
                    if (props.fullscreen) {
                      return '退出全屏';
                    }
                    return '全屏';
                  })(),
                  (() => {
                    if (props.fullscreen) {
                      return <Minimize2 class="kt-table__toolbar-icon" />;
                    }
                    return <Fullscreen class="kt-table__toolbar-icon" />;
                  })(),
                  () => emit('fullscreenChange', !props.fullscreen),
                );
              }
              return null;
            })(),
          ],
        }}
      </ASpace>
    );
  },
});
