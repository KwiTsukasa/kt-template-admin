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
 * 把文件与可选桶名、对象名交给统一对象存储上传端点。
 *
 * @param file - 要通过统一接口上传到对象存储的文件或 Blob。
 * @param options - 对象存储的可选桶名、对象名和其他上传字段；未传入时使用 `{}`。
 * @returns 对象存储返回的桶名、对象名、访问地址与文件元数据。
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

/**
 * 通过对象存储桶与对象名拼接鉴权下载地址，缺少桶名时只传对象名。
 *
 * @param file - 已上传对象的桶名和对象名，用于构造鉴权下载地址。
 * @returns 包含对象名及可选桶名查询参数的 MinIO 下载地址。
 */
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
