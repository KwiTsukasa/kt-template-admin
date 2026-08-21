import type { PropType, VNodeChild } from 'vue';

import { computed, defineComponent, nextTick, ref, watch } from 'vue';

import { PlusOutlined, SendOutlined, StopOutlined } from '@antdv-next/icons';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Space,
  Tag,
  TextArea,
  Typography,
} from 'antdv-next';

import { KtMilkdownEditor } from '#/components/markdown';

import '../index.scss';

const AAlert = Alert as any;
const AButton = Button as any;
const ACard = Card as any;
const AEmpty = Empty as any;
const AInput = Input as any;
const ASelect = Select as any;
const ASpace = Space as any;
const ATag = Tag as any;
const ATextArea = TextArea as any;
const ATypographyParagraph = Typography.Paragraph as any;
const ATypographyText = Typography.Text as any;

export interface LlmChatWorkspaceConversation {
  id: string;
  messageCount: number;
  title: string;
}

export interface LlmChatWorkspaceMessage {
  content: string;
  errorMessage?: null | string;
  finishReason?: null | string;
  id: string;
  model?: null | string;
  reasoningContent?: null | string;
  role: 'assistant' | 'user';
  status: 'completed' | 'failed' | 'interrupted' | 'streaming';
}

export interface LlmChatWorkspaceModelOption {
  label: string;
  value: string;
}

