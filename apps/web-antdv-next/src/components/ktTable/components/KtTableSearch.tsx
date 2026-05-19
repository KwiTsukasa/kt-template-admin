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
  /**
   * 初始化搜索区域的展开/收起动画状态。
   *
   * @param props 搜索区显示状态和收起状态。
   * @param emit Vue setup context。
   * @param emit.emit 搜索动画开始和结束事件发送器。
   * @param emit.slots 搜索表单和操作按钮插槽。
   */
  setup(props, { emit, slots }) {
    const shellRef = ref<HTMLElement | null>(null);
    const contentRef = ref<HTMLElement | null>(null);
    const shellHeight = ref<number>();
    const transitioning = ref(false);
    let initialized = false;
    let resizeObserver: ResizeObserver | undefined;
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
     * 读取搜索内容区域的真实高度。
     */
    function readContentHeight() {
      const content = contentRef.value;
      return content ? Math.ceil(content.getBoundingClientRect().height) : 0;
    }

    /**
     * 读取搜索外壳当前可见高度。
     */
    function readShellHeight() {
      const shell = shellRef.value;
      return shell ? Math.ceil(shell.getBoundingClientRect().height) : 0;
    }

    /**
     * 清理搜索动画兜底计时器。
     */
    function clearTransitionTimer() {
      if (transitionTimer) {
        window.clearTimeout(transitionTimer);
        transitionTimer = undefined;
      }
    }

    /**
     * 清理搜索动画 requestAnimationFrame。
     */
    function clearAnimationFrame() {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = undefined;
      }
    }

    /**
     * 结束搜索区域高度动画并通知父级恢复布局计算。
     */
    function endTransition() {
      if (!transitioning.value && shellHeight.value === undefined) return;

      clearTransitionTimer();
      clearAnimationFrame();
      transitioning.value = false;
      shellHeight.value = undefined;
      emit('transitionEnd');
    }

    /**
     * 开始动画前锁定当前高度，避免高度切换时直接跳变。
     */
    function prepareTransition() {
      const shell = shellRef.value;
      if (!shell) return false;

      const currentHeight = readShellHeight();
      if (!initialized) {
        initialized = true;
        return false;
      }

      clearAnimationFrame();
      clearTransitionTimer();

      transitioning.value = false;
      shellHeight.value = currentHeight;
      emit('transitionStart');

      return true;
    }

    /**
     * 将搜索区域从当前高度过渡到下一状态高度。
     */
    async function animateToNextHeight() {
      if (!prepareTransition()) return;

      await nextTick();
      await nextTick();

      const shell = shellRef.value;
      const currentHeight = shellHeight.value ?? readShellHeight();
      const targetHeight = readContentHeight();
      if (!shell || Math.abs(currentHeight - targetHeight) <= 1) {
        endTransition();
        return;
      }

      transitioning.value = true;
      await nextTick();

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = undefined;
        shellHeight.value = targetHeight;
        transitionTimer = window.setTimeout(
          endTransition,
          SEARCH_TRANSITION_DURATION + 80,
        );
      });
    }

    /**
     * 内容尺寸变化后同步高度状态。
     */
    function syncContentHeight() {
      if (
        !initialized ||
        transitioning.value ||
        shellHeight.value !== undefined
      ) {
        return;
      }

      shellHeight.value = undefined;
    }

    onMounted(() => {
      if (contentRef.value) {
        resizeObserver = new ResizeObserver(syncContentHeight);
        resizeObserver.observe(contentRef.value);
      }
      initialized = true;
    });

    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      clearTransitionTimer();
      clearAnimationFrame();
    });

    watch(
      () => props.collapsed,
      () => {
        void animateToNextHeight();
      },
      {
        flush: 'pre',
      },
    );

    return () =>
      props.visible ? (
        <div class="kt-table__search" style={gridStyle.value}>
          <div
            class={[
              'kt-table__search-content-shell',
              transitioning.value
                ? 'kt-table__search-content-shell--transitioning'
                : '',
            ]}
            onTransitionend={(event: TransitionEvent) => {
              if (
                event.currentTarget === event.target &&
                event.propertyName === 'height'
              ) {
                endTransition();
              }
            }}
            ref={shellRef}
            style={{
              height:
                shellHeight.value === undefined
                  ? undefined
                  : `${shellHeight.value}px`,
            }}
          >
            <div class="kt-table__search-content" ref={contentRef}>
              <div class="kt-table__search-form">{slots.form?.()}</div>
              <div class="kt-table__search-actions">{slots.actions?.()}</div>
            </div>
          </div>
          <div class="kt-table__search-split" />
        </div>
      ) : null;
  },
});
