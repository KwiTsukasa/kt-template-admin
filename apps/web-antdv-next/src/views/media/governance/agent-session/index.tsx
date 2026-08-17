import type { VNodeChild } from 'vue';

import type { MediaGovernanceTaskEventCursor } from '../composables/mediaGovernanceTaskEvent';

import type { MediaGovernanceApi } from '#/api/media-governance';

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Empty,
  message,
  Modal,
  Skeleton,
  Space,
  Tag,
  TextArea,
  Typography,
} from 'antdv-next';

import {
  getMediaGovernanceAgentSession,
  getMediaGovernanceTask,
  sendMediaGovernanceAgentMessage,
  startMediaGovernanceAgent,
} from '#/api/media-governance';

import { mergeMediaGovernanceTaskEvent } from '../composables/mediaGovernanceTaskEvent';
import { useMediaGovernanceStream } from '../composables/useMediaGovernanceStream';

const AAlert = Alert as any;
const AButton = Button as any;
const ACard = Card as any;
const AEmpty = Empty as any;
const ASkeleton = Skeleton as any;
const ASpace = Space as any;
const ATag = Tag as any;
const ATextArea = TextArea as any;
const ATypographyParagraph = Typography.Paragraph as any;
const ATypographyText = Typography.Text as any;

export default defineComponent({
  name: 'MediaGovernanceAgentSession',
  setup() {
    const { hasAccessByCodes } = useAccess();
    const route = useRoute();
    const router = useRouter();
    const composer = ref('');
    const initialLoading = ref(true);
    const lastConversationEventSequence = ref(0);
    const messages = ref<MediaGovernanceApi.AgentMessage[]>([]);
    const sending = ref(false);
    const session = ref<MediaGovernanceApi.AgentSession | null>();
    const task = ref<MediaGovernanceApi.Task>();
    const taskEventCursors = new Map<string, MediaGovernanceTaskEventCursor>();
    const taskId = computed(() => String(route.params.taskId || ''));
    const canOperate = computed(() =>
      hasAccessByCodes(['Media:Governance:AgentOperate']),
    );
    const canStart = computed(() =>
      hasAccessByCodes(['Media:Governance:AgentStart']),
    );

    const stream = useMediaGovernanceStream({
      onAgentConversation: mergeConversationEvent,
      onSnapshotRequired: () => void loadConversation(false),
      onTaskChanged: (event) => {
        if (event.taskId !== taskId.value) return;
        void mergeTaskEvent(event);
      },
    });

    /**
     * 按任务标识分页加载任务、Agent 会话和消息，并按选项显示首次骨架屏。
     *
     * @param showInitialSkeleton - 首次加载会话时是否显示整页骨架屏。
     * @throws 当服务端声称仍有历史消息却返回空页时由内部校验抛出；本函数捕获后显示加载失败提示。
     */
    async function loadConversation(showInitialSkeleton: boolean) {
      if (!taskId.value) return;
      if (showInitialSkeleton) initialLoading.value = true;
      try {
        task.value = await getMediaGovernanceTask(taskId.value);
        if (!task.value.agentSession) {
          session.value = null;
          messages.value = [];
          return;
        }
        let afterSequence = 0;
        const collected: MediaGovernanceApi.AgentMessage[] = [];
        let latestSession: MediaGovernanceApi.AgentSession | null = null;
        do {
          latestSession = await getMediaGovernanceAgentSession(taskId.value, {
            afterSequence,
            limit: 200,
          });
          if (!latestSession) break;
          const pageMessages = latestSession.messages ?? [];
          collected.push(...pageMessages);
          afterSequence = pageMessages.at(-1)?.sequence ?? afterSequence;
          if (latestSession.hasMoreMessages && pageMessages.length === 0) {
            throw new Error('Agent 会话历史分页未向前推进');
          }
        } while (latestSession?.hasMoreMessages);
        session.value = latestSession;
        messages.value = deduplicateMessages(collected);
      } catch (error) {
        message.error(errorMessage(error, 'CodexAgent 会话加载失败'));
      } finally {
        if (showInitialSkeleton) initialLoading.value = false;
      }
    }

    /**
     * 当事件序列断档时重新读取任务快照，并替换本地任务状态。
     */
    async function reconcileTask() {
      if (!taskId.value) return;
      try {
        task.value = await getMediaGovernanceTask(taskId.value);
      } catch {}
    }

    /**
     * 合并任务事件，并在游标断档时回读权威快照。
     *
     * @param event - 服务端推送的任务修订、运行游标与任务补丁。
     */
    async function mergeTaskEvent(event: MediaGovernanceApi.TaskChangedEvent) {
      const merged = mergeMediaGovernanceTaskEvent(
        task.value,
        event,
        taskEventCursors,
      );
      if (merged.result === 'gap') {
        await reconcileTask();
        taskEventCursors.clear();
        return;
      }
      task.value = merged.task;
      if (event.task?.agentSession && session.value) {
        session.value = {
          ...session.value,
          ...event.task.agentSession,
        };
      }
    }

    /**
     * 按事件序列合并 Agent 会话增量并更新会话版本。
     *
     * @param event - 服务端推送的 Agent 会话消息增量。
     */
    function mergeConversationEvent(
      event: MediaGovernanceApi.AgentConversationEvent,
    ) {
      if (
        event.taskId !== taskId.value ||
        event.threadId !== session.value?.threadId ||
        event.eventSequence <= lastConversationEventSequence.value
      ) {
        return;
      }
      lastConversationEventSequence.value = event.eventSequence;
      const existingIndex = messages.value.findIndex(
        (candidate) => candidate.messageId === event.messageId,
      );
      if (event.changeType === 'turn-started') {
        if (existingIndex === -1) {
          messages.value.push(projectEventMessage(event));
        }
        return;
      }
      removeTurnPlaceholder(event.turnId, event.messageId);
      const existing = messages.value.find(
        (candidate) => candidate.messageId === event.messageId,
      );
      const next = projectEventMessage(event);
      if (event.changeType === 'assistant-delta' && existing) {
        next.content = `${existing.content}${event.content}`;
        if (event.content.startsWith('正在生成')) {
          next.content = event.content;
        }
        next.sequence = existing.sequence;
      }
      upsertMessage(next);
      if (session.value) {
        session.value = {
          ...session.value,
          conversationRevision: Math.max(
            session.value.conversationRevision ?? 0,
            event.conversationRevision,
          ),
        };
      }
    }

    /**
     * 将会话增量事件投影为页面统一使用的消息结构。
     *
     * @param event - 服务端推送的 Agent 会话消息增量。
     * @returns 补齐会话、线程、回合和事件序号后的 Agent 消息。
     */
    function projectEventMessage(
      event: MediaGovernanceApi.AgentConversationEvent,
    ): MediaGovernanceApi.AgentMessage {
      return {
        content: event.content,
        messageId: event.messageId,
        observedAt: event.observedAt,
        phase: event.phase,
        result: event.result,
        role: event.role,
        sequence: Math.max(1, event.conversationRevision),
        status: event.status,
        turnId: event.turnId,
      };
    }

    /**
     * 当真实消息到达时移除同一回合、不同消息标识的占位项。
     *
     * @param turnId - 占位消息所属的 Agent 回合标识。
     * @param messageId - 已到达的真实消息标识，用来保留自身并移除同回合占位消息。
     */
    function removeTurnPlaceholder(turnId: string, messageId: string) {
      const index = messages.value.findIndex(
        (candidate) =>
          candidate.turnId === turnId &&
          candidate.messageId === turnId &&
          candidate.messageId !== messageId,
      );
      if (index !== -1) messages.value.splice(index, 1);
    }

    /**
     * 按消息标识插入或替换当前会话消息。
     *
     * @param next - 准备插入或覆盖到会话列表的 Agent 消息。
     */
    function upsertMessage(next: MediaGovernanceApi.AgentMessage) {
      const index = messages.value.findIndex(
        (candidate) => candidate.messageId === next.messageId,
      );
      if (index === -1) {
        messages.value.push(next);
        return;
      }
      messages.value.splice(index, 1, next);
    }

    /**
     * 将选中的治理建议写入消息输入框。
     *
     * @param recommendation - 用户选择并准备回填到输入框的 Agent 推荐项。
     */
    function chooseRecommendation(
      recommendation: MediaGovernanceApi.AgentRecommendation,
    ) {
      composer.value = recommendation.prompt;
    }

    /**
     * 在权限与会话版本校验通过后发送用户消息。
     */
    async function sendMessage() {
      const content = composer.value.trim();
      const currentSession = session.value;
      if (!content || !currentSession || sending.value || !canOperate.value) {
        return;
      }
      sending.value = true;
      try {
        const response = await sendMediaGovernanceAgentMessage(taskId.value, {
          clientMessageId: `media-user-${crypto.randomUUID()}`,
          content,
          expectedConversationRevision:
            currentSession.conversationRevision ?? 0,
          threadId: currentSession.threadId,
        });
        composer.value = '';
        session.value = response;
        messages.value = deduplicateMessages([
          ...messages.value,
          ...(response.messages ?? []),
        ]);
      } catch (error) {
        message.error(errorMessage(error, '消息发送失败'));
      } finally {
        sending.value = false;
      }
    }

    /**
     * 经用户确认后从当前任务快照启动 Agent 会话。
     */
    function startAgent() {
      const currentTask = task.value;
      if (!currentTask || currentTask.stage === 'closed' || !canStart.value) {
        return;
      }
      Modal.confirm({
        cancelText: '取消',
        content:
          '将按当前任务快照启动 NAS CodexAgent。Agent 只能使用声明的类型化工具，不能直接写入正式媒体、云端或数据库。',
        okText: '确认启动',
        onOk: async () => {
          await startMediaGovernanceAgent(currentTask.id, currentTask.revision);
          await loadConversation(false);
          message.success('CodexAgent 会话已启动');
        },
        title: '启动 CodexAgent 治理',
      });
    }

    /**
     * 渲染当前会话可选的后续治理建议。
     *
     * @returns 推荐项按钮区域；没有推荐项时返回 null。
     */
    function renderRecommendations() {
      const recommendations = session.value?.recommendations ?? [];
      if (recommendations.length === 0 || !canOperate.value) return null;
      return (
        <ACard size="small" title="基于当前任务快照的治理建议">
          <ASpace wrap>
            {recommendations.map((recommendation) => (
              <AButton
                key={recommendation.id}
                onClick={() => chooseRecommendation(recommendation)}
              >
                {recommendation.label}
              </AButton>
            ))}
          </ASpace>
        </ACard>
      );
    }

    /**
     * 根据角色与流式状态渲染完整会话消息。
     *
     * @returns 按角色与状态渲染的消息列表；空会话显示占位提示。
     */
    function renderMessages() {
      if (messages.value.length === 0) {
        return <AEmpty description="当前会话还没有可展示的消息" />;
      }
      return (
        <div class="grid gap-3">
          {messages.value.map((item) => {
            let alignment = 'mr-auto';
            let roleColor = 'purple';
            let roleLabel = 'CodexAgent';
            if (item.role === 'user') {
              alignment = 'ml-auto';
              roleColor = 'blue';
              roleLabel = '你';
            }
            let streamingIndicator: VNodeChild = null;
            if (item.status === 'streaming') {
              streamingIndicator = (
                <ATypographyText type="secondary">正在生成</ATypographyText>
              );
            }
            return (
              <ACard
                class={['max-w-[88%]', alignment]}
                key={item.messageId}
                size="small"
              >
                <div class="grid gap-2">
                  <ASpace>
                    <ATag color={roleColor}>{roleLabel}</ATag>
                    {streamingIndicator}
                  </ASpace>
                  <ATypographyParagraph class="!mb-0 whitespace-pre-wrap">
                    {item.content}
                  </ATypographyParagraph>
                </div>
              </ACard>
            );
          })}
        </div>
      );
    }

    /**
     * 根据加载、任务与会话状态渲染页面主体。
     *
     * @returns 根据加载、错误与会话状态生成的页面主体节点。
     */
    function renderContent() {
      if (initialLoading.value)
        return <ASkeleton active paragraph={{ rows: 8 }} />;
      if (!task.value) return <AEmpty description="任务不存在或无权访问" />;
      if (!session.value) {
        let startButton: VNodeChild = null;
        if (canStart.value) {
          startButton = (
            <AButton onClick={startAgent} type="primary">
              启动 CodexAgent 治理
            </AButton>
          );
        }
        return (
          <AEmpty description="当前任务尚未启动 CodexAgent 会话">
            {startButton}
          </AEmpty>
        );
      }
      let continuation: VNodeChild;
      if (task.value.stage === 'closed') {
        continuation = (
          <AAlert showIcon title="已完成任务仅可查看历史，不能继续发送消息" />
        );
      } else if (canOperate.value) {
        continuation = (
          <ACard size="small" title="继续同一会话">
            <div class="grid gap-3">
              <ATextArea
                autoSize={{ maxRows: 8, minRows: 3 }}
                maxlength={4000}
                onChange={(event: { target: { value: string } }) =>
                  (composer.value = event.target.value)
                }
                placeholder="输入任意治理问题或指令；消息会继续发送到同一 Agent thread"
                showCount
                value={composer.value}
              />
              <div class="flex justify-end gap-2">
                <AButton
                  onClick={() => void router.push('/media/governance/tasks')}
                >
                  返回任务列表
                </AButton>
                <AButton
                  loading={sending.value}
                  onClick={() => void sendMessage()}
                  type="primary"
                >
                  发送并继续治理
                </AButton>
              </div>
            </div>
          </ACard>
        );
      } else {
        continuation = (
          <AAlert showIcon title="当前账号没有继续 CodexAgent 会话的权限" />
        );
      }
      return (
        <div class="grid min-h-0 gap-4">
          <AAlert
            description={session.value.policyBoundaryLabel}
            showIcon
            title={`${task.value.titleHint} · ${session.value.statusLabel}`}
            type="info"
          />
          {renderRecommendations()}
          <ACard class="min-h-0" title="完整会话历史">
            {renderMessages()}
          </ACard>
          {continuation}
        </div>
      );
    }

    onMounted(() => {
      void loadConversation(true);
      stream.start();
    });
    onBeforeUnmount(stream.close);

    return () => <Page autoContentHeight>{renderContent()}</Page>;
  },
});

/**
 * 按消息标识去重并恢复稳定的会话顺序。
 *
 * @param messages - 需要按消息标识和事件序号去重的 Agent 消息列表。
 * @returns 按消息标识保留最新项并按事件序号稳定排序的数组。
 */
function deduplicateMessages(messages: MediaGovernanceApi.AgentMessage[]) {
  const byId = new Map<string, MediaGovernanceApi.AgentMessage>();
  for (const item of messages) byId.set(item.messageId, item);
  return [...byId.values()].toSorted(
    (left, right) => left.sequence - right.sequence,
  );
}

/**
 * 优先读取标准错误消息，否则返回调用方提供的兜底文案。
 *
 * @param error - 请求或事件处理捕获到的未知错误值。
 * @param fallback - 错误对象不含可读消息时显示的文本。
 * @returns Error.message 或非空字符串错误；无法识别时使用 fallback。
 */
function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}
