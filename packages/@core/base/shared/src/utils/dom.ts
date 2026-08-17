export interface VisibleDomRect {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

/**
 * 根据元素与视口交集计算可见矩形；元素缺失时返回全零矩形。
 *
 * @param element - 需要计算可见交集矩形的 DOM 元素；未挂载时允许为空。
 * @returns 元素与视口交集的 top、left、right、bottom、width、height；无元素时全为 0。
 */
export function getElementVisibleRect(
  element?: HTMLElement | null | undefined,
): VisibleDomRect {
  if (!element) {
    return {
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
    };
  }
  const rect = element.getBoundingClientRect();
  const viewHeight = Math.max(
    document.documentElement.clientHeight,
    window.innerHeight,
  );

  const top = Math.max(rect.top, 0);
  const bottom = Math.min(rect.bottom, viewHeight);

  const viewWidth = Math.max(
    document.documentElement.clientWidth,
    window.innerWidth,
  );

  const left = Math.max(rect.left, 0);
  const right = Math.min(rect.right, viewWidth);

  // 如果元素完全不可见，则返回一个空的矩形
  if (top >= viewHeight || bottom <= 0 || left >= viewWidth || right <= 0) {
    return {
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
    };
  }

  return {
    bottom,
    height: Math.max(0, bottom - top),
    left,
    right,
    top,
    width: Math.max(0, right - left),
  };
}

/**
 * 通过临时滚动容器测量浏览器滚动条宽度，并在测量后移除元素。
 *
 * @returns 浏览器滚动条占用的像素宽度；无法测量时为零。
 */
export function getScrollbarWidth() {
  const scrollDiv = document.createElement('div');

  scrollDiv.style.visibility = 'hidden';
  scrollDiv.style.overflow = 'scroll';
  scrollDiv.style.position = 'absolute';
  scrollDiv.style.top = '-9999px';

  document.body.append(scrollDiv);

  const innerDiv = document.createElement('div');
  scrollDiv.append(innerDiv);

  const scrollbarWidth = scrollDiv.offsetWidth - innerDiv.offsetWidth;

  scrollDiv.remove();
  return scrollbarWidth;
}

/**
 * 通过比较容器的可视宽度与内容宽度，判断横向标签栏是否需要滚动控件。
 *
 * @returns 内容宽度超过容器可视宽度时返回 true，否则返回 false。
 */
export function needsScrollbar() {
  const doc = document.documentElement;
  const body = document.body;

  // 检查 body 的 overflow-y 样式
  const overflowY = window.getComputedStyle(body).overflowY;

  // 如果明确设置了需要滚动条的样式
  if (overflowY === 'scroll' || overflowY === 'auto') {
    return doc.scrollHeight > window.innerHeight;
  }

  // 在其他情况下，根据 scrollHeight 和 innerHeight 比较判断
  return doc.scrollHeight > window.innerHeight;
}

/**
 * 通过派发窗口 resize 事件，通知依赖布局尺寸的组件重新计算。
 */
export function triggerWindowResize(): void {
  // 创建一个新的 resize 事件
  const resizeEvent = new Event('resize');

  // 触发 window 的 resize 事件
  window.dispatchEvent(resizeEvent);
}
