import type {
  DataScalar,
  PublishedReference,
} from '#/api/automation/definition';
import type { RuleScalar } from '#/api/rule-engine';

import { createDefinitionClient } from '#/api/automation/definition';
import { requestClient } from '#/api/request';

export type ScheduleBinding =
  | { field: 'id' | 'occurredAt' | 'registrationId'; source: 'occurrence' }
  | { field: string; source: 'event' }
  | { source: 'literal'; value: DataScalar };
export type ScheduleTarget = {
  reference: PublishedReference;
  type: 'task' | 'workflow';
};
export type ScheduleDefinition = {
  admission: null | {
    expected: RuleScalar;
    facts: Record<string, ScheduleBinding>;
    ruleRef: PublishedReference;
  };
  input: Record<string, ScheduleBinding>;
  overlap: 'allow' | 'skip';
  schemaVersion: 1;
  target: null | ScheduleTarget;
  taskDeadlineMs: number;
  triggerRef: null | PublishedReference;
};
export type ScheduleState = {
  activationStatus: 'active' | 'closed' | 'prepared' | null;
  activeVersion: null | number;
  enabled: boolean;
  error: null | string;
  manualTrigger: boolean;
  nextRunAt: null | string;
  revision: number;
  scheduleId: string;
};
export type ScheduleHistory = {
  error: null | string;
  finishedAt: null | string;
  id: string;
  occurredAt: string;
  occurrenceId: string;
  scheduleId: string;
  scheduleVersion: number;
  status:
    | 'cancelled'
    | 'failed'
    | 'pending'
    | 'running'
    | 'skipped'
    | 'starting'
    | 'succeeded';
  target: null | ScheduleTarget;
  targetRunId: null | string;
};
export const scheduleApi = {
  ...createDefinitionClient<ScheduleDefinition>('schedules'),
  state: (id: string) =>
    requestClient.get<ScheduleState>(`/automation/schedules/${id}/state`),
  enable: (id: string, version: number, expectedRevision: number) =>
    requestClient.post<ScheduleState>(`/automation/schedules/${id}/enable`, {
      version,
      expectedRevision,
    }),
  disable: (id: string, expectedRevision: number) =>
    requestClient.post<ScheduleState>(`/automation/schedules/${id}/disable`, {
      expectedRevision,
    }),
  fire: (id: string, eventId: string) =>
    requestClient.post(`/automation/schedules/${id}/fire`, { eventId }),
  history: (id: string, beforeId?: string) =>
    requestClient.get<{ list: ScheduleHistory[]; nextCursor: null | string }>(
      `/automation/schedules/${id}/history`,
      { params: { beforeId } },
    ),
};
export const emptySchedule = (): ScheduleDefinition => ({
  schemaVersion: 1,
  triggerRef: null,
  target: null,
  input: {},
  admission: null,
  overlap: 'skip',
  taskDeadlineMs: 300_000,
});
