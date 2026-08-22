import type { BotNapcatApi } from '#/api/bot/napcat';

/**
 * 把事件时间戳转换为中文二十四小时制时间，无效时间返回空字符串。
 *
 * @param value - 扫码事件的日期字符串、时间戳或空值。
 * @returns 二维码事件时间的本地化文本；输入缺失或无效时为空字符串。
 */
export function formatEventTime(value: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour12: false });
}

/**
 * 根据当前扫码进度计算步骤条的完成、处理中或等待状态。
 *
 * @param status - 扫码事件的 info、processing、success 或 error 状态。
 * @returns 步骤条使用的完成、处理中或等待状态。
 */
export function getScanStepStatus(
  status: BotNapcatApi.AccountScanEvent['status'],
) {
  if (status === 'error') return 'error';
  if (status === 'processing') return 'process';
  if (status === 'success') return 'finish';
  return 'wait';
}

/**
 * 通过 data URL、HTTP 地址或纯 Base64 特征识别可显示为二维码图片的输入。
 *
 * @param value - 待识别的二维码内容，可为图片 data URL、HTTP 地址或常见图片 Base64。
 * @returns 输入是 data URL、HTTP 地址或纯 Base64 图片时返回 true，否则返回 false。
 */
export function isQrcodeImageCandidate(value: string) {
  return (
    /^data:image\//i.test(value) ||
    /^https?:\/\//i.test(value) ||
    isRawBase64Image(value)
  );
}

/**
 * 把二维码文本规范化为可显示图片地址，并按修订号追加防缓存参数。
 *
 * @param value - 二维码文本、data URL、HTTP 地址或纯 Base64 图片内容。
 * @param revision - 用于丢弃迟到响应或刷新二维码缓存的当前修订号；未传入时使用 `0`。
 * @returns 可直接绑定到图片元素的二维码地址；输入为空时返回空字符串。
 */
export function normalizeQrcodeImageSrc(value: string, revision = 0) {
  if (isRawBase64Image(value)) {
    return `data:image/png;base64,${value}`;
  }
  if (/^https?:\/\//i.test(value) && revision > 0) {
    return appendQrcodeCacheBuster(value, revision);
  }
  return value;
}

/**
 * 将会话修订号追加到二维码地址，强制浏览器绕过旧图片缓存。
 *
 * @param value - 需要追加修订号防缓存参数的二维码地址。
 * @param revision - 写入查询参数、用于区分二维码版本的会话修订号。
 * @returns 追加防缓存参数后的二维码 URL。
 */
function appendQrcodeCacheBuster(value: string, revision: number) {
  try {
    const url = new URL(value);
    url.searchParams.set('_kt_qrcode_v', `${revision}`);
    return url.toString();
  } catch {
    const joiner = (() => {
      if (value.includes('?')) {
        return '&';
      }
      return '?';
    })();
    return `${value}${joiner}_kt_qrcode_v=${revision}`;
  }
}

/**
 * 通过检查输入是否为不带 data URL 前缀的有效 Base64 图片内容。
 *
 * @param value - 待检查的二维码文本；仅识别 PNG、JPEG 和 GIF 的常见 Base64 文件头。
 * @returns 输入是不含 data URL 前缀的合法 Base64 图片时返回 true，否则返回 false。
 */
function isRawBase64Image(value: string) {
  const normalized = value.trim();
  return (
    normalized.startsWith('iVBORw0KGgo') ||
    normalized.startsWith('/9j/') ||
    normalized.startsWith('R0lGOD')
  );
}
