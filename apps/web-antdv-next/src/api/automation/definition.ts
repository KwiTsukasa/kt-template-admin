import { requestClient } from '#/api/request';

export type DataScalar = boolean | number | string;
export type DataField = {
  key: string;
  label: string;
  type: 'boolean' | 'integer' | 'number' | 'string';
  required: boolean;
  min?: number;
  max?: number;
  format?: 'date' | 'date-time';
  options?: { label: string; value: DataScalar }[];
};
export type DataSchema = { fields: DataField[] };
export type PublishedReference = { id: string; version: number };
export type DefinitionDocument<T> = {
  id: string;
  name: string;
  description: string;
  definition: T;
  revision: number;
  publishedVersion: number | null;
  updateTime?: string;
};
export type DefinitionRevision<T> = {
  definitionId: string;
  version: number;
  name: string;
  description: string;
  definition: T;
  publishedAt: string;
};
export type DefinitionWrite<T> = {
  name: string;
  description?: string;
  definition: T;
  expectedRevision?: number;
};
export type DefinitionPage<T> = {
  list: DefinitionDocument<T>[];
  total: number;
  pageNo: number;
  pageSize: number;
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
    requestClient.post<{ id: string; version: number; revision: number }>(
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
