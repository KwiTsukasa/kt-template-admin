import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    children: [
      {
        component: () => import('#/views/media/governance/tasks/list'),
        meta: {
          icon: 'lucide:clapperboard',
          title: '任务草稿',
        },
        name: 'MediaGovernanceTasks',
        path: '/media/governance/tasks',
      },
      {
        component: () => import('#/views/media/governance/tasks/detail'),
        meta: {
          hideInMenu: true,
          title: '媒体治理任务详情',
        },
        name: 'MediaGovernanceTaskDetail',
        path: '/media/governance/tasks/:taskId',
      },
      {
        component: () => import('#/views/media/governance/agent-queue/list'),
        meta: {
          icon: 'lucide:bot',
          title: 'Agent 治理队列',
        },
        name: 'MediaGovernanceAgentQueue',
        path: '/media/governance/agent-queue',
      },
    ],
    meta: {
      authority: ['super'],
      icon: 'lucide:folder-cog',
      order: 120,
      title: '媒体治理',
    },
    name: 'MediaGovernance',
    path: '/media/governance',
    redirect: '/media/governance/tasks',
  },
];

export default routes;
