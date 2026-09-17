export const WORKFLOW_RESOURCE = 'workflows';
export const WORKFLOW_PATH = `/automation/${WORKFLOW_RESOURCE}`;
export const WORKFLOW_ID_PARAM = 'workflowId';
export const WORKFLOW_PERMISSION = 'Automation:Workflow';

export const BPMN_FORMAT = 'bpmn20';
export const BPMN_NAMESPACE = 'https://kwitsukasa.top/schema/workflow/bpmn/1';
export const BPMN_STEP_IMPLEMENTATION = `${BPMN_NAMESPACE}/step`;
export const BPMN_EXPRESSION_LANGUAGE = `${BPMN_NAMESPACE}/expression`;
export const WORKFLOW_SCRIPT_PROTOCOL = 'kt.workflow.script.v1';

export const WORKFLOW_LIMITS = Object.freeze({
  defaultTimeoutMs: 300_000,
  runPollMs: 1000,
});

export const BPMN_LOOP_LIMITS = Object.freeze({
  initialCount: 3,
  maxInstances: 1000,
  maxIterations: 10_000,
});

export const SCRIPT_LIMITS = Object.freeze({
  sourceBytes: 256 * 1024,
  maxCalls: 16,
  maxAttempts: 5,
  minRetryMs: 1000,
  maxRetrySeconds: 3600,
});
export const MILLISECONDS_PER_SECOND = 1000;

export const WORKFLOW_BINDING_SOURCE_OPTIONS = [
  { label: '不传入', value: 'none' },
  { label: '固定值', value: 'literal' },
  { label: '流程输入', value: 'input' },
  { label: '上游输出', value: 'node' },
  { label: '优先取值', value: 'first' },
];
export const WORKFLOW_EXPRESSION_LIMITS = Object.freeze({
  depth: 16,
  operands: 32,
  prioritySources: 8,
});
export const WORKFLOW_EXPRESSION_CONTEXTS: ReadonlySet<string> = new Set([
  'content',
  'input',
  'outputs',
  'variables',
]);
export const WORKFLOW_EXPRESSION_SEGMENT = /^[\w-]+$/;
export const WORKFLOW_EXPRESSION_RESERVED_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);
