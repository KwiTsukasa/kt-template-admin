import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'Automation',
    path: '/automation',
    redirect: '/automation/workflows',
    meta: {
      title: '自动化中心',
      icon: 'lucide:workflow',
      order: 112,
      fullPathKey: false,
    },
    children: [
      {
        name: 'AutomationResources',
        path: '/automation/resources',
        meta: { title: '设计资源', icon: 'lucide:library' },
        children: [
          {
            name: 'AutomationForms',
            path: '/automation/forms',
            component: () => import('#/views/form-definition/list'),
            meta: {
              title: '表单',
              icon: 'lucide:panels-top-left',
            },
          },
          {
            name: 'AutomationRules',
            path: '/automation/rules',
            component: () => import('#/views/rule-engine/list'),
            meta: { title: '规则', icon: 'lucide:git-branch' },
          },
        ],
      },
      {
        name: 'AutomationSchedules',
        path: '/automation/schedules',
        component: () => import('#/views/task-scheduling/schedule/list'),
        meta: {
          title: '定时任务',
          icon: 'lucide:calendar-clock',
        },
      },
      {
        name: 'AutomationScheduleDesigner',
        path: '/automation/schedules/:scheduleId/designer',
        component: () => import('#/views/task-scheduling/schedule/designer'),
        meta: {
          title: '配置计划',
          hideInMenu: true,
          activePath: '/automation/schedules',
        },
      },
      {
        name: 'AutomationScheduleVersions',
        path: '/automation/schedules/:scheduleId/versions',
        component: () => import('#/views/task-scheduling/schedule/versions'),
        meta: {
          title: '计划版本',
          hideInMenu: true,
          activePath: '/automation/schedules',
        },
      },
      {
        name: 'AutomationScheduleControl',
        path: '/automation/schedules/:scheduleId/control',
        component: () => import('#/views/task-scheduling/schedule/control'),
        meta: {
          title: '启停与记录',
          hideInMenu: true,
          activePath: '/automation/schedules',
        },
      },
      {
        name: 'AutomationExecutions',
        path: '/automation/executions',
        component: () => import('#/views/automation-monitor/list'),
        meta: {
          title: '运行记录',
          icon: 'lucide:activity',
          hideInMenu: true,
        },
      },
      {
        name: 'AutomationTasks',
        path: '/automation/tasks',
        component: () => import('#/views/task-execution/list'),
        meta: {
          title: '执行动作',
          icon: 'lucide:box',
          hideInMenu: true,
          activePath: '/automation/schedules',
        },
      },
      {
        name: 'AutomationTaskDesigner',
        path: '/automation/tasks/:taskId/designer',
        component: () => import('#/views/task-execution/designer'),
        meta: {
          title: '执行配置',
          hideInMenu: true,
          activePath: '/automation/tasks',
        },
      },
      {
        name: 'AutomationTaskVersions',
        path: '/automation/tasks/:taskId/versions',
        component: () => import('#/views/task-execution/versions'),
        meta: {
          title: '任务版本',
          hideInMenu: true,
          activePath: '/automation/tasks',
        },
      },
      {
        name: 'AutomationTaskRun',
        path: '/automation/tasks/:taskId/runs/:runId',
        component: () => import('#/views/task-execution/run'),
        meta: {
          title: '任务运行',
          hideInMenu: true,
          activePath: '/automation/tasks',
        },
      },
      {
        name: 'AutomationTriggers',
        path: '/automation/triggers',
        component: () => import('#/views/trigger-engine/list'),
        meta: {
          title: '触发条件',
          icon: 'lucide:alarm-clock',
          hideInMenu: true,
          activePath: '/automation/schedules',
        },
      },
      {
        name: 'AutomationTriggerDesigner',
        path: '/automation/triggers/:triggerId/designer',
        component: () => import('#/views/trigger-engine/designer/index'),
        meta: {
          title: '配置触发器',
          hideInMenu: true,
          activePath: '/automation/triggers',
        },
      },
      {
        name: 'AutomationTriggerVersions',
        path: '/automation/triggers/:triggerId/versions',
        component: () => import('#/views/trigger-engine/versions'),
        meta: {
          title: '触发器版本',
          hideInMenu: true,
          activePath: '/automation/triggers',
        },
      },
      {
        name: 'AutomationTriggerActivity',
        path: '/automation/triggers/:triggerId/activity',
        component: () => import('#/views/trigger-engine/activity'),
        meta: {
          title: '触发记录',
          hideInMenu: true,
          activePath: '/automation/triggers',
        },
      },

      {
        name: 'AutomationRuleDesigner',
        path: '/automation/rules/:ruleId/designer',
        component: () => import('#/views/rule-engine/designer/index'),
        meta: {
          title: '设计规则',
          hideInMenu: true,
          activePath: '/automation/rules',
        },
      },
      {
        name: 'AutomationRuleVersions',
        path: '/automation/rules/:ruleId/versions',
        component: () => import('#/views/rule-engine/versions'),
        meta: {
          title: '规则版本',
          hideInMenu: true,
          activePath: '/automation/rules',
        },
      },

      {
        name: 'AutomationFormDesigner',
        path: '/automation/forms/:formId/designer',
        component: () => import('#/views/form-definition/designer/index'),
        meta: {
          title: '设计表单',
          hideInMenu: true,
          activePath: '/automation/forms',
        },
      },
      {
        name: 'AutomationFormPreview',
        path: '/automation/forms/:formId/preview',
        component: () => import('#/views/form-definition/preview'),
        meta: {
          title: '表单预览',
          hideInMenu: true,
          activePath: '/automation/forms',
        },
      },
      {
        name: 'AutomationFormVersions',
        path: '/automation/forms/:formId/versions',
        component: () => import('#/views/form-definition/versions'),
        meta: {
          title: '表单版本',
          hideInMenu: true,
          activePath: '/automation/forms',
        },
      },
      {
        name: 'AutomationWorkflows',
        path: '/automation/workflows',
        component: () => import('#/views/workflow-engine/list'),
        meta: { title: '工作流管理', icon: 'lucide:workflow' },
      },
      {
        name: 'AutomationWorkflowDesigner',
        path: '/automation/workflows/:workflowId/designer',
        component: () => import('#/views/workflow-engine/designer/index'),
        meta: {
          title: '工作流编排',
          hideInMenu: true,
          activePath: '/automation/workflows',
        },
      },
      {
        name: 'AutomationWorkflowVersions',
        path: '/automation/workflows/:workflowId/versions',
        component: () => import('#/views/workflow-engine/versions'),
        meta: {
          title: '工作流版本',
          hideInMenu: true,
          activePath: '/automation/workflows',
        },
      },
      {
        name: 'AutomationWorkflowDebugger',
        path: '/automation/workflows/:workflowId/runs/:runId',
        component: () => import('#/views/workflow-engine/debugger'),
        meta: {
          title: '流程运行',
          hideInMenu: true,
          activePath: '/automation/workflows',
        },
      },
    ],
  },
];

export default routes;
