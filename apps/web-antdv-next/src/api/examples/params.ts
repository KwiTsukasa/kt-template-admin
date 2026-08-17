import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

/**
 * 按指定序列化方式发送数组查询参数，并保留原始响应信息。
 *
 * @param params - 列表接口接收的筛选与分页字段。
 * @param type - 数组查询参数采用 brackets、comma、indices 或 repeat 中的哪种序列化方式。
 * @returns 包含服务端解析结果与响应元信息的原始响应。
 */
async function getParamsData(
  params: Recordable<any>,
  type: 'brackets' | 'comma' | 'indices' | 'repeat',
) {
  return requestClient.get('/status', {
    params,
    paramsSerializer: type,
    responseReturn: 'raw',
  });
}

export { getParamsData };
