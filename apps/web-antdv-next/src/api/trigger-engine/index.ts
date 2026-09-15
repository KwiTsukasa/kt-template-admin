import { createDefinitionClient } from '#/api/automation/definition';
import { requestClient } from '#/api/request';
import type {
  DataSchema,
  DataScalar,
  PublishedReference,
} from '#/api/automation/definition';

export type TriggerConfiguration =
  | { type: 'cron'; expression: string; timezone: string }
  | { type: 'interval'; everyMs: number }
  | { type: 'once'; at: string }
  | {
      type: 'event';
      eventKey: string;
      eventVersion: number;
      payloadSchema: DataSchema;
    }
  | { type: 'manual' };
export type TriggerDefinition = {
  schemaVersion: 1;
  trigger: TriggerConfiguration;
};
export type TriggerEventSource = {
  key: string;
  version: number;
  name: string;
  payloadSchema: DataSchema;
};
export type TriggerRegistration = {
  id: string;
  consumerKey: string;
  triggerRef: PublishedReference;
  status: 'prepared' | 'active' | 'closed';
  nextAt: string | null;
};
export type TriggerOccurrence = {
  id: string;
  registrationId: string;
  triggerRef: PublishedReference;
  occurredAt: string;
  payload: Record<string, DataScalar>;
  status: 'pending' | 'acknowledged';
};
export const triggerApi = {
  ...createDefinitionClient<TriggerDefinition>('triggers'),
  preview: (definition: TriggerDefinition) =>
    requestClient.post<{
      definition: TriggerDefinition;
      occurrences: string[];
    }>('/automation/triggers/preview', { definition }),
  eventSources: () =>
    requestClient.get<TriggerEventSource[]>(
      '/automation/triggers/event-sources',
    ),
  registrations: (id: string) =>
    requestClient.get<TriggerRegistration[]>(
      `/automation/triggers/${id}/registrations`,
    ),
  occurrences: (id: string, beforeId?: string) =>
    requestClient.get<{ list: TriggerOccurrence[]; nextCursor: string | null }>(
      `/automation/triggers/${id}/occurrences`,
      { params: { beforeId } },
    ),
};
export const emptyTrigger = (): TriggerDefinition => ({
  schemaVersion: 1,
  trigger: { type: 'manual' },
});
