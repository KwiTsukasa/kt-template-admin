import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestClientGet = vi.fn();

vi.mock('#/api/request', () => ({
  requestClient: {
    get: requestClientGet,
  },
}));

describe('core menu api', () => {
  beforeEach(() => {
    requestClientGet.mockReset();
  });

  it('keeps supported dashboard routes from backend menus', async () => {
    requestClientGet.mockResolvedValue([
      {
        name: 'Dashboard',
        path: '/dashboard',
        redirect: '/analytics',
        children: [
          {
            name: 'Analytics',
            path: '/analytics',
            component: '/dashboard/analytics/index',
          },
        ],
      },
      {
        name: 'Unsupported',
        path: '/unsupported',
        component: '/unsupported/index',
      },
      {
        name: 'QqBot',
        path: '/qqbot',
        children: [
          {
            name: 'QqBotAccount',
            path: '/qqbot/account',
            component: '/qqbot/account/list',
            children: [
              {
                name: 'QqBotAccountWebUI',
                authCode: 'QqBot:Account:WebUI',
                type: 'button',
              },
            ],
          },
          {
            name: 'QqBotAccountNapcatWebui',
            path: '/qqbot/account/:accountId/napcat-webui',
            component: '/qqbot/account/napcat-webui/index',
            meta: {
              activePath: '/qqbot/account',
              hideInMenu: true,
              title: 'NapCat WebUI',
            },
          },
        ],
      },
    ]);

    const { getAllMenusApi } = await import('./menu');
    const menus = await getAllMenusApi();

    expect(requestClientGet).toHaveBeenCalledWith('/menu/all');
    expect(menus).toEqual([
      {
        name: 'Dashboard',
        path: '/dashboard',
        redirect: '/analytics',
        children: [
          {
            name: 'Analytics',
            path: '/analytics',
            component: '/dashboard/analytics/index',
          },
        ],
      },
      {
        name: 'QqBot',
        path: '/qqbot',
        children: [
          {
            name: 'QqBotAccount',
            path: '/qqbot/account',
            component: '/qqbot/account/list',
            children: [
              {
                name: 'QqBotAccountWebUI',
                authCode: 'QqBot:Account:WebUI',
                type: 'button',
              },
            ],
          },
          {
            name: 'QqBotAccountNapcatWebui',
            path: '/qqbot/account/:accountId/napcat-webui',
            component: '/qqbot/account/napcat-webui/index',
            meta: {
              activePath: '/qqbot/account',
              hideInMenu: true,
              title: 'NapCat WebUI',
            },
          },
        ],
      },
    ]);
  });

  it('uses backend sort as the authoritative menu order before menu generation', async () => {
    requestClientGet.mockResolvedValue([
      {
        name: 'Dashboard',
        path: '/dashboard',
        sort: 200,
        meta: {
          order: -1,
          title: 'Dashboard',
        },
      },
      {
        name: 'QqBot',
        path: '/qqbot',
        sort: 1,
        meta: {
          title: 'QQBot',
        },
        children: [
          {
            name: 'QqBotAccount',
            path: '/qqbot/account',
            component: '/qqbot/account/list',
            sort: 1,
            meta: {
              title: '账号连接',
            },
          },
        ],
      },
      {
        name: 'Blog',
        path: '/blog',
        sort: 0,
        meta: {
          order: 100,
          title: '博客管理',
        },
      },
    ]);

    const { getAllMenusApi } = await import('./menu');
    const menus = await getAllMenusApi();

    expect(menus.map((menu) => menu.meta?.order)).toEqual([200, 1, 0]);
    expect(menus[1]?.children?.[0]?.meta?.order).toBe(1);
  });

  it('keeps blog article preview hidden route and row action permission from backend menus', async () => {
    requestClientGet.mockResolvedValue([
      {
        name: 'Blog',
        path: '/blog',
        children: [
          {
            name: 'BlogArticle',
            path: '/blog/article',
            component: '/blog/article/list',
            children: [
              {
                name: 'BlogArticlePreviewButton',
                authCode: 'Blog:Article:Preview',
                type: 'button',
              },
            ],
          },
          {
            name: 'BlogArticlePreview',
            path: '/blog/article/:articleId/preview',
            component: '/blog/article/preview/index',
            meta: {
              activePath: '/blog/article',
              hideInMenu: true,
              title: '文章预览',
            },
          },
        ],
      },
    ]);

    const { getAllMenusApi } = await import('./menu');
    const menus = await getAllMenusApi();

    expect(menus).toEqual([
      {
        name: 'Blog',
        path: '/blog',
        children: [
          {
            name: 'BlogArticle',
            path: '/blog/article',
            component: '/blog/article/list',
            children: [
              {
                name: 'BlogArticlePreviewButton',
                authCode: 'Blog:Article:Preview',
                type: 'button',
              },
            ],
          },
          {
            name: 'BlogArticlePreview',
            path: '/blog/article/:articleId/preview',
            component: '/blog/article/preview/index',
            meta: {
              activePath: '/blog/article',
              hideInMenu: true,
              title: '文章预览',
            },
          },
        ],
      },
    ]);
  });

  it('keeps generic network management under System with scoped actions', async () => {
    requestClientGet.mockResolvedValue([
      {
        name: 'System',
        path: '/system',
        children: [
          {
            name: 'SystemNetwork',
            path: '/system/network',
            component: '/system/network/list',
            children: [
              {
                name: 'SystemNetworkPortForwardList',
                authCode: 'System:Network:PortForward:List',
                type: 'button',
              },
              {
                name: 'SystemNetworkPortForwardCreate',
                authCode: 'System:Network:PortForward:Create',
                type: 'button',
              },
              {
                name: 'SystemNetworkPortForwardUpdate',
                authCode: 'System:Network:PortForward:Update',
                type: 'button',
              },
              {
                name: 'SystemNetworkPortForwardDelete',
                authCode: 'System:Network:PortForward:Delete',
                type: 'button',
              },
              {
                name: 'SystemNetworkPortForwardRetry',
                authCode: 'System:Network:PortForward:Retry',
                type: 'button',
              },
              {
                name: 'SystemNetworkPortForwardKeeper',
                authCode: 'System:Network:PortForward:Keeper',
                type: 'button',
              },
              {
                name: 'SystemNetworkPortForwardProbe',
                authCode: 'System:Network:PortForward:Probe',
                type: 'button',
              },
              {
                name: 'SystemNetworkPortForwardHistory',
                authCode: 'System:Network:PortForward:History',
                type: 'button',
              },
            ],
          },
        ],
      },
    ]);

    const { getAllMenusApi } = await import('./menu');
    const menus = await getAllMenusApi();

    expect(menus).toEqual([
      {
        name: 'System',
        path: '/system',
        children: [
          {
            name: 'SystemNetwork',
            path: '/system/network',
            component: '/system/network/list',
            children: [
              {
                name: 'SystemNetworkPortForwardList',
                authCode: 'System:Network:PortForward:List',
                type: 'button',
              },
              {
                name: 'SystemNetworkPortForwardCreate',
                authCode: 'System:Network:PortForward:Create',
                type: 'button',
              },
              {
                name: 'SystemNetworkPortForwardUpdate',
                authCode: 'System:Network:PortForward:Update',
                type: 'button',
              },
              {
                name: 'SystemNetworkPortForwardDelete',
                authCode: 'System:Network:PortForward:Delete',
                type: 'button',
              },
              {
                name: 'SystemNetworkPortForwardRetry',
                authCode: 'System:Network:PortForward:Retry',
                type: 'button',
              },
              {
                name: 'SystemNetworkPortForwardKeeper',
                authCode: 'System:Network:PortForward:Keeper',
                type: 'button',
              },
              {
                name: 'SystemNetworkPortForwardProbe',
                authCode: 'System:Network:PortForward:Probe',
                type: 'button',
              },
              {
                name: 'SystemNetworkPortForwardHistory',
                authCode: 'System:Network:PortForward:History',
                type: 'button',
              },
            ],
          },
        ],
      },
    ]);
  });
});
