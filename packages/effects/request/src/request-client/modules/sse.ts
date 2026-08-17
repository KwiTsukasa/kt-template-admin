import type { AxiosRequestHeaders, InternalAxiosRequestConfig } from 'axios';

import type { RequestClient } from '../request-client';
import type { SseRequestOptions } from '../types';

class SSE {
  private client: RequestClient;

  constructor(client: RequestClient) {
    this.client = client;
  }

  /**
   * 以 POST 请求建立 SSE 连接，并把事件、错误和取消信号转交给调用方。
   *
   * @param url - 要以 POST 方法建立事件流的 SSE 端点地址。
   * @param data - 要以 JSON 请求体发送给 SSE 端点的业务数据。
   * @param requestOptions - 控制 SSE 凭据、事件回调、错误回调与取消信号的请求选项。
   * @returns 表示 POST SSE 会话完成状态的 Promise；取消或失败语义由请求客户端统一处理。
   */
  public async postSSE(
    url: string,
    data?: any,
    requestOptions?: SseRequestOptions,
  ) {
    return this.requestSSE(url, data, {
      ...requestOptions,
      method: 'POST',
    });
  }

  /**
   * 以 POST 请求建立 SSE 流，并把消息、错误与取消状态转交给回调。
   *
   * @param url - 要与客户端基础地址拼接并建立事件流的 SSE 端点地址。
   * @param data - 以 JSON 请求体发送给 SSE 端点的业务数据。
   * @param requestOptions - 控制 SSE 凭据、事件回调、错误回调与取消信号的请求选项。
   * @throws 响应状态非成功或响应正文不可读取时抛出。
   */
  public async requestSSE(
    url: string,
    data?: any,
    requestOptions?: SseRequestOptions,
  ) {
    const baseUrl = this.client.getBaseUrl() || '';

    let axiosConfig: InternalAxiosRequestConfig<any> = {
      url,
      method: (requestOptions?.method as any) ?? 'GET',
      headers: {} as AxiosRequestHeaders,
    };
    const requestInterceptors = this.client.instance.interceptors
      .request as any;
    if (
      requestInterceptors.handlers &&
      requestInterceptors.handlers.length > 0
    ) {
      for (const handler of requestInterceptors.handlers) {
        if (typeof handler?.fulfilled === 'function') {
          const next = await handler.fulfilled(axiosConfig as any);
          if (next) axiosConfig = next as InternalAxiosRequestConfig<any>;
        }
      }
    }

    const merged = new Headers();
    Object.entries(
      (axiosConfig.headers ?? {}) as Record<string, string>,
    ).forEach(([k, v]) => merged.set(k, String(v)));
    if (requestOptions?.headers) {
      new Headers(requestOptions.headers).forEach((v, k) => merged.set(k, v));
    }
    if (!merged.has('accept')) {
      merged.set('accept', 'text/event-stream');
    }

    let bodyInit = requestOptions?.body ?? data;
    const ct = (merged.get('content-type') || '').toLowerCase();
    if (
      bodyInit &&
      typeof bodyInit === 'object' &&
      ct.includes('application/json')
    ) {
      const isBinaryBody =
        ArrayBuffer.isView(bodyInit as any) || bodyInit instanceof ArrayBuffer;
      const isFormBody =
        bodyInit instanceof Blob || bodyInit instanceof FormData;
      if (!isBinaryBody && !isFormBody) {
        bodyInit = JSON.stringify(bodyInit);
      }
    }
    const requestInit: RequestInit = {
      ...requestOptions,
      method: axiosConfig.method,
      headers: merged,
      body: bodyInit,
    };

    const response = await fetch(safeJoinUrl(baseUrl, url), requestInit);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No reader');
    }
    let isEnd = false;
    while (!isEnd) {
      const { done, value } = await reader.read();
      if (done) {
        isEnd = true;
        decoder.decode(new Uint8Array(0), { stream: false });
        requestOptions?.onEnd?.();
        reader.releaseLock?.();
        break;
      }
      const content = decoder.decode(value, { stream: true });
      requestOptions?.onMessage?.(content);
    }
  }
}

/**
 * 通过规范化基础地址与子路径的斜杠，拼接出不重复分隔符的 URL。
 *
 * @param baseUrl - 需要与子路径拼接的 SSE 服务基础地址。
 * @param url - 要拼接的相对端点；若已是绝对地址则原样返回。
 * @returns 规范化斜杠后的完整 URL。
 */
function safeJoinUrl(baseUrl: string | undefined, url: string): string {
  if (!baseUrl) {
    return url; // 没有 baseUrl，直接返回 url
  }

  // 如果 url 本身就是绝对地址，直接返回
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  // 如果 baseUrl 是完整 URL，就用 new URL
  if (/^https?:\/\//i.test(baseUrl)) {
    return new URL(url, baseUrl).toString();
  }

  // 否则，当作路径拼接
  return `${baseUrl.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}

export { SSE };
