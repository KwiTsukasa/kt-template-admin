export const AUTOMATION_PATH = {
  workflows: '/automation/workflows',
  forms: '/automation/forms',
  rules: '/automation/rules',
  tasks: '/automation/tasks',
  schedules: '/automation/schedules',
  triggers: '/automation/triggers',
  executions: '/automation/executions',
  resources: '/automation/resources',
} as const;

export const AUTOMATION_PERMISSION = {
  monitorList: 'Automation:Monitor:List',
  scheduleControl: 'Automation:Schedule:Control',
  scheduleList: 'Automation:Schedule:List',
  scheduleRun: 'Automation:Schedule:Run',
  taskList: 'Automation:Task:List',
  taskReview: 'Automation:Task:Review',
  triggerList: 'Automation:Trigger:List',
  workflowCancel: 'Automation:Workflow:Cancel',
  workflowEdit: 'Automation:Workflow:Edit',
} as const;
