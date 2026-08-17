import type { RequestClient } from '../request-client';
import type { RequestClientConfig } from '../types';

type DownloadRequestConfig = {
  responseReturn?: 'body' | 'raw';
} & Omit<RequestClientConfig, 'responseReturn'>;

class FileDownloader {
  private client: RequestClient;

  constructor(client: RequestClient) {
    this.client = client;
  }
  /**
   * 通过请求客户端取得 Blob 响应，并按响应头文件名触发浏览器下载。
   *
   * @param url - 要请求 Blob 响应并触发下载的资源地址。
   * @param config - Axios 请求的 headers、查询参数、响应模式和其他可选配置。
   * @returns 下载请求完成后的 Blob 或调用方指定响应类型。
   * @throws 请求客户端不支持配置的 HTTP 方法时抛出。
   */
  public async download<T = Blob>(
    url: string,
    config?: DownloadRequestConfig,
  ): Promise<T> {
    const finalConfig: DownloadRequestConfig = {
      responseReturn: 'body',
      method: 'GET',
      ...config,
      responseType: 'blob',
    };

    // Prefer a generic request if available; otherwise, dispatch to method-specific calls.
    const method = (finalConfig.method || 'GET').toUpperCase();
    const clientAny = this.client as any;

    if (typeof clientAny.request === 'function') {
      return await clientAny.request(url, finalConfig);
    }
    const lower = method.toLowerCase();

    if (typeof clientAny[lower] === 'function') {
      if (['POST', 'PUT'].includes(method)) {
        const { data, ...rest } = finalConfig as Record<string, any>;
        return await clientAny[lower](url, data, rest);
      }

      return await clientAny[lower](url, finalConfig);
    }

    throw new Error(
      `RequestClient does not support method "${method}". Please ensure the method is properly implemented in your RequestClient instance.`,
    );
  }
}

export { FileDownloader };
