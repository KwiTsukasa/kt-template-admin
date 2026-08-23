import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import ts from 'typescript';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestClientGet = vi.fn();

const messagePushMenuNames = [
  'BotAccountMessagePushList',
  'BotAccountMessagePushCreate',
  'BotAccountMessagePushUpdate',
  'BotAccountMessagePushDelete',
  'BotAccountMessagePushToggle',
];

const mediaGovernanceMenuNames = [
  'MediaGovernance',
  'MediaGovernanceSeries',
  'MediaGovernanceSeriesDetail',
  'MediaGovernanceTasks',
  'MediaGovernanceAgentQueue',
  'MediaGovernanceAgentSession',
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

const messageManagementMenuNames = [
  'MessageManagement',
  'MessageManagementTemplate',
  'MessageManagementSubscription',
  'MessageManagementStationNoticeSubscriber',
  'MessageManagementSubscriptionList',
  'MessageManagementSubscriptionCreate',
  'MessageManagementSubscriptionUpdate',
  'MessageManagementSubscriptionDelete',
  'MessageManagementSubscriptionToggle',
  'MessageManagementTemplateList',
  'MessageManagementTemplateCreate',
  'MessageManagementTemplateUpdate',
  'MessageManagementTemplateDelete',
  'MessageManagementTemplateToggle',
  'MessageManagementTemplatePreview',
  'MessageManagementPushList',
  'MessageManagementPushCreate',
  'MessageManagementPushUpdate',
  'MessageManagementPushDelete',
  'MessageManagementPushToggle',
];

const llmMenuNames = [
  'Llm',
  'LlmConfig',
  'LlmChat',
  'LlmConfigCreate',
  'LlmConfigUpdate',
  'LlmConfigDelete',
  'LlmConfigTest',
  'LlmConfigDefault',
  'LlmConfigToggle',
  'LlmChatUse',
];

const botTencentMenuNames = [
  'BotTencentConnection',
  'BotTencentCreate',
  'BotTencentDelete',
  'BotTencentEdit',
  'BotTencentMenuSync',
  'BotTencentPlugin',
  'BotTencentReconnect',
  'BotTencentWebhookUrl',
];

const pluginPlatformActionNames = [
  'PluginPlatformPluginConfig',
  'PluginPlatformPluginDisable',
  'PluginPlatformPluginEnable',
  'PluginPlatformPluginInstall',
  'PluginPlatformPluginUninstall',
  'PluginPlatformPluginUpgrade',
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
        name: 'Bot',
        path: '/bot',
        children: [
          {
            name: 'BotNapcatConnection',
            path: '/bot/napcat',
            component: '/bot/account/list',
            children: [
              {
                name: 'BotAccountMessagePushList',
                authCode: 'Bot:Account:MessagePush:List',
                type: 'button',
              },
            ],
          },
          {
            name: 'BotNapcatWebui',
            path: '/bot/napcat/:accountId/webui',
            component: '/bot/account/napcat-webui/index',
            meta: {
              activePath: '/bot/napcat',
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
        name: 'Bot',
        path: '/bot',
        children: [
          {
            name: 'BotNapcatConnection',
            path: '/bot/napcat',
            component: '/bot/account/list',
            children: [
              {
                name: 'BotAccountMessagePushList',
                authCode: 'Bot:Account:MessagePush:List',
                type: 'button',
              },
            ],
          },
          {
            name: 'BotNapcatWebui',
            path: '/bot/napcat/:accountId/webui',
            component: '/bot/account/napcat-webui/index',
            meta: {
              activePath: '/bot/napcat',
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
        name: 'Bot',
        path: '/bot',
        sort: 1,
        meta: {
          title: 'Bot',
        },
        children: [
          {
            name: 'BotNapcatConnection',
            path: '/bot/napcat',
            component: '/bot/account/list',
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
        name: 'Bot',
        path: '/bot',
        children: [
          {
            name: 'BotNapcatConfig',
            path: '/bot/napcat/config',
            children: messagePushMenuNames.map((name) => ({
              authCode: `Bot:Account:MessagePush:${name.replace('BotAccountMessagePush', '')}`,
              name,
              type: 'button',
            })),
          },
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
    const bot = menus.find((menu) => menu.name === 'Bot');
    const retainedNames =
      bot?.children?.[0]?.children?.map((child) => child.name) ?? [];

    expect(bot?.children?.map((child) => child.name)).toEqual([
      'BotNapcatConfig',
    ]);
    expect(retainedNames).toEqual(messagePushMenuNames);
    expect(new Set(retainedNames).size).toBe(retainedNames.length);
    expect(retainedNames).not.toContain('UnsupportedMessagePushNode');
  });

  it('keeps the complete media governance menu and action permission tree', async () => {
    requestClientGet.mockResolvedValue([
      {
        name: 'MediaGovernance',
        path: '/media/governance',
        redirect: '/media/governance/series',
        children: [
          {
            name: 'MediaGovernanceSeries',
            path: '/media/governance/series',
            component: '/media/governance/series/list',
          },
          {
            name: 'MediaGovernanceSeriesDetail',
            path: '/media/governance/series/:seriesId',
            component: '/media/governance/series/detail',
            meta: {
              activePath: '/media/governance/series',
              hideInMenu: true,
              title: '媒体系列详情',
            },
          },
          {
            name: 'MediaGovernanceTasks',
            path: '/media/governance/tasks',
            component: '/media/governance/tasks/list',
            children: mediaGovernanceMenuNames.slice(6).map((name) => ({
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
            name: 'MediaGovernanceAgentSession',
            path: '/media/governance/tasks/:taskId/agent',
            component: '/media/governance/agent-session/index',
            meta: {
              activePath: '/media/governance/tasks',
              hideInMenu: true,
              hideInTab: true,
              title: 'CodexAgent 治理会话',
            },
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
    const agentSessionMenu = mediaGovernance?.children?.find(
      (menu) => menu.name === 'MediaGovernanceAgentSession',
    );

    expect(mediaGovernance?.children?.map((menu) => menu.name)).toEqual([
      'MediaGovernanceSeries',
      'MediaGovernanceSeriesDetail',
      'MediaGovernanceTasks',
      'MediaGovernanceAgentQueue',
      'MediaGovernanceAgentSession',
    ]);
    expect(taskMenu?.children?.map((menu) => menu.name)).toEqual(
      mediaGovernanceMenuNames.slice(6),
    );
    expect(agentSessionMenu?.meta).toMatchObject({
      hideInMenu: true,
      hideInTab: true,
    });
  });

  it('keeps the complete message management menu and action permission tree', async () => {
    requestClientGet.mockResolvedValue([
      {
        name: 'MessageManagement',
        path: '/message-management',
        children: [
          {
            name: 'MessageManagementTemplate',
            path: '/message-management/template',
            children: messageManagementMenuNames.slice(9, 15).map((name) => ({
              authCode: `MessageManagement:Template:${name}`,
              name,
              type: 'button',
            })),
          },
          {
            name: 'MessageManagementSubscription',
            path: '/message-management/subscription',
            children: messageManagementMenuNames.slice(4, 9).map((name) => ({
              authCode: `MessageManagement:Subscription:${name}`,
              name,
              type: 'button',
            })),
          },
          {
            name: 'MessageManagementStationNoticeSubscriber',
            path: '/message-management/subscribers/station-notice',
            children: messageManagementMenuNames.slice(15).map((name) => ({
              authCode: `MessageManagement:Push:${name}`,
              name,
              type: 'button',
            })),
          },
          {
            name: 'UnsupportedMessageManagementNode',
            type: 'button',
          },
        ],
      },
    ]);

    const { getAllMenusApi } =
      await import('@test-source/apps/web-antdv-next/src/api/core/menu');
    const menus = await getAllMenusApi();
    const messageManagement = menus.find(
      (menu) => menu.name === 'MessageManagement',
    );

    expect(messageManagement?.children?.map((menu) => menu.name)).toEqual([
      'MessageManagementTemplate',
      'MessageManagementSubscription',
      'MessageManagementStationNoticeSubscriber',
    ]);
    expect(
      messageManagement?.children?.[0]?.children?.map((menu) => menu.name),
    ).toEqual(messageManagementMenuNames.slice(9, 15));
    expect(
      messageManagement?.children?.[1]?.children?.map((menu) => menu.name),
    ).toEqual(messageManagementMenuNames.slice(4, 9));
    expect(
      messageManagement?.children?.[2]?.children?.map((menu) => menu.name),
    ).toEqual(messageManagementMenuNames.slice(15));
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

  it('declares every message management menu literal exactly once', () => {
    const literals = getSupportedAdminMenuNameLiterals();

    expect(new Set(literals).size).toBe(literals.length);

    for (const name of messageManagementMenuNames) {
      expect(literals.filter((literal) => literal === name)).toHaveLength(1);
    }
  });

  it('declares every LLM menu and action literal exactly once', () => {
    const literals = getSupportedAdminMenuNameLiterals();
    expect(new Set(literals).size).toBe(literals.length);
    for (const name of llmMenuNames) {
      expect(literals.filter((literal) => literal === name)).toHaveLength(1);
    }
  });

  it('declares every Tencent and Plugin Platform action literal exactly once', () => {
    const literals = getSupportedAdminMenuNameLiterals();
    for (const name of [...botTencentMenuNames, ...pluginPlatformActionNames]) {
      expect(literals.filter((literal) => literal === name)).toHaveLength(1);
    }
  });
});
