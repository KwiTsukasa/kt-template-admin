import { openWindow } from './window';

interface DownloadOptions<T = string> {
  fileName?: string;
  source: T;
  target?: string;
}

const DEFAULT_FILENAME = 'downloaded_file';

/**
 * 通过 URL 下载文件，支持跨域
 *
 * @throws source 不是非空 URL 字符串时抛出。
 */
export async function downloadFileFromUrl({
  fileName,
  source,
  target = '_blank',
}: DownloadOptions): Promise<void> {
  if (!source || typeof source !== 'string') {
    throw new Error('Invalid URL.');
  }

  const isChrome = window.navigator.userAgent.toLowerCase().includes('chrome');
  const isSafari = window.navigator.userAgent.toLowerCase().includes('safari');

  if (/iP/.test(window.navigator.userAgent)) {
    console.error('Your browser does not support download!');
    return;
  }

  if (isChrome || isSafari) {
    triggerDownload(source, resolveFileName(source, fileName));
    return;
  }
  if (!source.includes('?')) {
    source += '?download';
  }

  openWindow(source, { target });
}

/**
 * 将 Base64 数据转换为 Blob URL，并触发浏览器下载。
 *
 * @throws source 不是非空 Base64 字符串时抛出。
 */
export function downloadFileFromBase64({ fileName, source }: DownloadOptions) {
  if (!source || typeof source !== 'string') {
    throw new Error('Invalid Base64 data.');
  }

  const resolvedFileName = fileName || DEFAULT_FILENAME;
  triggerDownload(source, resolvedFileName);
}

/**
 * 通过图片 URL 下载图片文件
 */
export async function downloadFileFromImageUrl({
  fileName,
  source,
}: DownloadOptions) {
  const base64 = await urlToBase64(source);
  downloadFileFromBase64({ fileName, source: base64 });
}

/**
 * 为 Blob 创建临时 URL 并触发浏览器下载，随后延迟释放 URL。
 *
 * @throws source 不是 Blob 实例时抛出 TypeError。
 */
export function downloadFileFromBlob({
  fileName = DEFAULT_FILENAME,
  source,
}: DownloadOptions<Blob>): void {
  if (!(source instanceof Blob)) {
    throw new TypeError('Invalid Blob data.');
  }

  const url = URL.createObjectURL(source);
  triggerDownload(url, fileName);
}

/**
 * 将字符串或其他 BlobPart 包装为 Blob 后触发浏览器下载。
 */
export function downloadFileFromBlobPart({
  fileName = DEFAULT_FILENAME,
  source,
}: DownloadOptions<BlobPart>): void {
  // 如果 data 不是 Blob，则转换为 Blob
  const blob = (() => {
    if (source instanceof Blob) {
      return source;
    }
    return new Blob([source], { type: 'application/octet-stream' });
  })();

  // 创建对象 URL 并触发下载
  const url = URL.createObjectURL(blob);
  triggerDownload(url, fileName);
}

/**
 * 加载远程图片并通过画布转换为 Base64 数据地址。
 *
 * @param url - 要跨域加载并绘制到画布的图片地址。
 * @param mineType - 用于指定下载文件的 MIME 类型。
 * @returns 图片加载并绘制成功后的 Base64 数据地址。
 */
export function urlToBase64(url: string, mineType?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let canvas = document.createElement('CANVAS') as HTMLCanvasElement | null;
    const ctx = canvas?.getContext('2d');
    const img = new Image();
    img.crossOrigin = '';
    img.addEventListener('load', () => {
      if (!canvas || !ctx) {
        return reject(new Error('Failed to create canvas.'));
      }
      canvas.height = img.height;
      canvas.width = img.width;
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL(mineType || 'image/png');
      canvas = null;
      resolve(dataURL);
    });
    img.src = url;
  });
}

/**
 * 通过临时 `a` 元素触发目标地址下载，并按延迟释放 `Blob URL`。
 *
 * @param href - 浏览器下载链接要指向的 Blob URL 或资源地址。
 * @param fileName - 浏览器下载时建议使用的文件名；省略时沿用资源默认名称。
 * @param revokeDelay - 触发下载后延迟撤销 Blob URL 的毫秒数；未传入时使用 `100`。
 */
export function triggerDownload(
  href: string,
  fileName: string | undefined,
  revokeDelay: number = 100,
): void {
  const defaultFileName = 'downloaded_file';
  const finalFileName = fileName || defaultFileName;

  const link = document.createElement('a');
  link.href = href;
  link.download = finalFileName;
  link.style.display = 'none';

  if (link.download === undefined) {
    link.setAttribute('target', '_blank');
  }

  document.body.append(link);
  link.click();
  link.remove();

  // 清理临时 URL 以释放内存
  setTimeout(() => URL.revokeObjectURL(href), revokeDelay);
}

/**
 * 优先使用显式文件名，否则从 URL 末段提取，仍为空时使用默认文件名。
 *
 * @param url - 用于在缺少显式名称时提取末段文件名的资源地址。
 * @param fileName - 下载或输出时使用的目标文件名。
 * @returns 优先采用响应头文件名，其次采用 URL 末段，均缺失时使用下载兜底名。
 */
function resolveFileName(url: string, fileName?: string): string {
  return fileName || url.slice(url.lastIndexOf('/') + 1) || DEFAULT_FILENAME;
}
