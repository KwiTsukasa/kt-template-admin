import { requestClient } from '#/api/request';

export namespace DemoTableApi {
  export interface PageFetchParams {
    [key: string]: any;
    page: number;
    pageSize: number;
  }
}

/**
 * 根据分页与筛选参数读取示例表格记录。
 *
 * @param params - 示例表格请求的页码、页容量和筛选字段。
 * @returns 示例表格的当前页记录与总数。
 */
async function getExampleTableApi(params: DemoTableApi.PageFetchParams) {
  return requestClient.get('/table/list', { params });
}

export { getExampleTableApi };
