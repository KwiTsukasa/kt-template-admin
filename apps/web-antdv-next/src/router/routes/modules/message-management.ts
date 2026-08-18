import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:messages-square',
      order: 109,
      title: '消息管理',
    },
    name: 'MessageManagement',
    path: '/message-management',
    redirect: '/message-management/subscription',
    children: [
      {
        component: () => import('#/views/message-management/template/list'),
        meta: {
          icon: 'lucide:message-square-plus',
          title: '消息模板',
        },
        name: 'MessageManagementTemplate',
        path: '/message-management/template',
      },
      {
        component: () => import('#/views/message-management/subscription/list'),
        meta: {
          icon: 'lucide:bell-ring',
          title: '消息订阅',
        },
        name: 'MessageManagementSubscription',
        path: '/message-management/subscription',
      },
      {
        component: () =>
          import('#/views/message-management/subscribers/station-notice/list'),
        meta: {
          icon: 'lucide:inbox',
          title: '站内信投递',
        },
        name: 'MessageManagementStationNoticeSubscriber',
        path: '/message-management/subscribers/station-notice',
      },
    ],
  },
];

export default routes;
