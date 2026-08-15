import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'ion:settings-outline',
      order: 9997,
      title: $t('system.title'),
    },
    name: 'System',
    path: '/system',
    children: [
      {
        path: '/system/user',
        name: 'SystemUser',
        meta: {
          icon: 'mdi:account',
          title: $t('system.user.title'),
        },
        component: () => import('#/views/system/user/list'),
      },
      {
        path: '/system/role',
        name: 'SystemRole',
        meta: {
          icon: 'mdi:account-group',
          title: $t('system.role.title'),
        },
        component: () => import('#/views/system/role/list'),
      },
      {
        path: '/system/menu',
        name: 'SystemMenu',
        meta: {
          icon: 'mdi:menu',
          title: $t('system.menu.title'),
        },
        component: () => import('#/views/system/menu/list'),
      },
      {
        path: '/system/dict',
        name: 'SystemDict',
        meta: {
          icon: 'carbon:data-structured',
          title: $t('system.dict.title'),
        },
        component: () => import('#/views/system/dict/list'),
      },
      {
        path: '/system/dept',
        name: 'SystemDept',
        meta: {
          icon: 'charm:organisation',
          title: $t('system.dept.title'),
        },
        component: () => import('#/views/system/dept/list'),
      },
      {
        path: '/system/logs',
        name: 'SystemLog',
        meta: {
          icon: 'lucide:scroll-text',
          title: $t('system.log.title'),
        },
        component: () => import('#/views/system/log/list'),
      },
      {
        path: '/system/notice',
        name: 'SystemNotice',
        meta: {
          icon: 'mdi:bell-outline',
          title: $t('system.notice.title'),
        },
        component: () => import('#/views/system/notice/list'),
      },
      {
        path: '/system/network',
        name: 'SystemNetwork',
        meta: {
          icon: 'lucide:router',
          title: $t('system.network.title'),
        },
        component: () => import('#/views/system/network/list'),
      },
      {
        path: '/system/ktTableDemo',
        name: 'SystemKtTableDemo',
        meta: {
          icon: 'lucide:table-2',
          title: $t('system.ktTableDemo.title'),
        },
        component: () => import('#/views/system/ktTableDemo/list'),
      },
    ],
  },
];

export default routes;
