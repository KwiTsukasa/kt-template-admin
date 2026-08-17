/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file */

import type { MediaGovernanceApi } from '#/api/media-governance';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import MediaGovernanceAgentSession from '@test-source/apps/web-antdv-next/src/views/media/governance/agent-session';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getMediaGovernanceAgentSession,
  getMediaGovernanceTask,
  sendMediaGovernanceAgentMessage,
} from '#/api/media-governance';

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
  push: vi.fn(async () => undefined),
  startStream: vi.fn(),
  stopStream: vi.fn(),
  streamOptions: undefined as any,
  success: vi.fn(),
}));

vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));

vi.mock('@vben/common-ui', () => ({
  Page: defineComponent({
    name: 'MockPage',
    setup(_, { slots }) {
      return () => h('main', slots.default?.());
    },
  }),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { taskId: 'media-task-agent-session' } }),
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('antdv-next', () => {
  const SlotStub = defineComponent({
    name: 'SlotStub',
    props: {
      description: { default: '', type: String },
      title: { default: '', type: String },
    },
    setup(props, { slots }) {
      return () =>
        h('section', [props.title, props.description, slots.default?.()]);
    },
  });
  return {
    Alert: SlotStub,
    Button: defineComponent({
      name: 'MockButton',
      props: { loading: Boolean },
      emits: ['click'],
      setup(props, { emit, slots }) {
        return () =>
          h(
            'button',
            {
              'data-loading': String(props.loading),
              onClick: () => emit('click'),
            },
            slots.default?.(),
          );
      },
    }),
    Card: SlotStub,
    Empty: SlotStub,
    Modal: { confirm: vi.fn() },
    Skeleton: defineComponent({
      name: 'MockSkeleton',
      setup: () => () => h('div', { 'data-testid': 'initial-skeleton' }),
    }),
    Space: SlotStub,
    Tag: SlotStub,
    TextArea: defineComponent({
      name: 'MockTextArea',
      props: { value: { default: '', type: String } },
      emits: ['change'],
      setup(props, { emit }) {
        return () =>
          h('textarea', {
            onInput: (event: Event) => emit('change', event),
            value: props.value,
          });
      },
    }),
    Typography: { Paragraph: SlotStub, Text: SlotStub },
    message: { error: mocks.error, success: mocks.success },
  };
});

vi.mock('#/api/media-governance', () => ({
  getMediaGovernanceAgentSession: vi.fn(),
  getMediaGovernanceTask: vi.fn(),
  sendMediaGovernanceAgentMessage: vi.fn(),
  startMediaGovernanceAgent: vi.fn(),
}));

vi.mock(
  '@test-source/apps/web-antdv-next/src/views/media/governance/composables/useMediaGovernanceStream',
  () => ({
    useMediaGovernanceStream: (options: unknown) => {
      mocks.streamOptions = options;
      return { close: mocks.stopStream, start: mocks.startStream };
    },
  }),
);

function task(): MediaGovernanceApi.Task {
  return {
    agentSession: {
      currentActionLabel: '等待操作员输入',
      currentUnitId: 'media-unit-s01',
      lastHeartbeatLabel: '刚刚',
      policyBoundaryLabel: '五层边界已启用',
      status: 'needs-operator',
      statusLabel: 'Agent 已回复，可继续对话',
      threadId: 'media-thread-agent-session',
    },
    id: 'media-task-agent-session',
    revision: 7,
    stage: 'metadata',
    titleHint: '实时会话测试',
  } as MediaGovernanceApi.Task;
}

function session(): MediaGovernanceApi.AgentSession {
  return {
    conversationRevision: 2,
    currentActionLabel: '等待操作员输入',
    currentUnitId: 'media-unit-s01',
    hasMoreMessages: false,
    historyComplete: true,
    lastHeartbeatLabel: '刚刚',
    messages: [
      {
        content: '检查当前元数据缺口',
        messageId: 'media-user-message-001',
        observedAt: '2026-08-17T10:00:00.000Z',
        phase: 'user',
        result: null,
        role: 'user',
        sequence: 1,
        status: 'completed',
        turnId: 'media-turn-session-001',
      },
      {
        content: '已核对第一部分',
        messageId: 'media-agent-message-002',
        observedAt: '2026-08-17T10:00:01.000Z',
        phase: 'commentary',
        result: null,
        role: 'assistant',
        sequence: 2,
        status: 'streaming',
        turnId: 'media-turn-session-001',
      },
    ],
    policyBoundaryLabel: '五层边界已启用',
    recommendations: [
      {
        id: 'analyze-metadata',
        label: '分析元数据缺口',
        prompt: '分析当前元数据缺口。',
      },
    ],
    status: 'needs-operator',
    statusLabel: 'Agent 已回复，可继续对话',
    threadId: 'media-thread-agent-session',
  };
}

describe('media governance Agent conversation page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.streamOptions = undefined;
    vi.mocked(getMediaGovernanceTask).mockResolvedValue(task());
    vi.mocked(getMediaGovernanceAgentSession).mockResolvedValue(session());
    vi.mocked(sendMediaGovernanceAgentMessage).mockResolvedValue(session());
  });

  it('renders complete history and merges live deltas without refetching or Spin', async () => {
    const wrapper = mount(MediaGovernanceAgentSession);
    await flushPromises();

    expect(wrapper.text()).toContain('检查当前元数据缺口');
    expect(wrapper.text()).toContain('已核对第一部分');
    expect(wrapper.text()).toContain('分析元数据缺口');
    expect(wrapper.find('[data-testid="initial-skeleton"]').exists()).toBe(
      false,
    );
    vi.mocked(getMediaGovernanceAgentSession).mockClear();

    mocks.streamOptions.onAgentConversation({
      capsuleSha256: 'a'.repeat(64),
      changeType: 'assistant-delta',
      content: '，继续实时输出',
      conversationRevision: 2,
      eventSequence: 1,
      messageId: 'media-agent-message-002',
      observedAt: '2026-08-17T10:00:02.000Z',
      phase: 'commentary',
      result: null,
      role: 'assistant',
      status: 'streaming',
      taskId: 'media-task-agent-session',
      taskRevision: 7,
      threadId: 'media-thread-agent-session',
      turnId: 'media-turn-session-001',
    });
    await flushPromises();

    expect(wrapper.text()).toContain('已核对第一部分，继续实时输出');
    expect(getMediaGovernanceAgentSession).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="initial-skeleton"]').exists()).toBe(
      false,
    );
  });

  it('sends arbitrary operator text to the same thread with revision CAS', async () => {
    const wrapper = mount(MediaGovernanceAgentSession);
    await flushPromises();
    await wrapper.get('textarea').setValue('请继续核对 S01 的海报。');
    const sendButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '发送并继续治理');
    if (!sendButton) throw new Error('会话页缺少发送按钮');

    await sendButton.trigger('click');
    await flushPromises();

    expect(sendMediaGovernanceAgentMessage).toHaveBeenCalledWith(
      'media-task-agent-session',
      expect.objectContaining({
        content: '请继续核对 S01 的海报。',
        expectedConversationRevision: 2,
        threadId: 'media-thread-agent-session',
      }),
    );
  });
});
