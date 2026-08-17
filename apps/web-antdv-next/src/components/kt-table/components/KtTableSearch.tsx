import type { PropType } from 'vue';

import type { KtTableFormGridOptions } from '../types';

import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import { KT_TABLE_DEFAULT_FORM_GRID } from '../config/constants';

const SEARCH_TRANSITION_DURATION = 220;

export default defineComponent({
  name: 'KtTableSearch',
  props: {
    collapsed: {
      default: false,
      type: Boolean,
    },
    visible: {
      default: true,
      type: Boolean,
    },
    formGrid: {
      default: () => KT_TABLE_DEFAULT_FORM_GRID,
      type: Object as PropType<KtTableFormGridOptions>,
    },
  },
  emits: ['transitionEnd', 'transitionStart'],
  setup(props, { emit, slots }) {
    const shellRef = ref<HTMLElement | null>(null);
    const contentRef = ref<HTMLElement | null>(null);
    const motionHeight = ref<string>();
    const transitioning = ref(false);
    let lastStableHeight = 0;
    let transitionTimer: number | undefined;
    let animationFrame: number | undefined;
    const gridStyle = computed(() => {
      const grid = props.formGrid;

      return {
        '--kt-table-form-action-fr': `${grid.actionSpan}fr`,
        '--kt-table-form-action-min-width': `${grid.actionMinWidth}px`,
        '--kt-table-form-action-span': String(grid.actionSpan),
        '--kt-table-form-content-fr': `${grid.contentSpan}fr`,
        '--kt-table-form-content-span': String(grid.contentSpan),
        '--kt-table-form-tablet-columns': String(grid.tabletColumns),
        '--kt-table-form-total-span': String(grid.totalSpan),
      };
    });

    /**
     * 测量搜索内容元素的边界高度，元素尚未挂载时按 0 处理。
     *
     * @returns 向上取整后的内容边界高度；元素尚未挂载时为 0。
     */
    function readContentHeight() {
      const content = contentRef.value;
      if (content) {
        return Math.ceil(content.getBoundingClientRect().height);
      }
      return 0;
    }

    /**
     * 从搜索区外壳元素读取当前可见高度；未挂载时返回 0。
     *
     * @returns 搜索外壳当前边界高度；未挂载时为 0。
     */
    function readShellHeight() {
      const shell = shellRef.value;
      if (shell) {
        return Math.ceil(shell.getBoundingClientRect().height);
      }
      return 0;
    }

    /**
     * 将搜索区稳定状态下的高度，下一次展开/收起时作为动画起点。
     */
    function rememberStableHeight() {
      lastStableHeight = readContentHeight() || readShellHeight();
    }

    /**
     * 当搜索区动画结束或重新开始时清除旧兜底计时器。
     */
    function clearTransitionTimer() {
      if (!transitionTimer) return;

      window.clearTimeout(transitionTimer);
      transitionTimer = undefined;
    }

    /**
     * 当搜索区动画结束或组件卸载时取消尚未执行的动画帧。
     */
    function clearAnimationFrame() {
      if (!animationFrame) return;

      window.cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
    }

    /**
     * 结束搜索区域高度动画并通知父级恢复表格布局监听。
     */
    function finishTransition() {
      if (!transitioning.value && motionHeight.value === undefined) return;

      clearTransitionTimer();
      clearAnimationFrame();
      rememberStableHeight();
      transitioning.value = false;
      motionHeight.value = undefined;
      emit('transitionEnd');
    }

    /**
     * 开始动画前锁定上一个稳定高度，避免 auto 尺寸直接跳变。
     *
     * @returns 成功锁定动画起始高度时为 true；外壳未挂载时为 false。
     */
    function prepareTransition() {
      const shell = shellRef.value;
      if (!shell) return false;

      clearAnimationFrame();
      clearTransitionTimer();
      motionHeight.value = `${lastStableHeight || readShellHeight()}px`;
      transitioning.value = true;
      emit('transitionStart');

      return true;
    }

    /**
     * 在同一个表单实例上执行高度过渡，避免重建表单导致值丢失。
     */
    async function animateToNextHeight() {
      if (!prepareTransition()) return;

      await nextTick();
      await nextTick();

      const shell = shellRef.value;
      const currentHeight = Number.parseFloat(motionHeight.value || '0');
      const targetHeight = readContentHeight();
      if (!shell || Math.abs(currentHeight - targetHeight) <= 1) {
        finishTransition();
        return;
      }

      // 强制浏览器提交起点高度后再写入终点高度，确保高度过渡真正触发。
      void shell.offsetHeight;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = undefined;
        motionHeight.value = `${targetHeight}px`;
        transitionTimer = window.setTimeout(
          finishTransition,
          SEARCH_TRANSITION_DURATION + 80,
        );
      });
    }

    watch(
      () => props.collapsed,
      () => {
        void animateToNextHeight();
      },
      {
        flush: 'post',
      },
    );

    onMounted(() => {
      nextTick(() => {
        rememberStableHeight();
      });
    });

    onBeforeUnmount(() => {
      clearTransitionTimer();
      clearAnimationFrame();
    });

    return () => {
      if (props.visible) {
        return (
          <div class="kt-table__search" style={gridStyle.value}>
            <div
              class={[
                'kt-table__search-content-shell',
                (() => {
                  if (transitioning.value) {
                    return 'kt-table__search-content-shell--transitioning';
                  }
                  return '';
                })(),
              ]}
              onTransitionend={(event: TransitionEvent) => {
                if (
                  event.currentTarget === event.target &&
                  event.propertyName === 'height'
                ) {
                  finishTransition();
                }
              }}
              ref={shellRef}
              style={{
                height: motionHeight.value,
              }}
            >
              <div class="kt-table__search-content-motion">
                <div class="kt-table__search-content" ref={contentRef}>
                  <div class="kt-table__search-form">{slots.form?.()}</div>
                  <div class="kt-table__search-actions">
                    {slots.actions?.()}
                  </div>
                </div>
              </div>
            </div>
            <div class="kt-table__search-split" />
          </div>
        );
      }
      return null;
    };
  },
});
