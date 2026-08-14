import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import ts from 'typescript';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestClientGet = vi.fn();

const messagePushMenuNames = [
  'QqBotMessageSubscription',
  'QqBotMessageTemplate',
  'QqBotMessageSubscriptionList',
  'QqBotMessageSubscriptionCreate',
  'QqBotMessageSubscriptionUpdate',
  'QqBotMessageSubscriptionDelete',
  'QqBotMessageSubscriptionToggle',
  'QqBotMessageTemplateList',
  'QqBotMessageTemplateCreate',
  'QqBotMessageTemplateUpdate',
  'QqBotMessageTemplateDelete',
  'QqBotMessageTemplateToggle',
  'QqBotMessageTemplatePreview',
  'QqBotAccountMessagePushList',
  'QqBotAccountMessagePushCreate',
  'QqBotAccountMessagePushUpdate',
  'QqBotAccountMessagePushDelete',
  'QqBotAccountMessagePushToggle',
];

const mediaGovernanceMenuNames = [
  'MediaGovernance',
  'MediaGovernanceTasks',
  'MediaGovernanceAgentQueue',
  'MediaGovernanceTaskList',
  'MediaGovernanceTaskCreate',
  'MediaGovernanceSourceUpload',
  'MediaGovernanceDownload',
  'MediaGovernanceRun',
  'MediaGovernanceAgentStart',
  'MediaGovernanceAgentOperate',
  'MediaGovernanceOperatorDecision',
  'MediaGovernanceEvidence',
];

