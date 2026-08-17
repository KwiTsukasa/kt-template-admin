import type { RequestClient } from '../request-client';
import type { RequestClientConfig } from '../types';

import { isUndefined } from '@vben/utils';

class FileUploader {
  private client: RequestClient;

  constructor(client: RequestClient) {
    this.client = client;
  }

  /**
   * 把普通字段与数组字段编码为 multipart/form-data，并通过请求客户端上传。
   *
   * @param url - 接收 multipart/form-data 的上传接口地址。
   * @param data - 要编码进 FormData 的字段；数组字段按索引展开，undefined 字段忽略。
   * @param config - 透传给请求客户端的配置，调用方请求头会与 multipart 类型合并。
   * @returns 请求客户端返回的上传接口响应。
   */
  public async upload<T = any>(
    url: string,
    data: Record<string, any> & { file: Blob | File },
    config?: RequestClientConfig,
  ): Promise<T> {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          !isUndefined(item) && formData.append(`${key}[${index}]`, item);
        });
      } else {
        !isUndefined(value) && formData.append(key, value);
      }
    });

    const finalConfig: RequestClientConfig = {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...config?.headers,
      },
    };

    return this.client.post(url, formData, finalConfig);
  }
}

export { FileUploader };
