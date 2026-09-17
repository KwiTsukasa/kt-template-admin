import type { RouteRecordRaw } from 'vue-router';

import { AUTOMATION_MENU } from '#/constants/automation/menu';
import { AUTOMATION_PATH } from '#/constants/automation/resources';

const routes: RouteRecordRaw[] = [
  {
    name: AUTOMATION_MENU.root,
    path: '/automation',
    redirect: AUTOMATION_PATH.workflows,
    meta: {
      title: '自动化中心',
      icon: 'lucide:workflow',
      order: 112,
      fullPathKey: false,
    },
    children: [
      {
        name: AUTOMATION_MENU.resources,
        path: AUTOMATION_PATH.resources,
        meta: { title: '设计资源', icon: 'lucide:library' },
        children: [
          {
            name: AUTOMATION_MENU.forms,
            path: AUTOMATION_PATH.forms,
            component: () => import('#/views/form-definition/list'),
            meta: {
              title: '表单',
              icon: 'lucide:panels-top-left',
            },
          },
          {
            name: AUTOMATION_MENU.rules,
            path: AUTOMATION_PATH.rules,
            component: () => import('#/views/rule-engine/list'),
            meta: { title: '规则', icon: 'lucide:git-branch' },
          },
        ],
      },
      {
        name: AUTOMATION_MENU.schedules,
        path: AUTOMATION_PATH.schedules,
        component: () => import('#/views/task-scheduling/schedule/list'),
        meta: {
          title: '定时任务',
          icon: 'lucide:calendar-clock',
        },
      },
      {
        name: AUTOMATION_MENU.scheduleDesigner,
        path: `${AUTOMATION_PATH.schedules}/:scheduleId/designer`,
        component: () => import('#/views/task-scheduling/schedule/designer'),
        meta: {
          title: '配置计划',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.schedules,
        },
      },
      {
        name: AUTOMATION_MENU.scheduleVersions,
        path: `${AUTOMATION_PATH.schedules}/:scheduleId/versions`,
        component: () => import('#/views/task-scheduling/schedule/versions'),
        meta: {
          title: '计划版本',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.schedules,
        },
      },
      {
        name: AUTOMATION_MENU.scheduleControl,
        path: `${AUTOMATION_PATH.schedules}/:scheduleId/control`,
        component: () => import('#/views/task-scheduling/schedule/control'),
        meta: {
          title: '启停与记录',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.schedules,
        },
      },
      {
        name: AUTOMATION_MENU.executions,
        path: AUTOMATION_PATH.executions,
        component: () => import('#/views/automation-monitor/list'),
        meta: {
          title: '运行记录',
          icon: 'lucide:activity',
          hideInMenu: true,
        },
      },
      {
        name: AUTOMATION_MENU.tasks,
        path: AUTOMATION_PATH.tasks,
        component: () => import('#/views/task-execution/list'),
        meta: {
          title: '执行动作',
          icon: 'lucide:box',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.schedules,
        },
      },
      {
        name: AUTOMATION_MENU.taskDesigner,
        path: `${AUTOMATION_PATH.tasks}/:taskId/designer`,
        component: () => import('#/views/task-execution/designer'),
        meta: {
          title: '执行配置',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.tasks,
        },
      },
      {
        name: AUTOMATION_MENU.taskVersions,
        path: `${AUTOMATION_PATH.tasks}/:taskId/versions`,
        component: () => import('#/views/task-execution/versions'),
        meta: {
          title: '任务版本',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.tasks,
        },
      },
      {
        name: AUTOMATION_MENU.taskRun,
        path: `${AUTOMATION_PATH.tasks}/:taskId/runs/:runId`,
        component: () => import('#/views/task-execution/run'),
        meta: {
          title: '任务运行',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.tasks,
        },
      },
      {
        name: AUTOMATION_MENU.triggers,
        path: AUTOMATION_PATH.triggers,
        component: () => import('#/views/trigger-engine/list'),
        meta: {
          title: '触发条件',
          icon: 'lucide:alarm-clock',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.schedules,
        },
      },
      {
        name: AUTOMATION_MENU.triggerDesigner,
        path: `${AUTOMATION_PATH.triggers}/:triggerId/designer`,
        component: () => import('#/views/trigger-engine/designer/index'),
        meta: {
          title: '配置触发器',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.triggers,
        },
      },
      {
        name: AUTOMATION_MENU.triggerVersions,
        path: `${AUTOMATION_PATH.triggers}/:triggerId/versions`,
        component: () => import('#/views/trigger-engine/versions'),
        meta: {
          title: '触发器版本',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.triggers,
        },
      },
      {
        name: AUTOMATION_MENU.triggerActivity,
        path: `${AUTOMATION_PATH.triggers}/:triggerId/activity`,
        component: () => import('#/views/trigger-engine/activity'),
        meta: {
          title: '触发记录',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.triggers,
        },
      },

      {
        name: AUTOMATION_MENU.ruleDesigner,
        path: `${AUTOMATION_PATH.rules}/:ruleId/designer`,
        component: () => import('#/views/rule-engine/designer/index'),
        meta: {
          title: '设计规则',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.rules,
        },
      },
      {
        name: AUTOMATION_MENU.ruleVersions,
        path: `${AUTOMATION_PATH.rules}/:ruleId/versions`,
        component: () => import('#/views/rule-engine/versions'),
        meta: {
          title: '规则版本',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.rules,
        },
      },

      {
        name: AUTOMATION_MENU.formDesigner,
        path: `${AUTOMATION_PATH.forms}/:formId/designer`,
        component: () => import('#/views/form-definition/designer/index'),
        meta: {
          title: '设计表单',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.forms,
        },
      },
      {
        name: AUTOMATION_MENU.formPreview,
        path: `${AUTOMATION_PATH.forms}/:formId/preview`,
        component: () => import('#/views/form-definition/preview'),
        meta: {
          title: '表单预览',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.forms,
        },
      },
      {
        name: AUTOMATION_MENU.formVersions,
        path: `${AUTOMATION_PATH.forms}/:formId/versions`,
        component: () => import('#/views/form-definition/versions'),
        meta: {
          title: '表单版本',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.forms,
        },
      },
      {
        name: AUTOMATION_MENU.workflows,
        path: AUTOMATION_PATH.workflows,
        component: () => import('#/views/workflow-engine/list'),
        meta: { title: '工作流管理', icon: 'lucide:workflow' },
      },
      {
        name: AUTOMATION_MENU.workflowDesigner,
        path: `${AUTOMATION_PATH.workflows}/:workflowId/designer`,
        component: () => import('#/views/workflow-engine/designer/index'),
        meta: {
          title: '工作流编排',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.workflows,
        },
      },
      {
        name: AUTOMATION_MENU.workflowVersions,
        path: `${AUTOMATION_PATH.workflows}/:workflowId/versions`,
        component: () => import('#/views/workflow-engine/versions'),
        meta: {
          title: '工作流版本',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.workflows,
        },
      },
      {
        name: AUTOMATION_MENU.workflowDebugger,
        path: `${AUTOMATION_PATH.workflows}/:workflowId/runs/:runId`,
        component: () => import('#/views/workflow-engine/debugger'),
        meta: {
          title: '流程运行',
          hideInMenu: true,
          activePath: AUTOMATION_PATH.workflows,
        },
      },
    ],
  },
];

export default routes;
