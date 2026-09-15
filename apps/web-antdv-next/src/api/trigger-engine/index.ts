import type {
  DataScalar,
  DataSchema,
  PublishedReference,
} from '#/api/automation/definition';

import { createDefinitionClient } from '#/api/automation/definition';
import { requestClient } from '#/api/request';

export type TriggerConfiguration =
  | { at: string; type: 'once' }
  | {
      eventKey: string;
      eventVersion: number;
      payloadSchema: DataSchema;
      type: 'event';
    }
  | { everyMs: number; type: 'interval' }
  | { expression: string; timezone: string; type: 'cron' }
  | { type: 'manual' };
export type TriggerDefinition = {
  schemaVersion: 1;
  trigger: TriggerConfiguration;
};
export type TriggerEventSource = {
  key: string;
  name: string;
  payloadSchema: DataSchema;
  version: number;
};
export type TriggerRegistration = {
  consumerKey: string;
  id: string;
  nextAt: null | string;
  status: 'active' | 'closed' | 'prepared';
  triggerRef: PublishedReference;
};
export type TriggerOccurrence = {
  id: string;
  occurredAt: string;
  payload: Record<string, DataScalar>;
  registrationId: string;
  status: 'acknowledged' | 'pending';
  triggerRef: PublishedReference;
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
    requestClient.get<{ list: TriggerOccurrence[]; nextCursor: null | string }>(
      `/automation/triggers/${id}/occurrences`,
      { params: { beforeId } },
    ),
};
export const emptyTrigger = (): TriggerDefinition => ({
  schemaVersion: 1,
  trigger: { type: 'manual' },
});
