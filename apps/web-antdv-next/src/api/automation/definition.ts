import { requestClient } from '#/api/request';

export type DataScalar = boolean | number | string;
export type DataField = {
  format?: 'date' | 'date-time';
  key: string;
  label: string;
  max?: number;
  min?: number;
  options?: { label: string; value: DataScalar }[];
  required: boolean;
  type: 'boolean' | 'integer' | 'number' | 'string';
};
export type DataSchema = { fields: DataField[] };
export type PublishedReference = { id: string; version: number };
export type DefinitionDocument<T> = {
  definition: T;
  description: string;
  id: string;
  name: string;
  publishedVersion: null | number;
  revision: number;
  updateTime?: string;
};
export type DefinitionRevision<T> = {
  definition: T;
  definitionId: string;
  description: string;
  name: string;
  publishedAt: string;
  version: number;
};
export type DefinitionWrite<T> = {
  definition: T;
  description?: string;
  expectedRevision?: number;
  name: string;
};
export type DefinitionPage<T> = {
  list: DefinitionDocument<T>[];
  pageNo: number;
  pageSize: number;
  total: number;
};

export const createDefinitionClient = <T>(resource: string) => ({
  page: (params: Record<string, unknown>) =>
    requestClient.get<DefinitionPage<T>>(`/automation/${resource}/page`, {
      params,
    }),
  detail: (id: string) =>
    requestClient.get<DefinitionDocument<T>>(`/automation/${resource}/${id}`),
  create: (body: DefinitionWrite<T>) =>
    requestClient.post<DefinitionDocument<T>>(`/automation/${resource}`, body),
  save: (id: string, body: DefinitionWrite<T>) =>
    requestClient.post<DefinitionDocument<T>>(
      `/automation/${resource}/${id}/draft`,
      body,
    ),
  publish: (id: string, expectedRevision: number) =>
    requestClient.post<{ id: string; revision: number; version: number }>(
      `/automation/${resource}/${id}/publish`,
      { expectedRevision },
    ),
  versions: (id: string) =>
    requestClient.get<DefinitionRevision<T>[]>(
      `/automation/${resource}/${id}/versions`,
    ),
  version: (id: string, version: number) =>
    requestClient.get<T>(`/automation/${resource}/${id}/versions/${version}`),
});
export type DefinitionClient<T> = ReturnType<typeof createDefinitionClient<T>>;
