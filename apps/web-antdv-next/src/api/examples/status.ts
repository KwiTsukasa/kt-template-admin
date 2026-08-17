import { requestClient } from '#/api/request';

/**
 * 将指定状态码发送到演示端点，用于触发对应 HTTP 响应。
 *
 * @param status - 要求演示接口返回的 HTTP 状态码文本。
 * @returns 指定状态码端点返回的数据；非成功状态由请求客户端按统一规则处理。
 */
async function getMockStatusApi(status: string) {
  return requestClient.get('/status', { params: { status } });
}

export { getMockStatusApi };
