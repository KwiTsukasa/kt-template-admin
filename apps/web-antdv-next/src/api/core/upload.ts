import { requestClient } from '#/api/request';

export interface UploadFileOptions {
  bucketName?: string;
  objectName?: string;
}

export interface UploadFileResult {
  bucketName: string;
  etag: string;
  mimeType: string;
  objectName: string;
  size: number;
  url: string;
}

/**
 * 统一文件上传入口，业务侧只传文件和可选对象名。
 */
export async function uploadFileApi(
  file: Blob | File,
  options: UploadFileOptions = {},
) {
  return requestClient.upload<UploadFileResult>('/minio/upload', {
    ...options,
    file,
  });
}

export function createUploadedFileDownloadUrl(file: UploadFileResult) {
  const baseUrl = requestClient.getBaseUrl() || '';
  const params = new URLSearchParams({
    objectName: file.objectName,
  });

  if (file.bucketName) {
    params.set('bucketName', file.bucketName);
  }

  return `${baseUrl.replace(/\/$/, '')}/minio/download?${params.toString()}`;
}
