export function getPopupContainer(node?: HTMLElement): HTMLElement {
  return (
    node?.closest('form') ?? (node?.parentNode as HTMLElement) ?? document.body
  );
}
