import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:newspaper',
      order: 100,
      title: '博客管理',
    },
    name: 'Blog',
    path: '/blog',
    redirect: '/blog/article',
    children: [
      {
        component: () => import('#/views/blog/article/list'),
        meta: {
          icon: 'lucide:file-text',
          title: '文章管理',
        },
        name: 'BlogArticle',
        path: '/blog/article',
      },
      {
        component: () => import('#/views/blog/category/list'),
        meta: {
          icon: 'lucide:folder-tree',
          title: '分类管理',
        },
        name: 'BlogCategory',
        path: '/blog/category',
      },
      {
        component: () => import('#/views/blog/tag/list'),
        meta: {
          icon: 'lucide:tags',
          title: '标签管理',
        },
        name: 'BlogTag',
        path: '/blog/tag',
      },
    ],
  },
];

export default routes;
