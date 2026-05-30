import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:bot',
      order: 110,
      title: 'QQBot 管理',
    },
    name: 'QqBot',
    path: '/qqbot',
    redirect: '/qqbot/dashboard',
    children: [
      {
        component: () => import('#/views/qqbot/dashboard/list'),
        meta: {
          icon: 'lucide:gauge',
          title: '工作台',
        },
        name: 'QqBotDashboard',
        path: '/qqbot/dashboard',
      },
      {
        component: () => import('#/views/qqbot/account/list'),
        meta: {
          icon: 'lucide:radio-receiver',
          title: '账号连接',
        },
        name: 'QqBotAccount',
        path: '/qqbot/account',
      },
      {
        component: () => import('#/views/qqbot/rule/list'),
        meta: {
          icon: 'lucide:workflow',
          title: '自动回复规则',
        },
        name: 'QqBotRule',
        path: '/qqbot/rule',
      },
      {
        component: () => import('#/views/qqbot/conversation/list'),
        meta: {
          icon: 'lucide:messages-square',
          title: '会话管理',
        },
        name: 'QqBotConversation',
        path: '/qqbot/conversation',
      },
      {
        component: () => import('#/views/qqbot/message/list'),
        meta: {
          icon: 'lucide:message-square-text',
          title: '消息日志',
        },
        name: 'QqBotMessage',
        path: '/qqbot/message',
      },
      {
        component: () => import('#/views/qqbot/sendLog/list'),
        meta: {
          icon: 'lucide:send',
          title: '发送日志',
        },
        name: 'QqBotSendLog',
        path: '/qqbot/sendLog',
      },
      {
        component: () => import('#/views/qqbot/permission/list'),
        meta: {
          icon: 'lucide:shield-check',
          title: '权限名单',
        },
        name: 'QqBotPermission',
        path: '/qqbot/permission',
      },
    ],
  },
];

export default routes;
