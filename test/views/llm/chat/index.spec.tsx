/* @vitest-environment happy-dom */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createLlmConversation,
  getLlmConfig,
  getLlmConfigModels,
  getLlmConversation,
  getLlmConversations,
  streamLlmConversationMessage,
} from '#/api/llm';

const testState = vi.hoisted(() => ({
  messageError: vi.fn(),
  replace: vi.fn(async () => undefined),
  setTabTitle: vi.fn(async () => undefined),
  route: {
    name: 'LlmChat',
    params: { configId: 'config-1' },
    path: '/llm/config/config-1/chat',
    query: {} as Record<string, unknown>,
  },
}));

vi.mock('@test-source/packages/effects/common-ui/src/index.ts', () => ({
  Page: defineComponent({
    name: 'MockPage',
    setup(_, { slots }) {
      return () => h('main', slots.default?.());
    },
  }),
}));

vi.mock('@test-source/packages/effects/hooks/src/index.ts', () => ({
  useTabs: () => ({ setTabTitle: testState.setTabTitle }),
}));

vi.mock('vue-router', async () => {
  const { reactive } = await vi.importActual<typeof import('vue')>('vue');
  testState.route = reactive(testState.route);
  return {
    useRoute: () => testState.route,
    useRouter: () => ({ replace: testState.replace }),
  };
});

vi.mock('antdv-next', () => ({
  message: { error: testState.messageError },
}));

vi.mock('#/api/llm', () => ({
  createLlmConversation: vi.fn(),
  getLlmConfig: vi.fn(),
  getLlmConfigModels: vi.fn(),
  getLlmConversation: vi.fn(),
  getLlmConversations: vi.fn(),
  streamLlmConversationMessage: vi.fn(),
}));

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/llm/chat/components/LlmChatWorkspace',
  () => ({
    default: defineComponent({
      name: 'MockLlmChatWorkspace',
      props: {
        activeConversationId: { default: '', type: String },
        canCreateConversation: { default: false, type: Boolean },
        canStop: { default: false, type: Boolean },
        canSend: { default: false, type: Boolean },
        composer: { default: '', type: String },
        connectionText: { default: '', type: String },
        contextLabel: { default: '', type: String },
        contextTitle: { default: '', type: String },
        messages: { default: () => [], type: Array },
        modelOptions: { default: () => [], type: Array },
        reasoningEffortOptions: { default: () => [], type: Array },
        readonlyNotice: { default: '', type: String },
        selectedModel: { default: '', type: String },
        selectedReasoningEffort: { default: '', type: String },
        selectedServiceTier: { default: '', type: String },
        serviceTierOptions: { default: () => [], type: Array },
        showConversationRail: { default: true, type: Boolean },
      },
      emits: ['composerChange', 'send'],
      setup(props, { emit }) {
        return () =>
          h(
            'section',
            {
              'data-can-send': String(props.canSend),
              'data-can-stop': String(props.canStop),
              'data-active-conversation': props.activeConversationId,
              'data-can-create': String(props.canCreateConversation),
              'data-connection-text': props.connectionText,
              'data-context-label': props.contextLabel,
              'data-context-title': props.contextTitle,
              'data-messages': JSON.stringify(props.messages),
              'data-model-options': JSON.stringify(props.modelOptions),
              'data-reasoning-options': JSON.stringify(
                props.reasoningEffortOptions,
              ),
              'data-readonly-notice': props.readonlyNotice,
              'data-selected-model': props.selectedModel,
              'data-selected-reasoning': props.selectedReasoningEffort,
              'data-selected-service-tier': props.selectedServiceTier,
              'data-service-tier-options': JSON.stringify(
                props.serviceTierOptions,
              ),
              'data-show-rail': String(props.showConversationRail),
              'data-testid': 'chat-workspace',
            },
            [
              h(
                'button',
                {
                  'data-testid': 'compose',
                  onClick: () => emit('composerChange', '你好'),
                  type: 'button',
                },
                '填写消息',
              ),
              h(
                'button',
                {
                  'data-testid': 'send',
                  onClick: () => emit('send'),
                  type: 'button',
                },
                '发送',
              ),
            ],
          );
      },
    }),
  }),
);

const mountedWrappers: Array<{ unmount: () => void }> = [];

const mountChat = async () => {
  const { default: LlmStreamingChat } =
    await import('@test-source/apps/web-antdv-next/src/views/llm/chat');
  const wrapper = mount(LlmStreamingChat);
  mountedWrappers.push(wrapper);
  await flushPromises();
  return wrapper;
};

