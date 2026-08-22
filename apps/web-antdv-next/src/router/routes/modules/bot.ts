import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:bot',
      order: 110,
      title: 'Bot 管理',
    },
    name: 'Bot',
    path: '/bot',
    redirect: '/bot/dashboard',
    children: [
      {
        component: () => import('#/views/bot/dashboard/list'),
        meta: {
          icon: 'lucide:gauge',
          title: '工作台',
        },
        name: 'BotDashboard',
        path: '/bot/dashboard',
      },
      {
        component: () => import('#/views/bot/account/list'),
        meta: {
          icon: 'lucide:radio-receiver',
          title: 'NapCat 连接',
        },
        name: 'BotNapcatConnection',
        path: '/bot/napcat',
      },
      {
        component: () => import('#/views/bot/account/config'),
        meta: {
          activePath: '/bot/napcat',
          hideInMenu: true,
          title: 'NapCat 功能配置',
        },
        name: 'BotNapcatConfig',
        path: '/bot/napcat/config',
      },
      {
        component: () => import('#/views/bot/account/napcat-webui'),
        meta: {
          activePath: '/bot/napcat',
          hideInMenu: true,
          title: 'NapCat WebUI',
        },
        name: 'BotNapcatWebui',
        path: '/bot/napcat/:accountId/webui',
      },
      {
        component: () => import('#/views/bot/tencent/list'),
        meta: {
          icon: 'lucide:cloud-cog',
          title: 'Tencent 连接',
        },
        name: 'BotTencentConnection',
        path: '/bot/tencent',
      },
      {
        component: () => import('#/views/bot/rule/list'),
        meta: {
          icon: 'lucide:workflow',
          title: '自动回复规则',
        },
        name: 'BotRule',
        path: '/bot/rule',
      },
      {
        component: () => import('#/views/bot/command/list'),
        meta: {
          icon: 'lucide:square-terminal',
          title: '在线命令',
        },
        name: 'BotCommand',
        path: '/bot/command',
      },
      {
        component: () => import('#/views/bot/conversation/list'),
        meta: {
          icon: 'lucide:messages-square',
          title: '会话管理',
        },
        name: 'BotConversation',
        path: '/bot/conversation',
      },
      {
        component: () => import('#/views/bot/message/list'),
        meta: {
          icon: 'lucide:message-square-text',
          title: '消息日志',
        },
        name: 'BotMessage',
        path: '/bot/message',
      },
      {
        component: () => import('#/views/bot/send-log/list'),
        meta: {
          icon: 'lucide:send',
          title: '发送日志',
        },
        name: 'BotSendLog',
        path: '/bot/send-log',
      },
      {
        component: () => import('#/views/bot/permission/list'),
        meta: {
          icon: 'lucide:shield-check',
          title: '权限名单',
        },
        name: 'BotPermission',
        path: '/bot/permission',
      },
    ],
  },
];

export default routes;
