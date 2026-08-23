import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    children: [
      {
        component: () => import('#/views/media/governance/series/list'),
        meta: {
          icon: 'lucide:library-big',
          title: '系列资料库',
        },
        name: 'MediaGovernanceSeries',
        path: '/media/governance/series',
      },
      {
        component: () => import('#/views/media/governance/series/detail'),
        meta: {
          hideInMenu: true,
          title: '媒体系列详情',
        },
        name: 'MediaGovernanceSeriesDetail',
        path: '/media/governance/series/:seriesId',
      },
      {
        component: () => import('#/views/media/governance/tasks/list'),
        meta: {
          icon: 'lucide:clapperboard',
          title: '执行任务',
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
        component: () => import('#/views/media/governance/agent-session'),
        meta: {
          hideInMenu: true,
          hideInTab: true,
          title: 'CodexAgent 治理会话',
        },
        name: 'MediaGovernanceAgentSession',
        path: '/media/governance/tasks/:taskId/agent',
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
    redirect: '/media/governance/series',
  },
];

export default routes;
