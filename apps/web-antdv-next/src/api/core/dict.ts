import { requestClient } from '#/api/request';

export namespace DictApi {
  export interface Option {
    label: string;
    value: number | string;
  }
}

/**
 * 根据字典键读取标签与值选项，未配置条目时得到空数组。
 *
 * @param dictKey - 需要向后端查询的字典唯一键。
 * @returns 与字典键对应的标签和值选项数组；没有配置条目时为空数组。
 */
export function getDictByKey(dictKey: string) {
  return requestClient.get<DictApi.Option[]>('/dict/getDictByKey', {
    params: { dictKey },
  });
}
