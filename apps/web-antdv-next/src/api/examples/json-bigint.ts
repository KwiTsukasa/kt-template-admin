import { requestClient } from '#/api/request';

/**
 * 从演示端点读取包含大整数的 JSON，用于验证安全解析配置。
 *
 * @returns 经过 BigInt 安全解析的演示接口数据。
 */
async function getBigIntData() {
  return requestClient.get('/demo/bigint');
}

export { getBigIntData };
