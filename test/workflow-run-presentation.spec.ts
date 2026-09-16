import type {
  WorkflowNodeRun,
  WorkflowNodeVisit,
  WorkflowRun,
} from '#/api/workflow-engine';

import { describe, expect, it } from 'vitest';

import {
  workflowNodeVisits,
  workflowRunNodeStates,
} from '#/views/workflow-engine/workflow-run-presentation';

const node: WorkflowNodeRun = {
  nodeId: 'step',
  visit: 1,
  status: 'waiting',
  error: null,
  taskRunId: null,
  loopIteration: 0,
  loopPath: {},
  output: {},
  scriptAttempts: [],
  selectedPorts: [],
  wakeAt: null,
};
const run: WorkflowRun = {
  runId: 'run',
  workflowId: 'flow',
  workflowVersion: 1,
  status: 'waiting',
  error: null,
  formValues: null,
  input: {},
  output: {},
  nodes: [node],
};

describe('BPMN 运行展示', () => {
  it('较早多实例仍等待时保留较晚完成的轮次和当前时间', () => {
    const history: WorkflowNodeVisit[] = [
      {
        ...node,
        visit: 2,
        status: 'succeeded',
        output: { count: 2 },
        startedAt: '2026-09-16T00:00:00Z',
        finishedAt: '2026-09-16T00:00:02Z',
      },
      {
        ...node,
        status: 'pending',
        startedAt: '2026-09-16T00:00:00Z',
        finishedAt: null,
      },
    ];
    const result = workflowNodeVisits(node, history);
    expect(result.map((item) => [item.visit, item.status])).toEqual([
      [2, 'succeeded'],
      [1, 'waiting'],
    ]);
    expect(result[0]!.output).toEqual({ count: 2 });
    expect(result[1]!.startedAt).toBe('2026-09-16T00:00:00Z');
  });

  it('当前活动覆盖较早完成状态，定时器进入可选择节点', () => {
    const result = workflowRunNodeStates({
      ...run,
      nodes: [{ ...node, visit: 2, status: 'succeeded' }],
      activeActivities: [
        {
          nodeId: 'step',
          name: '执行',
          executionId: 'step_1',
          type: 'bpmn:ServiceTask',
        },
        {
          nodeId: 'timer',
          name: '等待',
          executionId: 'timer_1',
          type: 'bpmn:IntermediateCatchEvent',
        },
      ],
      transitions: [
        {
          elementId: 'start',
          event: 'activity.end',
          executionId: 'start_1',
          type: 'bpmn:StartEvent',
        },
      ],
    });
    expect(result).toEqual([
      { nodeId: 'start', status: 'succeeded' },
      { nodeId: 'step', status: 'waiting' },
      { nodeId: 'timer', status: 'waiting' },
    ]);
    expect(result[2]).not.toHaveProperty('visit');
  });

  it('终态不被旧活动快照重新画成等待，也不会把未选分支标成完成', () => {
    expect(
      workflowRunNodeStates({
        ...run,
        status: 'cancelled',
        nodes: [{ ...node, status: 'cancelled' }],
        activeActivities: [
          {
            nodeId: 'step',
            name: '执行',
            executionId: 'step_1',
            type: 'bpmn:ServiceTask',
          },
        ],
        transitions: [
          {
            elementId: 'unused',
            event: 'activity.discard',
            executionId: 'unused_1',
            type: 'bpmn:ServiceTask',
          },
        ],
      }),
    ).toEqual([
      { nodeId: 'unused', status: 'skipped' },
      { nodeId: 'step', status: 'cancelled' },
    ]);
  });
});