describe('lLM realtime model discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.route.params.configId = 'config-1';
    testState.route.path = '/llm/config/config-1/chat';
    testState.route.query = {};
    vi.mocked(getLlmConfig).mockResolvedValue({
      baseUrl: 'https://api.openai.com/v1',
      connectionStatus: 'connected',
      id: 'config-1',
      name: 'OpenAI 生产',
      provider: 'openai',
      providerLabel: 'OpenAI',
    } as never);
    vi.mocked(getLlmConfigModels).mockResolvedValue({
      fetchedAt: '2026-08-21T10:00:00.000Z',
      items: [
        {
          defaultReasoningEffort: null,
          defaultServiceTier: null,
          id: 'gpt-4.1',
          label: 'GPT-4.1',
          reasoningEfforts: [],
          serviceTiers: [],
        },
        {
          defaultReasoningEffort: 'high',
          defaultServiceTier: null,
          id: 'gpt-4o',
          label: 'GPT-4o',
          reasoningEfforts: [
            { id: 'low', label: 'Low' },
            { id: 'high', label: 'High' },
          ],
          serviceTiers: [{ id: 'priority', label: 'Fast' }],
        },
      ],
      provider: 'openai',
    });
    vi.mocked(getLlmConversations).mockResolvedValue([
      {
        id: 'conversation-1',
        messageCount: 1,
        scene: 'general',
        selectedModel: 'gpt-4o',
        selectedReasoningEffort: 'low',
        selectedServiceTier: 'priority',
        title: '实时模型测试',
      } as never,
    ]);
    vi.mocked(getLlmConversation).mockResolvedValue({
      config: {
        baseUrl: 'https://api.openai.com/v1',
        connectionStatus: 'connected',
        id: 'config-1',
        name: 'OpenAI 生产',
        provider: 'openai',
        providerLabel: 'OpenAI',
      },
      conversation: {
        id: 'conversation-1',
        messageCount: 1,
        scene: 'general',
        selectedModel: 'gpt-4o',
        selectedReasoningEffort: 'low',
        selectedServiceTier: 'priority',
        title: '实时模型测试',
      },
      messages: [],
    } as never);
  });

  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) wrapper.unmount();
    vi.useRealTimers();
  });

  it('uses realtime ids as values and labels while retaining the selected model', async () => {
    const wrapper = await mountChat();

    const workspace = wrapper.get('[data-testid="chat-workspace"]');
    expect(getLlmConfigModels).toHaveBeenCalledTimes(1);
    expect(getLlmConfigModels).toHaveBeenCalledWith('config-1');
    expect(workspace.attributes('data-model-options')).toBe(
      JSON.stringify([
        { label: 'GPT-4.1', value: 'gpt-4.1' },
        { label: 'GPT-4o', value: 'gpt-4o' },
      ]),
    );
    expect(workspace.attributes('data-selected-model')).toBe('gpt-4o');
    expect(testState.replace).toHaveBeenCalledWith({
      query: {
        conversationId: 'conversation-1',
        pageKey: 'llm-chat-config-1',
      },
    });
    expect(testState.setTabTitle).toHaveBeenCalled();
    expect(testState.setTabTitle.mock.calls.at(-1)?.[0]).toBe('GPT-4o');
    expect(workspace.attributes('data-selected-reasoning')).toBe('low');
    expect(workspace.attributes('data-selected-service-tier')).toBe('priority');
    expect(workspace.attributes('data-reasoning-options')).toBe(
      JSON.stringify([
        { label: 'Low', value: 'low' },
        { label: 'High', value: 'high' },
      ]),
    );
    expect(workspace.attributes('data-service-tier-options')).toBe(
      JSON.stringify([
        { label: '标准', value: '' },
        { label: 'Fast', value: 'priority' },
      ]),
    );
  });

  it('falls back to the first realtime model when the saved model disappeared', async () => {
    vi.mocked(getLlmConversation).mockResolvedValueOnce({
      config: {
        baseUrl: 'https://api.openai.com/v1',
        connectionStatus: 'connected',
        id: 'config-1',
        name: 'OpenAI 生产',
        provider: 'openai',
        providerLabel: 'OpenAI',
      },
      conversation: {
        id: 'conversation-1',
        messageCount: 1,
        scene: 'general',
        selectedModel: 'retired-model',
        title: '实时模型测试',
      },
      messages: [],
    } as never);

    const wrapper = await mountChat();

    expect(
      wrapper
        .get('[data-testid="chat-workspace"]')
        .attributes('data-selected-model'),
    ).toBe('gpt-4.1');
    expect(
      wrapper
        .get('[data-testid="chat-workspace"]')
        .attributes('data-reasoning-options'),
    ).toBe('[]');
    expect(
      wrapper
        .get('[data-testid="chat-workspace"]')
        .attributes('data-service-tier-options'),
    ).toBe('[]');
  });

  it('sends only realtime-supported reasoning and speed selections', async () => {
    vi.mocked(streamLlmConversationMessage).mockResolvedValueOnce(undefined);
    const wrapper = await mountChat();

    await wrapper.get('[data-testid="compose"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="send"]').trigger('click');
    await flushPromises();

    expect(streamLlmConversationMessage).toHaveBeenCalledWith(
      'conversation-1',
      expect.objectContaining({
        model: 'gpt-4o',
        reasoningEffort: 'low',
        serviceTier: 'priority',
      }),
      expect.any(Function),
      expect.any(AbortSignal),
    );
  });

  it('reacts to a same-tag media conversation route without falling back to the general list', async () => {
    const wrapper = await mountChat();
    vi.mocked(getLlmConversation).mockResolvedValueOnce({
      config: {
        baseUrl: 'http://172.21.0.1:48087/internal/llm-codex',
        connectionStatus: 'connected',
        id: 'config-1',
        name: '本地 Codex',
        provider: 'codex',
        providerLabel: '本地 Codex',
      },
      conversation: {
        id: 'conversation-media-1',
        messageCount: 2,
        scene: 'media-governance',
        sceneRefId: 'media-task-1',
        selectedModel: 'gpt-4o',
        title: '死神BLEACH · 媒体治理',
      },
      messages: [
        {
          content: '媒体任务上下文已加载',
          id: 'assistant-media-1',
          role: 'assistant',
          status: 'completed',
        },
      ],
    } as never);

    testState.route.query = {
      conversationId: 'conversation-media-1',
      pageKey: 'llm-chat-config-1',
    };
    await flushPromises();

    const workspace = wrapper.get('[data-testid="chat-workspace"]');
    expect(getLlmConversation).toHaveBeenLastCalledWith('conversation-media-1');
    expect(workspace.attributes('data-active-conversation')).toBe(
      'conversation-media-1',
    );
    expect(workspace.attributes('data-can-create')).toBe('false');
    expect(workspace.attributes('data-context-label')).toBe('媒体治理');
    expect(workspace.attributes('data-context-title')).toBe(
      '死神BLEACH · 媒体治理',
    );
    expect(workspace.attributes('data-show-rail')).toBe('false');
    expect(createLlmConversation).not.toHaveBeenCalled();
  });

  it('renders received text incrementally before the SSE request completes', async () => {
    vi.useFakeTimers();
    let finishStream: (() => void) | undefined;
    vi.mocked(streamLlmConversationMessage).mockImplementationOnce(
      async (_conversationId, _input, onEvent) => {
        onEvent({
          assistantMessageId: 'assistant-1',
          model: 'gpt-4o',
          sequence: 2,
          turnId: 'turn-1',
          type: 'start',
          userMessageId: 'user-1',
        });
        onEvent({
          assistantMessageId: 'assistant-1',
          content: '增量打字',
          sequence: 2,
          turnId: 'turn-1',
          type: 'text-delta',
        });
        await new Promise<void>((resolve) => {
          finishStream = resolve;
        });
        onEvent({
          assistantMessageId: 'assistant-1',
          finishReason: 'stop',
          model: 'gpt-4o',
          sequence: 2,
          turnId: 'turn-1',
          type: 'done',
        });
      },
    );
    const wrapper = await mountChat();

    await wrapper.get('[data-testid="compose"]').trigger('click');
    await wrapper.get('[data-testid="send"]').trigger('click');
    await flushPromises();
    expect(
      wrapper.get('[data-testid="chat-workspace"]').attributes('data-can-stop'),
    ).toBe('true');

    await vi.advanceTimersByTimeAsync(16);
    await flushPromises();
    let renderedMessages = JSON.parse(
      wrapper
        .get('[data-testid="chat-workspace"]')
        .attributes('data-messages') || '[]',
    );
    expect(renderedMessages.at(-1)).toMatchObject({
      content: '增',
      status: 'streaming',
    });

    finishStream?.();
    await flushPromises();
    renderedMessages = JSON.parse(
      wrapper
        .get('[data-testid="chat-workspace"]')
        .attributes('data-messages') || '[]',
    );
    expect(renderedMessages.at(-1)).toMatchObject({ status: 'streaming' });

    await vi.runAllTimersAsync();
    await flushPromises();
    renderedMessages = JSON.parse(
      wrapper
        .get('[data-testid="chat-workspace"]')
        .attributes('data-messages') || '[]',
    );
    expect(renderedMessages.at(-1)).toMatchObject({
      content: '增量打字',
      status: 'completed',
    });
  });

  it('shows a readable discovery error and blocks POST SSE sending', async () => {
    vi.mocked(getLlmConfigModels).mockRejectedValueOnce(
      new Error('供应商 models 接口不可用'),
    );
    const wrapper = await mountChat();

    const workspace = wrapper.get('[data-testid="chat-workspace"]');
    expect(workspace.attributes('data-readonly-notice')).toContain(
      '实时模型发现失败，暂时无法发送消息',
    );
    expect(workspace.attributes('data-readonly-notice')).toContain(
      '供应商 models 接口不可用',
    );
    await wrapper.get('[data-testid="compose"]').trigger('click');
    await flushPromises();
    expect(workspace.attributes('data-can-send')).toBe('false');
    await wrapper.get('[data-testid="send"]').trigger('click');
    await flushPromises();
    expect(streamLlmConversationMessage).not.toHaveBeenCalled();
    expect(testState.messageError).toHaveBeenCalledWith(
      expect.stringContaining('实时模型发现失败'),
    );
    expect(createLlmConversation).not.toHaveBeenCalled();
  });
});
