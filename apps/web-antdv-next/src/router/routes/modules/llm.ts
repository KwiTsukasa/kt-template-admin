import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    children: [
      {
        component: () => import('#/views/llm/coordination/index'),
        meta: {
          fullPathKey: false,
          icon: 'lucide:workflow',
          title: '工作流协调中心',
        },
        name: 'WorkflowCoordination',
        path: '/llm/coordination',
      },
      {
        component: () => import('#/views/llm/config/index'),
        meta: {
          icon: 'lucide:blocks',
          title: '大模型配置',
        },
        name: 'LlmConfig',
        path: '/llm/config',
      },
      {
        component: () => import('#/views/llm/chat/index'),
        meta: {
          activePath: '/llm/config',
          fullPathKey: false,
          hideInMenu: true,
          keepAlive: true,
          title: '流式对话',
        },
        name: 'LlmChat',
        path: '/llm/config/:configId/chat',
      },
    ],
    meta: {
      icon: 'lucide:brain-circuit',
      order: 115,
      title: '大模型',
    },
    name: 'Llm',
    path: '/llm',
    redirect: '/llm/config',
  },
];

export default routes;
