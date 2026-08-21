import routes from '@test-source/apps/web-antdv-next/src/router/routes/modules/llm';
import { describe, expect, it } from 'vitest';

describe('lLM routes', () => {
  it('keeps config visible and chat hidden under one top-level module', () => {
    const root = routes[0];
    expect(root).toMatchObject({
      name: 'Llm',
      path: '/llm',
      redirect: '/llm/config',
    });
    expect(root?.children?.map((route) => route.name)).toEqual([
      'LlmConfig',
      'LlmChat',
    ]);
    expect(root?.children?.[0]).toMatchObject({
      name: 'LlmConfig',
      path: '/llm/config',
    });
    expect(root?.children?.[1]).toMatchObject({
      meta: {
        activePath: '/llm/config',
        fullPathKey: false,
        hideInMenu: true,
      },
      name: 'LlmChat',
      path: '/llm/config/:configId/chat',
    });
  });
});
