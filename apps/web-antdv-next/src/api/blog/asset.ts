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

  export interface PresignedUrlQuery extends ObjectQuery {
    expiry?: number;
  }

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

export function checkAssetBucket(bucketName?: string) {
  return requestClient.get<BlogAssetApi.BucketStatus>('/minio/check', {
    params: { bucketName },
  });
}

export function createAssetBucket(bucketName?: string) {
  return requestClient.post<string>('/minio/bucket', undefined, {
    params: { bucketName },
  });
}

export function uploadBlogAsset(
  file: Blob | File,
  options: BlogAssetApi.UploadOptions = {},
) {
  return requestClient.upload<BlogAssetApi.UploadResult>('/minio/upload', {
    ...options,
    file,
  });
}

export function getAssetList(params: BlogAssetApi.ListQuery = {}) {
  return requestClient.get<BlogAssetApi.ObjectItem[]>('/minio/list', {
    params,
  });
}

export function getAssetPresignedUrl(params: BlogAssetApi.PresignedUrlQuery) {
  return requestClient.get<string>('/minio/url', { params });
}

export function removeBlogAsset(params: BlogAssetApi.ObjectQuery) {
  return requestClient.delete<boolean>('/minio/remove', { params });
}
