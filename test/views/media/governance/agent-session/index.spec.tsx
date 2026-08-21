/* @vitest-environment happy-dom */

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import MediaGovernanceAgentSession from '@test-source/apps/web-antdv-next/src/views/media/governance/agent-session';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getLlmConversation } from '#/api/llm';
import { getMediaGovernanceTask } from '#/api/media-governance';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(async () => undefined),
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
  useRouter: () => ({ replace: mocks.replace }),
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
    Empty: SlotStub,
    Skeleton: defineComponent({
      name: 'MockSkeleton',
      setup: () => () => h('div', { 'data-testid': 'loading' }),
    }),
  };
});

vi.mock('#/api/llm', () => ({
  getLlmConversation: vi.fn(),
}));

vi.mock('#/api/media-governance', () => ({
  getMediaGovernanceTask: vi.fn(),
}));

describe('media governance LLM conversation redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the standard LLM chat page for the Task-bound conversation id', async () => {
    vi.mocked(getMediaGovernanceTask).mockResolvedValue({
      id: 'media-task-agent-session',
      llmConversationId: '2041700000000190001',
    } as never);
    vi.mocked(getLlmConversation).mockResolvedValue({
      config: { id: '2041700000000100002' },
    } as never);

    mount(MediaGovernanceAgentSession);
    await flushPromises();

    expect(getLlmConversation).toHaveBeenCalledWith('2041700000000190001');
    expect(mocks.replace).toHaveBeenCalledWith({
      name: 'LlmChat',
      params: { configId: '2041700000000100002' },
      query: {
        conversationId: '2041700000000190001',
        pageKey: 'llm-chat-2041700000000100002',
      },
    });
  });

  it('shows an explicit error when the Task has no LLM conversation binding', async () => {
    vi.mocked(getMediaGovernanceTask).mockResolvedValue({
      id: 'media-task-agent-session',
      llmConversationId: null,
    } as never);

    const wrapper = mount(MediaGovernanceAgentSession);
    await flushPromises();

    expect(wrapper.text()).toContain('当前任务尚未绑定本地 Codex 对话');
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
