import type { Arrayable, MaybeElementRef } from '@vueuse/core';

import type { Ref } from 'vue';

import { computed, effectScope, onUnmounted, ref, unref, watch } from 'vue';

import { isFunction } from '@vben/utils';

import { useElementHover } from '@vueuse/core';

interface HoverDelayOptions {
  enterDelay?: (() => number) | number;
  leaveDelay?: (() => number) | number;
}

const DEFAULT_LEAVE_DELAY = 500; // 鼠标离开延迟时间，默认为 500ms
const DEFAULT_ENTER_DELAY = 0; // 鼠标进入延迟时间，默认为 0（立即响应）

/**
 * 监测鼠标是否在元素内部，如果在元素内部则返回 true，否则返回 false
 *
 * @param refElement - 需要监听 pointerenter 与 pointerleave 的一个或多个元素引用。
 * @param delay - 鼠标进入与离开的延迟毫秒数，或分别配置两种延迟的对象；未传入时使用 `DEFAULT_LEAVE_DELAY`。
 * @returns 鼠标位于任一目标元素内时为 true 的只读响应式引用。
 */
export function useHoverToggle(
  refElement: Arrayable<MaybeElementRef> | Ref<HTMLElement[] | null>,
  delay: (() => number) | HoverDelayOptions | number = DEFAULT_LEAVE_DELAY,
) {
  // 兼容旧版本API
  const normalizedOptions: HoverDelayOptions = (() => {
    if (typeof delay === 'number' || isFunction(delay)) {
      return { enterDelay: DEFAULT_ENTER_DELAY, leaveDelay: delay };
    }
    return {
      enterDelay: DEFAULT_ENTER_DELAY,
      leaveDelay: DEFAULT_LEAVE_DELAY,
      ...delay,
    };
  })();

  const value = ref(false);
  const enterTimer = ref<ReturnType<typeof setTimeout> | undefined>();
  const leaveTimer = ref<ReturnType<typeof setTimeout> | undefined>();
  const hoverScopes = ref<ReturnType<typeof effectScope>[]>([]);

  // 使用计算属性包装 refElement，使其响应式变化
  const refs = computed(() => {
    const raw = unref(refElement);
    if (raw === null) return [];
    if (Array.isArray(raw)) {
      return raw;
    }
    return [raw];
  });
  // 存储所有 hover 状态
  const isHovers = ref<Array<Ref<boolean>>>([]);

  // 更新 hover 监听的函数
  /**
   * 停止旧元素悬停监听，并为当前元素引用重新建立独立响应式作用域。
   */
  function updateHovers() {
    // 停止并清理之前的作用域
    hoverScopes.value.forEach((scope) => scope.stop());
    hoverScopes.value = [];

    isHovers.value = refs.value.map((refEle) => {
      if (!refEle) {
        return ref(false);
      }
      const eleRef = computed(() => {
        const ele = unref(refEle);
        if (ele instanceof Element) {
          return ele;
        }
        return ele?.$el as Element;
      });

      // 为每个元素创建独立的作用域
      const scope = effectScope();
      const hoverRef = scope.run(() => useElementHover(eleRef)) || ref(false);
      hoverScopes.value.push(scope);

      return hoverRef;
    });
  }

  // 监听元素数量变化，避免过度执行
  const elementsCount = computed(() => {
    const raw = unref(refElement);
    if (raw === null) return 0;
    if (Array.isArray(raw)) {
      return raw.length;
    }
    return 1;
  });

  // 初始设置
  updateHovers();

  // 只在元素数量变化时重新设置监听器
  const stopWatcher = watch(elementsCount, updateHovers, { deep: false });

  const isOutsideAll = computed(() => isHovers.value.every((v) => !v.value));

  /**
   * 取消尚未触发的悬停进入与离开计时器，并清空计时器引用。
   */
  function clearTimers() {
    if (enterTimer.value) {
      clearTimeout(enterTimer.value);
      enterTimer.value = undefined;
    }
    if (leaveTimer.value) {
      clearTimeout(leaveTimer.value);
      leaveTimer.value = undefined;
    }
  }

  /**
   * 按进入或离开延迟更新悬停值，并在新事件到来前清除旧计时器。
   *
   * @param val - 目标悬停状态；true 使用进入延迟，false 使用离开延迟。
   */
  function setValueDelay(val: boolean) {
    clearTimers();

    if (val) {
      // 鼠标进入
      const enterDelay = normalizedOptions.enterDelay ?? DEFAULT_ENTER_DELAY;
      const delayTime = (() => {
        if (isFunction(enterDelay)) {
          return enterDelay();
        }
        return enterDelay;
      })();

      if (delayTime <= 0) {
        value.value = true;
      } else {
        enterTimer.value = setTimeout(() => {
          value.value = true;
          enterTimer.value = undefined;
        }, delayTime);
      }
    } else {
      // 鼠标离开
      const leaveDelay = normalizedOptions.leaveDelay ?? DEFAULT_LEAVE_DELAY;
      const delayTime = (() => {
        if (isFunction(leaveDelay)) {
          return leaveDelay();
        }
        return leaveDelay;
      })();

      if (delayTime <= 0) {
        value.value = false;
      } else {
        leaveTimer.value = setTimeout(() => {
          value.value = false;
          leaveTimer.value = undefined;
        }, delayTime);
      }
    }
  }

  const hoverWatcher = watch(
    isOutsideAll,
    (val) => {
      setValueDelay(!val);
    },
    { immediate: true },
  );

  const controller = {
    /**
     * 恢复已暂停的元素悬停监听，并让组件重新响应指针进入和离开。
     */
    enable() {
      hoverWatcher.resume();
    },
    /**
     * 暂停元素悬停监听并保留当前监听配置。
     */
    disable() {
      hoverWatcher.pause();
    },
  };

  onUnmounted(() => {
    clearTimers();
    // 停止监听器
    stopWatcher();
    // 停止所有剩余的作用域
    hoverScopes.value.forEach((scope) => scope.stop());
  });

  return [value, controller] as [typeof value, typeof controller];
}
