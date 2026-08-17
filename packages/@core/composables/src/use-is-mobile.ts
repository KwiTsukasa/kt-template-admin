import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

/**
 * 使用 Tailwind `md` 断点提供随视口变化的移动端判定。
 *
 * @returns 视口小于 Tailwind `md` 断点时为 true 的响应式判定。
 */
export function useIsMobile() {
  const breakpoints = useBreakpoints(breakpointsTailwind);
  const isMobile = breakpoints.smaller('md');
  return { isMobile };
}
