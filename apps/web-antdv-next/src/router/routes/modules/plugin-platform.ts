import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:blocks',
      order: 111,
      title: '插件平台',
    },
    name: 'PluginPlatform',
    path: '/plugin-platform',
    redirect: '/plugin-platform/plugins',
    children: [
      {
        component: () => import('#/views/plugin-platform/plugin/list'),
        meta: {
          icon: 'lucide:plug',
          title: '插件管理',
        },
        name: 'PluginPlatformPlugins',
        path: '/plugin-platform/plugins',
      },
      {
        component: () => import('#/views/plugin-platform/task/list'),
        meta: {
          icon: 'lucide:calendar-clock',
          title: '定时任务',
        },
        name: 'PluginPlatformTasks',
        path: '/plugin-platform/tasks',
      },
    ],
  },
];

export default routes;
