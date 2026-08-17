/**
 * 优先返回触发元素所在容器，无法定位时回退到 document.body。
 *
 * @param node - 触发弹出层的 DOM 元素；可省略。
 * @returns 触发节点所在的弹出层容器；无法定位时为 document.body。
 */
export function getPopupContainer(node?: HTMLElement): HTMLElement {
  return (
    node?.closest('form') ?? (node?.parentNode as HTMLElement) ?? document.body
  );
}
