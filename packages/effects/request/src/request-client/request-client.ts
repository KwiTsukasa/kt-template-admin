import type { AxiosInstance, AxiosResponse } from 'axios';

import type { RequestClientConfig, RequestClientOptions } from './types';

import { bindMethods, isString, merge } from '@vben/utils';

import axios from 'axios';
import qs from 'qs';

import { FileDownloader } from './modules/downloader';
import { InterceptorManager } from './modules/interceptor';
import { SSE } from './modules/sse';
import { FileUploader } from './modules/uploader';

/**
 * 返回请求客户端当前参数序列化函数，未配置时使用默认序列化器。
 *
 * @param paramsSerializer - 把请求参数编码为查询字符串的序列化函数。
 * @returns 与 `brackets`、`comma`、`indices` 或 `repeat` 模式匹配的查询参数序列化函数；函数输入保持原样。
 */
function getParamsSerializer(
  paramsSerializer: RequestClientOptions['paramsSerializer'],
) {
  if (isString(paramsSerializer)) {
    switch (paramsSerializer) {
      case 'brackets': {
        return (params: any) =>
          qs.stringify(params, { arrayFormat: 'brackets' });
      }
      case 'comma': {
        return (params: any) => qs.stringify(params, { arrayFormat: 'comma' });
      }
      case 'indices': {
        return (params: any) =>
          qs.stringify(params, { arrayFormat: 'indices' });
      }
      case 'repeat': {
        return (params: any) => qs.stringify(params, { arrayFormat: 'repeat' });
      }
    }
  }
  return paramsSerializer;
}

class RequestClient {
  public addRequestInterceptor: InterceptorManager['addRequestInterceptor'];

  public addResponseInterceptor: InterceptorManager['addResponseInterceptor'];
  public download: FileDownloader['download'];

  public readonly instance: AxiosInstance;
  // 是否正在刷新token
  public isRefreshing = false;
  public postSSE: SSE['postSSE'];
  // 刷新token队列
  public refreshTokenQueue: ((token: string) => void)[] = [];
  public requestSSE: SSE['requestSSE'];
  public upload: FileUploader['upload'];

  constructor(options: RequestClientOptions = {}) {
    // 合并默认配置和传入的配置
    const defaultConfig: RequestClientOptions = {
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
      },
      responseReturn: 'raw',
      // 默认超时时间
      timeout: 10_000,
    };
    const { ...axiosConfig } = options;
    const requestConfig = merge(axiosConfig, defaultConfig);
    requestConfig.paramsSerializer = getParamsSerializer(
      requestConfig.paramsSerializer,
    );
    this.instance = axios.create(requestConfig);

    bindMethods(this);

    // 实例化拦截器管理器
    const interceptorManager = new InterceptorManager(this.instance);
    this.addRequestInterceptor =
      interceptorManager.addRequestInterceptor.bind(interceptorManager);
    this.addResponseInterceptor =
      interceptorManager.addResponseInterceptor.bind(interceptorManager);

    // 实例化文件上传器
    const fileUploader = new FileUploader(this);
    this.upload = fileUploader.upload.bind(fileUploader);
    // 实例化文件下载器
    const fileDownloader = new FileDownloader(this);
    this.download = fileDownloader.download.bind(fileDownloader);
    // 实例化SSE模块
    const sse = new SSE(this);
    this.postSSE = sse.postSSE.bind(sse);
    this.requestSSE = sse.requestSSE.bind(sse);
  }

  /**
   * 将 DELETE 方法与调用方配置合并后交给统一请求入口。
   *
   * @param url - 要发送 DELETE 请求的接口地址。
   * @param config - Axios 请求的 headers、查询参数、响应模式和其他可选配置。
   * @returns 按响应返回策略解析后的 DELETE 结果。
   */
  public delete<T = any>(
    url: string,
    config?: RequestClientConfig,
  ): Promise<T> {
    return this.request<T>(url, { ...config, method: 'DELETE' });
  }

  /**
   * 将 GET 方法与调用方配置合并后交给统一请求入口。
   *
   * @param url - 要发送 GET 请求的接口地址。
   * @param config - Axios 请求的 headers、查询参数、响应模式和其他可选配置。
   * @returns 按响应返回策略解析后的 GET 结果。
   */
  public get<T = any>(url: string, config?: RequestClientConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'GET' });
  }

  /**
   * 从 Axios 默认配置读取基础 URL；未配置时返回空字符串。
   *
   * @returns Axios 配置中的 baseURL；未配置时为空字符串。
   */
  public getBaseUrl() {
    return this.instance.defaults.baseURL;
  }

  /**
   * 将 POST 方法、业务载荷与调用方配置交给统一请求入口。
   *
   * @param url - 要发送 POST 请求的接口地址。
   * @param data - POST 或 PUT 请求发送的业务载荷。
   * @param config - Axios 请求的 headers、查询参数、响应模式和其他可选配置。
   * @returns 按响应返回策略解析后的 POST 结果。
   */
  public post<T = any>(
    url: string,
    data?: any,
    config?: RequestClientConfig,
  ): Promise<T> {
    return this.request<T>(url, { ...config, data, method: 'POST' });
  }

  /**
   * 将 PUT 方法、业务载荷与调用方配置交给统一请求入口。
   *
   * @param url - 要发送 PUT 请求的接口地址。
   * @param data - POST 或 PUT 请求发送的业务载荷。
   * @param config - Axios 请求的 headers、查询参数、响应模式和其他可选配置。
   * @returns 按响应返回策略解析后的 PUT 结果。
   */
  public put<T = any>(
    url: string,
    data?: any,
    config?: RequestClientConfig,
  ): Promise<T> {
    return this.request<T>(url, { ...config, data, method: 'PUT' });
  }

  /**
   * 通过 Axios 发送请求，并依次应用拦截器、响应转换与错误处理。
   *
   * @param url - 交给 Axios 请求实例的接口地址。
   * @param config - Axios 请求的 headers、查询参数、响应模式和其他可选配置。
   * @returns 经过拦截器与响应转换后的泛型结果。
   * @throws 请求或响应处理失败时抛出服务端错误数据；无响应数据时抛出原异常。
   */
  public async request<T>(
    url: string,
    config: RequestClientConfig,
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.instance({
        url,
        ...config,
        ...(() => {
          if (config.paramsSerializer) {
            return {
              paramsSerializer: getParamsSerializer(config.paramsSerializer),
            };
          }
          return {};
        })(),
      });
      return response as T;
    } catch (error: any) {
      if (error.response) {
        throw error.response.data;
      }
      throw error;
    }
  }
}

export { RequestClient };
