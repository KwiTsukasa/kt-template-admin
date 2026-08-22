/* @vitest-environment happy-dom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  accessToken: 'access-token',
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  refresh: vi.fn(),
  setAccessToken: vi.fn(),
}));

vi.mock('@vben/hooks', () => ({
  useAppConfig: () => ({ apiURL: '/api' }),
}));

vi.mock('@vben/preferences', () => ({
  preferences: {
    app: { enableRefreshToken: true, locale: 'zh-CN' },
  },
}));

vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({
    accessToken: mocks.accessToken,
    setAccessToken: mocks.setAccessToken,
  }),
}));

vi.mock('#/api/core', () => ({ refreshTokenApi: mocks.refresh }));

vi.mock('#/api/request', () => ({
  requestClient: {
    delete: vi.fn(),
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
  },
}));

describe('lLM API wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accessToken = 'access-token';
  });

  it('removes blank API Key without submitting a static model list', async () => {
    mocks.post.mockResolvedValue({ id: 'config-1' });
    const { createLlmConfig } =
      await import('@test-source/apps/web-antdv-next/src/api/llm');
    await createLlmConfig({
      apiKey: '   ',
      baseUrl: ' https://api.openai.com/v1 ',
      enabled: true,
      isDefault: false,
      name: ' OpenAI 生产 ',
      provider: 'openai',
    });
    expect(mocks.post).toHaveBeenCalledWith('/llm/configs', {
      baseUrl: 'https://api.openai.com/v1',
      enabled: true,
      isDefault: false,
      name: 'OpenAI 生产',
      provider: 'openai',
    });
  });

  it('loads models from the connection-scoped realtime endpoint', async () => {
    mocks.get.mockResolvedValue({
      fetchedAt: '2026-08-21T10:00:00.000Z',
      items: [
        {
          defaultReasoningEffort: 'high',
          defaultServiceTier: null,
          id: 'gpt-4.1',
          label: 'GPT-4.1',
          reasoningEfforts: [{ id: 'high', label: 'High' }],
          serviceTiers: [{ id: 'priority', label: 'Fast' }],
        },
      ],
      provider: 'openai',
    });
    const { getLlmConfigModels } =
      await import('@test-source/apps/web-antdv-next/src/api/llm');

    await getLlmConfigModels('config-1');

    expect(mocks.get).toHaveBeenCalledWith('/llm/configs/config-1/models');
  });

  it('consumes start, two deltas and done from POST SSE with Bearer auth', async () => {
    const body = [
      'event: start\ndata: {"type":"start","sequence":1,"turnId":"turn-1","userMessageId":"user-1","assistantMessageId":"assistant-1","model":"gpt-4o"}\n\n',
      'event: text-delta\ndata: {"type":"text-delta","sequence":2,"turnId":"turn-1","assistantMessageId":"assistant-1","content":"第一段"}\n\n',
      'event: text-delta\ndata: {"type":"text-delta","sequence":3,"turnId":"turn-1","assistantMessageId":"assistant-1","content":"第二段"}\n\n',
      'event: done\ndata: {"type":"done","sequence":4,"turnId":"turn-1","assistantMessageId":"assistant-1","model":"gpt-4o","finishReason":"stop"}\n\n',
    ].join('');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        headers: { 'Content-Type': 'text/event-stream' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { streamLlmConversationMessage } =
      await import('@test-source/apps/web-antdv-next/src/api/llm');
    const events: Array<{ type: string }> = [];
    await streamLlmConversationMessage(
      'conversation-1',
      {
        clientMessageId: 'client-message-001',
        content: '测试',
        model: 'gpt-4o',
        reasoningEffort: 'high',
        serviceTier: 'priority',
      },
      (event) => events.push(event),
      new AbortController().signal,
    );
    expect(events.map((event) => event.type)).toEqual([
      'start',
      'text-delta',
      'text-delta',
      'done',
    ]);
    const init = fetchMock.mock.calls[0]?.[1] as {
      body?: BodyInit;
      headers: Record<string, string>;
      method: string;
    };
    expect(init.headers.Authorization).toBe('Bearer access-token');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({
      reasoningEffort: 'high',
      serviceTier: 'priority',
    });
  });
});
