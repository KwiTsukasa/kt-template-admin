import type { QqbotNapcatApi } from '#/api/qqbot/napcat';

export function formatEventTime(value: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour12: false });
}

export function getScanStepStatus(
  status: QqbotNapcatApi.AccountScanEvent['status'],
) {
  if (status === 'error') return 'error';
  if (status === 'processing') return 'process';
  if (status === 'success') return 'finish';
  return 'wait';
}

export function isQrcodeImageCandidate(value: string) {
  return (
    /^data:image\//i.test(value) ||
    /^https?:\/\//i.test(value) ||
    isRawBase64Image(value)
  );
}

export function normalizeQrcodeImageSrc(value: string, revision = 0) {
  if (isRawBase64Image(value)) {
    return `data:image/png;base64,${value}`;
  }
  if (/^https?:\/\//i.test(value) && revision > 0) {
    return appendQrcodeCacheBuster(value, revision);
  }
  return value;
}

function appendQrcodeCacheBuster(value: string, revision: number) {
  try {
    const url = new URL(value);
    url.searchParams.set('_kt_qrcode_v', `${revision}`);
    return url.toString();
  } catch {
    const joiner = value.includes('?') ? '&' : '?';
    return `${value}${joiner}_kt_qrcode_v=${revision}`;
  }
}

function isRawBase64Image(value: string) {
  const normalized = value.trim();
  return (
    normalized.startsWith('iVBORw0KGgo') ||
    normalized.startsWith('/9j/') ||
    normalized.startsWith('R0lGOD')
  );
}
