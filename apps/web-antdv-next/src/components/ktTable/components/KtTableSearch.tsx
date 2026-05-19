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
     * 记录搜索区稳定状态下的高度，下一次展开/收起时作为动画起点。
     */
    function rememberStableHeight() {
      lastStableHeight = readContentHeight() || readShellHeight();
    }

    /**
     * 清理搜索动画兜底计时器。
     */
    function clearTransitionTimer() {
      if (!transitionTimer) return;

      window.clearTimeout(transitionTimer);
      transitionTimer = undefined;
    }

    /**
     * 清理搜索动画 requestAnimationFrame。
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
                <div class="kt-table__search-actions">{slots.actions?.()}</div>
              </div>
            </div>
          </div>
          <div class="kt-table__search-split" />
        </div>
      ) : null;
  },
});
