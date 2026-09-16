import type { PublishedReference } from '#/api/automation/definition';
import type { FormDefinition } from '#/api/form-definition';
import type { WorkflowRun } from '#/api/workflow-engine';

import { requestClient } from '#/api/request';

export interface MediaWorkflowHumanTask {
  executionId: string;
  nodeId: string;
  name: string;
  visit: number;
  formRef: null | PublishedReference;
  form: FormDefinition | null;
  writableFields: string[];
  values: Record<string, unknown>;
}

const base = (taskId: string) =>
  `/media-governance/tasks/${encodeURIComponent(taskId)}/workflow`;
export const mediaWorkflowApi = {
  humanTasks: (taskId: string) =>
    requestClient.get<MediaWorkflowHumanTask[]>(`${base(taskId)}/human-tasks`),
  completeHumanTask: (
    taskId: string,
    runId: string,
    executionId: string,
    values: Record<string, unknown>,
  ) =>
    requestClient.post<WorkflowRun>(`${base(taskId)}/human-tasks/complete`, {
      runId,
      executionId,
      values,
    }),
  latest: (taskId: string) =>
    requestClient.get<null | WorkflowRun>(`${base(taskId)}/runs/latest`),
  cancel: (taskId: string, runId: string) =>
    requestClient.post<WorkflowRun>(`${base(taskId)}/cancel`, { runId }),
};
