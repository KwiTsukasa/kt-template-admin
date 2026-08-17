import type { RequestResponse } from '@vben/request';

import { requestClient } from '../request';

/**
 * 通过请求客户端下载示例图片，并只返回响应 Blob。
 *
 * @returns 示例图片响应的 Blob 内容。
 */
async function downloadFile1() {
  return requestClient.download<Blob>(
    'https://unpkg.com/@vbenjs/static-source@0.1.7/source/logo-v1.webp',
  );
}

/**
 * 通过请求客户端下载示例图片，并保留包含响应头的完整响应对象。
 *
 * @returns 包含 Blob 正文、响应头和状态码的完整响应。
 */
async function downloadFile2() {
  return requestClient.download<RequestResponse<Blob>>(
    'https://unpkg.com/@vbenjs/static-source@0.1.7/source/logo-v1.webp',
    {
      responseReturn: 'raw',
    },
  );
}

export { downloadFile1, downloadFile2 };
