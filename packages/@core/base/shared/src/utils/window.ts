interface OpenWindowOptions {
  noopener?: boolean;
  noreferrer?: boolean;
  target?: '_blank' | '_parent' | '_self' | '_top' | string;
}

/**
 * 通过 window.open 使用指定 target 与窗口特性打开 URL。
 *
 * @param url - 要交给 window.open 的完整地址。
 * @param options - 新窗口的 target 与 window.open 特性字符串；未传入时使用 `{}`。
 */
function openWindow(url: string, options: OpenWindowOptions = {}): void {
  // 解构并设置默认值
  const { noopener = true, noreferrer = true, target = '_blank' } = options;

  // 基于选项创建特性字符串
  const features = [noopener && 'noopener=yes', noreferrer && 'noreferrer=yes']
    .filter(Boolean)
    .join(',');

  // 打开窗口
  window.open(url, target, features);
}

/**
 * 根据路由器解析结果在新窗口打开站内路径。
 *
 * @param path - 要结合当前 origin 与 hash 模式生成窗口地址的站内路径。
 */
function openRouteInNewWindow(path: string) {
  const { hash, origin } = location;
  const fullPath = (() => {
    if (path.startsWith('/')) {
      return path;
    }
    return `/${path}`;
  })();
  const url = `${origin}${(() => {
    if (hash && !fullPath.startsWith('/#')) {
      return '/#';
    }
    return '';
  })()}${fullPath}`;
  openWindow(url, { target: '_blank' });
}

export { openRouteInNewWindow, openWindow };
