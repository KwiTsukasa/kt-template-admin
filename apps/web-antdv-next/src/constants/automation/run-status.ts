export const RUN_STATUS = {
  pending: 'pending',
  starting: 'starting',
  running: 'running',
  waiting: 'waiting',
  succeeded: 'succeeded',
  failed: 'failed',
  cancelled: 'cancelled',
  skipped: 'skipped',
  unconfirmed: 'unconfirmed',
} as const;

export const RUN_STATUS_LABELS: Readonly<Record<string, string>> = {
  [RUN_STATUS.pending]: '待执行',
  [RUN_STATUS.starting]: '正在发起',
  [RUN_STATUS.running]: '执行中',
  [RUN_STATUS.waiting]: '等待中',
  [RUN_STATUS.succeeded]: '成功',
  [RUN_STATUS.failed]: '失败',
  [RUN_STATUS.cancelled]: '已取消',
  [RUN_STATUS.skipped]: '已跳过',
  [RUN_STATUS.unconfirmed]: '待核对',
};
export const WORKFLOW_NODE_STATUS_LABELS: Readonly<Record<string, string>> = {
  ...RUN_STATUS_LABELS,
  [RUN_STATUS.skipped]: '未选分支',
};
export const TASK_STATUS_LABELS: Readonly<Record<string, string>> = {
  ...RUN_STATUS_LABELS,
  [RUN_STATUS.pending]: '等待执行',
  [RUN_STATUS.succeeded]: '已完成',
  [RUN_STATUS.failed]: '执行失败',
};
export const SCHEDULE_STATUS_LABELS: Readonly<Record<string, string>> = {
  ...TASK_STATUS_LABELS,
  [RUN_STATUS.pending]: '等待准入',
};
export const MONITOR_STATUS_LABELS: Readonly<Record<string, string>> = {
  ...RUN_STATUS_LABELS,
  [RUN_STATUS.waiting]: '等待唤醒',
};
export const WORKFLOW_NODE_STATUS_COLORS: Readonly<Record<string, string>> = {
  [RUN_STATUS.succeeded]: 'success',
  [RUN_STATUS.failed]: 'error',
  [RUN_STATUS.waiting]: 'processing',
  [RUN_STATUS.running]: 'processing',
  [RUN_STATUS.unconfirmed]: 'warning',
};
export const WORKFLOW_RUN_STATUS_COLORS: Readonly<Record<string, string>> = {
  ...WORKFLOW_NODE_STATUS_COLORS,
  [RUN_STATUS.pending]: 'default',
  [RUN_STATUS.waiting]: 'cyan',
  [RUN_STATUS.skipped]: 'default',
  [RUN_STATUS.cancelled]: 'default',
};

export const RUN_STATUS_GROUP = {
  workflowOpen: [
    RUN_STATUS.pending,
    RUN_STATUS.running,
    RUN_STATUS.waiting,
  ] as readonly string[],
  taskOpen: [RUN_STATUS.pending, RUN_STATUS.running] as readonly string[],
  activityOpen: [RUN_STATUS.pending, RUN_STATUS.waiting] as readonly string[],
  terminal: [
    RUN_STATUS.succeeded,
    RUN_STATUS.failed,
    RUN_STATUS.cancelled,
  ] as readonly string[],
  settled: [RUN_STATUS.succeeded, RUN_STATUS.failed] as readonly string[],
  executingScript: [
    RUN_STATUS.running,
    RUN_STATUS.unconfirmed,
  ] as readonly string[],
  unsuccessful: [RUN_STATUS.failed, RUN_STATUS.cancelled] as readonly string[],
  occurrenceOpen: [
    RUN_STATUS.pending,
    RUN_STATUS.starting,
    RUN_STATUS.running,
  ] as readonly string[],
  occurrenceDispatchable: [
    RUN_STATUS.pending,
    RUN_STATUS.starting,
  ] as readonly string[],
  occurrenceLaunched: [
    RUN_STATUS.starting,
    RUN_STATUS.running,
  ] as readonly string[],
} as const;
