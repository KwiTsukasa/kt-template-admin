import { requestClient } from '#/api/request';

export namespace DictApi {
  export interface Option {
    label: string;
    value: number | string;
  }
}

export function getDictByKey(dictKey: string) {
  return requestClient.get<DictApi.Option[]>('/dict/getDictByKey', {
    params: { dictKey },
  });
}
