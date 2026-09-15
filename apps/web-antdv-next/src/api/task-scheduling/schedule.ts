import type {
  PublishedReference,
  DataScalar,
} from '#/api/automation/definition';
import type { RuleScalar } from '#/api/rule-engine';
import { createDefinitionClient } from '#/api/automation/definition';
import { requestClient } from '#/api/request';

export type ScheduleBinding =
  | { source: 'literal'; value: DataScalar }
  | { source: 'event'; field: string }
  | { source: 'occurrence'; field: 'id' | 'registrationId' | 'occurredAt' };
export type ScheduleTarget = {
  type: 'task' | 'workflow';
  reference: PublishedReference;
};
export type ScheduleDefinition = {
  schemaVersion: 1;
  triggerRef: PublishedReference | null;
  target: ScheduleTarget | null;
  input: Record<string, ScheduleBinding>;
  admission: {
    ruleRef: PublishedReference;
    facts: Record<string, ScheduleBinding>;
    expected: RuleScalar;
  } | null;
  overlap: 'allow' | 'skip';
  taskDeadlineMs: number;
};
export type ScheduleState = {
  scheduleId: string;
  revision: number;
  enabled: boolean;
  activeVersion: number | null;
  activationStatus: 'prepared' | 'active' | 'closed' | null;
  manualTrigger: boolean;
  error: string | null;
};
export type ScheduleHistory = {
  id: string;
  scheduleId: string;
  scheduleVersion: number;
  occurrenceId: string;
  occurredAt: string;
  status:
    | 'pending'
    | 'starting'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'skipped'
    | 'cancelled';
  target: ScheduleTarget | null;
  targetRunId: string | null;
  error: string | null;
  finishedAt: string | null;
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
    requestClient.get<{ list: ScheduleHistory[]; nextCursor: string | null }>(
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
  taskDeadlineMs: 300000,
});