export default defineComponent({
  name: 'LlmChatWorkspace',
  props: {
    activeConversationId: { default: '', type: String },
    assistantLabel: { default: 'Assistant', type: String },
    canCreateConversation: { default: false, type: Boolean },
    canSend: { default: false, type: Boolean },
    canStop: { default: false, type: Boolean },
    composer: { default: '', type: String },
    composerMaxlength: { default: 20_000, type: Number },
    composerPlaceholder: {
      default: '输入消息，Enter 发送，Shift + Enter 换行',
      type: String,
    },
    connectionText: { default: '', type: String },
    conversationSearch: { default: '', type: String },
    conversations: {
      default: () => [],
      type: Array as PropType<LlmChatWorkspaceConversation[]>,
    },
    emptyDescription: {
      default: '发送第一条消息开始对话',
      type: String,
    },
    loading: { default: false, type: Boolean },
    messages: {
      default: () => [],
      type: Array as PropType<LlmChatWorkspaceMessage[]>,
    },
    modelOptions: {
      default: () => [],
      type: Array as PropType<LlmChatWorkspaceModelOption[]>,
    },
    modelSwitchable: { default: true, type: Boolean },
    reasoningEffortOptions: {
      default: () => [],
      type: Array as PropType<LlmChatWorkspaceModelOption[]>,
    },
    readonlyNotice: { default: '', type: String },
    selectedModel: { default: '', type: String },
    selectedReasoningEffort: { default: '', type: String },
    selectedServiceTier: { default: '', type: String },
    sendLabel: { default: '发送', type: String },
    serviceTierOptions: {
      default: () => [],
      type: Array as PropType<LlmChatWorkspaceModelOption[]>,
    },
    showConversationSearch: { default: true, type: Boolean },
  },
  emits: [
    'composerChange',
    'conversationCreate',
    'conversationSearchChange',
    'conversationSelect',
    'modelChange',
    'reasoningEffortChange',
    'send',
    'serviceTierChange',
    'stop',
  ],
  setup(props, { emit, slots }) {
    const messageScroll = ref<HTMLElement>();
    const visibleConversations = computed(() => {
      const keyword = props.conversationSearch.trim().toLowerCase();
      if (!keyword) return props.conversations;
      return props.conversations.filter((item) =>
        item.title.toLowerCase().includes(keyword),
      );
    });

    /**
     * 渲染共享会话导航，并按能力显示搜索与新建入口。
     * @returns 普通 LLM 与媒体治理共用的左侧会话栏。
     */
    function renderConversationRail() {
      let createButton: VNodeChild = null;
      if (props.canCreateConversation) {
        createButton = (
          <AButton
            aria-label="新对话"
            onClick={() => emit('conversationCreate')}
            size="small"
            type="text"
          >
            <PlusOutlined />
          </AButton>
        );
      }
      let search: VNodeChild = <div />;
      if (props.showConversationSearch) {
        search = (
          <AInput
            allowClear
            onChange={(event: { target: { value: string } }) =>
              emit('conversationSearchChange', event.target.value)
            }
            placeholder="搜索对话标题"
            value={props.conversationSearch}
          />
        );
      }
      return (
        <aside class="llm-chat-rail">
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium">对话列表</span>
            {createButton}
          </div>
          {search}
          <div class="llm-chat-conversation-list">
            {visibleConversations.value.map((conversation) => {
              const active = conversation.id === props.activeConversationId;
              return (
                <button
                  class={[
                    'llm-chat-conversation-item',
                    { 'llm-chat-conversation-item--active': active },
                  ]}
                  key={conversation.id}
                  onClick={() => emit('conversationSelect', conversation.id)}
                  type="button"
                >
                  <span class="truncate">{conversation.title}</span>
                  <span class="text-xs opacity-70">
                    {conversation.messageCount} 条消息
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      );
    }

    /**
     * 渲染连接上下文、模型和调用方扩展动作。
     * @returns 共用的对话页头。
     */
    function renderHeader() {
      let createButton: VNodeChild = null;
      if (props.canCreateConversation) {
        createButton = (
          <AButton onClick={() => emit('conversationCreate')}>新对话</AButton>
        );
      }
      let reasoningEffort: VNodeChild = null;
      if (props.reasoningEffortOptions.length > 0) {
        reasoningEffort = (
          <div class="flex items-center gap-2">
            <span class="text-sm">推理强度</span>
            <ASelect
              disabled={!props.modelSwitchable}
              onChange={(value: string) => emit('reasoningEffortChange', value)}
              options={props.reasoningEffortOptions}
              style={{ width: '130px' }}
              value={props.selectedReasoningEffort}
            />
          </div>
        );
      }
      let serviceTier: VNodeChild = null;
      if (props.serviceTierOptions.length > 0) {
        serviceTier = (
          <div class="flex items-center gap-2">
            <span class="text-sm">速度</span>
            <ASelect
              disabled={!props.modelSwitchable}
              onChange={(value: string) => emit('serviceTierChange', value)}
              options={props.serviceTierOptions}
              style={{ width: '120px' }}
              value={props.selectedServiceTier}
            />
          </div>
        );
      }
      return (
        <div class="llm-chat-header">
          <div class="min-w-0 flex-1 truncate text-sm">
            {props.connectionText}
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm">模型</span>
            <ASelect
              disabled={!props.modelSwitchable}
              onChange={(value: string) => emit('modelChange', value)}
              options={props.modelOptions}
              style={{ width: '180px' }}
              value={props.selectedModel}
            />
          </div>
          {reasoningEffort}
          {serviceTier}
          {slots.headerExtra?.()}
          {createButton}
        </div>
      );
    }

    /**
     * 渲染消息列表与调用方提供的任务上下文区域。
     * @returns 消息滚动区。
     */
    function renderMessages() {
      let messageContent: VNodeChild = (
        <AEmpty description={props.emptyDescription} />
      );
      if (props.messages.length > 0) {
        messageContent = (
          <div class="grid gap-3">
            {props.messages.map((item) =>
              renderWorkspaceMessage(item, props.assistantLabel),
            )}
          </div>
        );
      }
      return (
        <div class="llm-chat-messages" ref={messageScroll}>
          {slots.beforeMessages?.()}
          {messageContent}
        </div>
      );
    }

    /**
     * 渲染共享输入区，并按能力显示停止生成或只读提示。
     * @returns 对话输入区。
     */
    function renderComposer() {
      if (props.readonlyNotice) {
        return (
          <div class="llm-chat-composer">
            <AAlert showIcon title={props.readonlyNotice} />
          </div>
        );
      }
      let actionButton: VNodeChild = (
        <AButton
          aria-label={props.sendLabel}
          class="llm-chat-composer-action"
          disabled={!props.canSend}
          onClick={() => emit('send')}
          shape="circle"
          title={props.sendLabel}
          type="primary"
        >
          <SendOutlined />
        </AButton>
      );
      if (props.canStop) {
        actionButton = (
          <AButton
            aria-label="停止生成"
            class="llm-chat-composer-action"
            danger
            onClick={() => emit('stop')}
            shape="circle"
            title="停止生成"
          >
            <StopOutlined />
          </AButton>
        );
      }
      return (
        <div class="llm-chat-composer">
          <div class="llm-chat-composer-shell">
            <ATextArea
              autoSize={{ maxRows: 8, minRows: 2 }}
              class="llm-chat-composer-input"
              maxlength={props.composerMaxlength}
              onChange={(event: { target: { value: string } }) =>
                emit('composerChange', event.target.value)
              }
              onPressEnter={(event: KeyboardEvent) => {
                if (event.isComposing || event.shiftKey || !props.canSend) {
                  return;
                }
                event.preventDefault();
                emit('send');
              }}
              placeholder={props.composerPlaceholder}
              value={props.composer}
            />
            <div class="llm-chat-composer-toolbar">
              <span class="llm-chat-composer-hint">
                Enter 发送 · Shift + Enter 换行
              </span>
              <div class="llm-chat-composer-actions">
                <span class="llm-chat-composer-count">
                  {props.composer.length} / {props.composerMaxlength}
                </span>
                {actionButton}
              </div>
            </div>
          </div>
        </div>
      );
    }

    /**
     * 在消息或状态增量渲染后把共享滚动区定位到底部。
     */
    async function scrollToBottom() {
      await nextTick();
      const element = messageScroll.value;
      if (element) element.scrollTop = element.scrollHeight;
    }

    watch(
      () => props.messages,
      () => void scrollToBottom(),
      { deep: true, flush: 'post' },
    );

    return () => {
      if (props.loading) {
        return (
          <div class="flex h-full items-center justify-center text-muted-foreground">
            正在加载对话…
          </div>
        );
      }
      return (
        <div class="llm-chat-workspace">
          {renderConversationRail()}
          <section class="llm-chat-main">
            {renderHeader()}
            {renderMessages()}
            {renderComposer()}
          </section>
        </div>
      );
    };
  },
});

/**
 * 按角色决定对齐与色调，并仅对已完成助手正文启用 Markdown 展示。
 * @param item - 已适配为共享合同的对话消息。
 * @param assistantLabel - 当前业务对助手角色的展示名称。
 * @returns 带实际模型、思考折叠、Markdown 和状态的消息卡片。
 */
function renderWorkspaceMessage(
  item: LlmChatWorkspaceMessage,
  assistantLabel: string,
) {
  let alignment = 'mr-auto';
  let messageTone = 'llm-chat-message--assistant';
  let roleLabel = assistantLabel;
  let roleTone = 'green';
  if (item.role === 'user') {
    alignment = 'ml-auto';
    messageTone = 'llm-chat-message--user';
    roleLabel = '我';
    roleTone = 'blue';
  }
  let statusNode: VNodeChild = null;
  if (item.status === 'streaming') {
    statusNode = <ATypographyText type="success">正在生成</ATypographyText>;
  }
  if (item.status === 'interrupted') {
    statusNode = <ATypographyText type="warning">已停止</ATypographyText>;
  }
  if (item.status === 'failed') {
    statusNode = <ATypographyText type="danger">生成失败</ATypographyText>;
  }
  let modelNode: VNodeChild = null;
  if (item.role === 'assistant' && item.model) {
    modelNode = <ATag>{item.model}</ATag>;
  }
  let body: VNodeChild = (
    <ATypographyParagraph class="!mb-0 whitespace-pre-wrap">
      {item.content || '正在等待模型输出…'}
    </ATypographyParagraph>
  );
  if (
    item.role === 'assistant' &&
    item.status === 'completed' &&
    item.content
  ) {
    body = (
      <KtMilkdownEditor
        class="llm-chat-markdown"
        minHeight={0}
        modelValue={item.content}
        readonly
      />
    );
  }
  let reasoningNode: VNodeChild = null;
  if (item.role === 'assistant' && item.reasoningContent) {
    reasoningNode = (
      <details class="llm-chat-reasoning" open={item.status === 'streaming'}>
        <summary>思考过程</summary>
        <pre>{item.reasoningContent}</pre>
      </details>
    );
  }
  let errorNode: VNodeChild = null;
  if (item.errorMessage) {
    errorNode = <AAlert showIcon title={item.errorMessage} type="error" />;
  }
  return (
    <ACard
      class={['llm-chat-message', messageTone, alignment]}
      key={item.id}
      size="small"
    >
      <div class="grid gap-3">
        <ASpace>
          <ATag color={roleTone}>{roleLabel}</ATag>
          {modelNode}
          {statusNode}
        </ASpace>
        {body}
        {reasoningNode}
        {errorNode}
      </div>
    </ACard>
  );
}
