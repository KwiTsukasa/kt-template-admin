import { requestClient } from '#/api/request';

export namespace BlogAssetApi {
  export interface BucketStatus {
    bucketName: string;
    exists: boolean;
  }

  export interface ListQuery {
    bucketName?: string;
    prefix?: string;
    recursive?: boolean;
  }

  export interface ObjectItem {
    etag: string;
    lastModified?: string;
    name: string;
    size: number;
  }

  export interface ObjectQuery {
    bucketName?: string;
    objectName: string;
  }

  export type SameOriginUrlQuery = ObjectQuery;

  export interface UploadOptions {
    bucketName?: string;
    objectName?: string;
  }

  export interface UploadResult {
    bucketName: string;
    etag: string;
    mimeType: string;
    objectName: string;
    size: number;
    url: string;
  }
}

/**
 * 检查对象存储桶是否存在，并返回实际桶名与存在标志。
 *
 * @param bucketName - 需要检查或创建的对象存储桶名称。
 * @returns 实际存储桶名称及其是否已存在的标志。
 */
export function checkAssetBucket(bucketName?: string) {
  return requestClient.get<BlogAssetApi.BucketStatus>('/minio/check', {
    params: { bucketName },
  });
}

/**
 * 请求对象存储创建指定桶，并返回服务端确认的桶名。
 *
 * @param bucketName - 需要检查或创建的对象存储桶名称。
 * @returns 服务端确认创建或复用的存储桶名称。
 */
export function createAssetBucket(bucketName?: string) {
  return requestClient.post<string>('/minio/bucket', undefined, {
    params: { bucketName },
  });
}

/**
 * 上传博客文件到可选桶名与对象名，并返回 URL、ETag、类型和大小。
 *
 * @param file - 要上传到对象存储的本地文件。
 * @param options - 可选存储桶和对象名；省略时由后端选择默认桶并沿用上传文件名。
 * @returns 已保存对象的桶名、对象名、URL、ETag、MIME 类型和字节数。
 */
export function uploadBlogAsset(
  file: Blob | File,
  options: BlogAssetApi.UploadOptions = {},
) {
  return requestClient.upload<BlogAssetApi.UploadResult>('/minio/upload', {
    ...options,
    file,
  });
}

/**
 * 根据存储桶、对象前缀和递归开关列出博客资源。
 *
 * @param params - 可选存储桶、对象名前缀和递归列举开关；缺省时使用服务端默认桶。
 * @returns 与桶名、前缀和递归条件匹配的对象名、大小、ETag 与修改时间数组；无匹配时为空数组。
 */
export function getAssetList(params: BlogAssetApi.ListQuery = {}) {
  return requestClient.get<BlogAssetApi.ObjectItem[]>('/minio/list', {
    params,
  });
}

/**
 * 请求指定对象的同源访问地址，避免浏览器跨域读取资源。
 *
 * @param params - 需要生成同源访问地址的存储桶名与对象名。
 * @returns 指定存储对象可供浏览器同源访问的 URL。
 */
export function getAssetSameOriginUrl(params: BlogAssetApi.SameOriginUrlQuery) {
  return requestClient.get<string>('/minio/url', { params });
}

/**
 * 按存储桶与对象名删除博客资源，并返回后端是否完成删除。
 *
 * @param params - 需要从对象存储移除的存储桶名与对象名。
 * @returns 后端返回的删除确认标志；true 表示指定对象已移除。
 */
export function removeBlogAsset(params: BlogAssetApi.ObjectQuery) {
  return requestClient.delete<boolean>('/minio/remove', { params });
}
