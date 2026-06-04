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
        component: () => import('#/views/system/user/list.vue'),
      },
      {
        path: '/system/role',
        name: 'SystemRole',
        meta: {
          icon: 'mdi:account-group',
          title: $t('system.role.title'),
        },
        component: () => import('#/views/system/role/list.vue'),
      },
      {
        path: '/system/menu',
        name: 'SystemMenu',
        meta: {
          icon: 'mdi:menu',
          title: $t('system.menu.title'),
        },
        component: () => import('#/views/system/menu/list.vue'),
      },
      {
        path: '/system/dict',
        name: 'SystemDict',
        meta: {
          icon: 'carbon:data-structured',
          title: $t('system.dict.title'),
        },
        component: () => import('#/views/system/dict/list.vue'),
      },
      {
        path: '/system/dept',
        name: 'SystemDept',
        meta: {
          icon: 'charm:organisation',
          title: $t('system.dept.title'),
        },
        component: () => import('#/views/system/dept/list.vue'),
      },
      {
        path: '/system/logs',
        name: 'SystemLog',
        meta: {
          icon: 'lucide:scroll-text',
          title: $t('system.log.title'),
        },
        component: () => import('#/views/system/log/list.vue'),
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