function getSupportedAdminMenuNameLiterals() {
  const sourceFile = ts.createSourceFile(
    'menu.ts',
    readFileSync(resolve('apps/web-antdv-next/src/api/core/menu.ts'), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = sourceFile.statements
    .filter((statement) => ts.isVariableStatement(statement))
    .flatMap((statement) => statement.declarationList.declarations)
    .find(
      (candidate) =>
        ts.isIdentifier(candidate.name) &&
        candidate.name.text === 'SUPPORTED_ADMIN_MENU_NAMES',
    );

  expect(declaration?.initializer).toSatisfy(ts.isNewExpression);

  const initializer = declaration?.initializer as ts.NewExpression;
  expect(initializer.expression).toSatisfy(
    (expression: ts.Expression) =>
      ts.isIdentifier(expression) && expression.text === 'Set',
  );
  expect(initializer.arguments).toHaveLength(1);
  expect(initializer.arguments?.[0]).toSatisfy(ts.isArrayLiteralExpression);

  const elements = (initializer.arguments?.[0] as ts.ArrayLiteralExpression)
    .elements;
  expect(elements.every((element) => ts.isStringLiteral(element))).toBe(true);

  return elements.map((element) => (element as ts.StringLiteral).text);
}

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

    const { getAllMenusApi } =
      await import('@test-source/apps/web-antdv-next/src/api/core/menu');
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

    const { getAllMenusApi } =
      await import('@test-source/apps/web-antdv-next/src/api/core/menu');
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

    const { getAllMenusApi } =
      await import('@test-source/apps/web-antdv-next/src/api/core/menu');
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
              {
                name: 'SystemNetworkDdnsList',
                authCode: 'System:Network:Ddns:List',
                type: 'button',
              },
              {
                name: 'SystemNetworkDdnsCreate',
                authCode: 'System:Network:Ddns:Create',
                type: 'button',
              },
              {
                name: 'SystemNetworkDdnsUpdate',
                authCode: 'System:Network:Ddns:Update',
                type: 'button',
              },
              {
                name: 'SystemNetworkDdnsDelete',
                authCode: 'System:Network:Ddns:Delete',
                type: 'button',
              },
              {
                name: 'SystemNetworkDdnsRetry',
                authCode: 'System:Network:Ddns:Retry',
                type: 'button',
              },
            ],
          },
        ],
      },
    ]);

    const { getAllMenusApi } =
      await import('@test-source/apps/web-antdv-next/src/api/core/menu');
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
              {
                name: 'SystemNetworkDdnsList',
                authCode: 'System:Network:Ddns:List',
                type: 'button',
              },
              {
                name: 'SystemNetworkDdnsCreate',
                authCode: 'System:Network:Ddns:Create',
                type: 'button',
              },
              {
                name: 'SystemNetworkDdnsUpdate',
                authCode: 'System:Network:Ddns:Update',
                type: 'button',
              },
              {
                name: 'SystemNetworkDdnsDelete',
                authCode: 'System:Network:Ddns:Delete',
                type: 'button',
              },
              {
                name: 'SystemNetworkDdnsRetry',
                authCode: 'System:Network:Ddns:Retry',
                type: 'button',
              },
            ],
          },
        ],
      },
    ]);
  });

  it('keeps every supported message-push menu name once while filtering unknown nodes', async () => {
    requestClientGet.mockResolvedValue([
      {
        name: 'QqBot',
        path: '/qqbot',
        children: [
          {
            name: 'QqBotAccount',
            path: '/qqbot/account',
          },
          ...messagePushMenuNames.map((name) => ({
            authCode: `QqBot:${name}`,
            name,
            type: 'button',
          })),
          {
            name: 'UnsupportedMessagePushNode',
            type: 'button',
          },
        ],
      },
    ]);

    const { getAllMenusApi } =
      await import('@test-source/apps/web-antdv-next/src/api/core/menu');
    const menus = await getAllMenusApi();
    const qqbot = menus.find((menu) => menu.name === 'QqBot');
    const retainedNames = qqbot?.children?.map((child) => child.name) ?? [];

    expect(retainedNames).toEqual(['QqBotAccount', ...messagePushMenuNames]);
    expect(new Set(retainedNames).size).toBe(retainedNames.length);
    expect(retainedNames).not.toContain('UnsupportedMessagePushNode');
  });

  it('keeps the complete media governance menu and action permission tree', async () => {
    requestClientGet.mockResolvedValue([
      {
        name: 'MediaGovernance',
        path: '/media/governance',
        redirect: '/media/governance/tasks',
        children: [
          {
            name: 'MediaGovernanceTasks',
            path: '/media/governance/tasks',
            component: '/media/governance/tasks/list',
            children: mediaGovernanceMenuNames.slice(3).map((name) => ({
              authCode: `Media:Governance:${name}`,
              name,
              type: 'button',
            })),
          },
          {
            name: 'MediaGovernanceAgentQueue',
            path: '/media/governance/agent-queue',
            component: '/media/governance/agent-queue/list',
          },
          {
            name: 'UnsupportedMediaGovernanceNode',
            type: 'button',
          },
        ],
      },
    ]);

    const { getAllMenusApi } =
      await import('@test-source/apps/web-antdv-next/src/api/core/menu');
    const menus = await getAllMenusApi();
    const mediaGovernance = menus.find(
      (menu) => menu.name === 'MediaGovernance',
    );
    const taskMenu = mediaGovernance?.children?.find(
      (menu) => menu.name === 'MediaGovernanceTasks',
    );

    expect(mediaGovernance?.children?.map((menu) => menu.name)).toEqual([
      'MediaGovernanceTasks',
      'MediaGovernanceAgentQueue',
    ]);
    expect(taskMenu?.children?.map((menu) => menu.name)).toEqual(
      mediaGovernanceMenuNames.slice(3),
    );
  });

  it('declares every locked message-push menu literal exactly once', () => {
    const literals = getSupportedAdminMenuNameLiterals();

    expect(new Set(literals).size).toBe(literals.length);

    for (const name of messagePushMenuNames) {
      expect(literals.filter((literal) => literal === name)).toHaveLength(1);
    }
  });

  it('declares every media governance menu literal exactly once', () => {
    const literals = getSupportedAdminMenuNameLiterals();

    expect(new Set(literals).size).toBe(literals.length);

    for (const name of mediaGovernanceMenuNames) {
      expect(literals.filter((literal) => literal === name)).toHaveLength(1);
    }
  });
});
