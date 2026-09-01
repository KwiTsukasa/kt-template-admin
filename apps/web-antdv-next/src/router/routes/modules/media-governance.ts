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
        component: () => import('#/views/media/scrape-validation/list'),
        meta: {
          icon: 'lucide:scan-search',
          title: 'NAS 刮削校验',
        },
        name: 'MediaScrapeValidation',
        path: '/media/scrape-validation',
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
