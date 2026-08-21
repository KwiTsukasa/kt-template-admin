import type { LlmApi } from '#/api/llm';

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { useTabs } from '@vben/hooks';

import { message } from 'antdv-next';

import {
  createLlmConversation,
  getLlmConfig,
  getLlmConfigModels,
  getLlmConversation,
  getLlmConversations,
  streamLlmConversationMessage,
} from '#/api/llm';

import LlmChatWorkspace from './components/LlmChatWorkspace';

interface ViewMessage extends LlmApi.Message {
  local?: boolean;
}

export default defineComponent({
  name: 'LlmStreamingChat',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const { setTabTitle } = useTabs();
    const activeConversationId = ref('');
    const activeConversation = ref<LlmApi.Conversation>();
    const availableModels = ref<LlmApi.ModelCatalogItem[]>([]);
    const composer = ref('');
    const config = ref<LlmApi.Config>();
    const conversationSearch = ref('');
    const conversations = ref<LlmApi.Conversation[]>([]);
    const initialLoading = ref(true);
    const messages = ref<ViewMessage[]>([]);
    const modelDiscoveryError = ref('');
    const selectedModel = ref('');
    const selectedReasoningEffort = ref('');
    const selectedServiceTier = ref('');
    const sending = ref(false);
    let streamController: AbortController | undefined;
    const configId = computed(() => String(route.params.configId || ''));
    const modelOptions = computed(() =>
      availableModels.value.map((model) => ({
        label: model.label,
        value: model.id,
      })),
    );
    const selectedModelItem = computed(() =>
      availableModels.value.find((model) => model.id === selectedModel.value),
    );
    const tabTitle = computed(() => {
      const model = selectedModelItem.value;
      if (model) return model.label;
      if (config.value?.providerLabel) return config.value.providerLabel;
      return '大模型对话';
    });
    const reasoningEffortOptions = computed(() => {
      const model = selectedModelItem.value;
      if (!model) return [];
      return model.reasoningEfforts.map((option) => ({
        label: option.label,
        value: option.id,
      }));
    });
    const serviceTierOptions = computed(() => {
      const model = selectedModelItem.value;
      if (!model || model.serviceTiers.length === 0) return [];
      return [
        { label: '标准', value: '' },
        ...model.serviceTiers.map((option) => ({
          label: option.label,
          value: option.id,
        })),
      ];
    });
    const workspaceConversations = computed(() => {
      let source = conversations.value.filter(
        (conversation) => conversation.scene === 'general',
      );
      if (activeConversation.value?.scene === 'media-governance') {
        source = conversations.value.filter(
          (conversation) => conversation.id === activeConversationId.value,
        );
      }
      return source.map((conversation) => ({
        id: conversation.id,
        messageCount: conversation.messageCount,
        title: conversation.title,
      }));
    });
    const connectionText = computed(() => {
      const currentConfig = config.value;
      if (!currentConfig) return '';
      const status = connectionStatusLabel(currentConfig.connectionStatus);
      if (activeConversation.value?.scene === 'media-governance') {
        return `媒体治理 · ${activeConversation.value.title} · ${currentConfig.name} · ${status}`;
      }
      return `当前会话连接：${currentConfig.providerLabel} · ${currentConfig.name} · ${status}`;
    });
    const mediaConversation = computed(
      () => activeConversation.value?.scene === 'media-governance',
    );
    const canSend = computed(
      () =>
        Boolean(composer.value.trim()) &&
        Boolean(activeConversationId.value) &&
        Boolean(selectedModel.value) &&
        !modelDiscoveryError.value &&
        !sending.value,
    );

    /**
     * 在一次页面进入周期并行请求连接、实时模型与会话，并补齐首个普通会话。
     */
    async function initialize() {
      if (!configId.value) return;
      initialLoading.value = true;
      try {
        const [nextConfig, nextConversations] = await Promise.all([
          getLlmConfig(configId.value),
          getLlmConversations(configId.value),
          loadAvailableModels(),
        ]);
        config.value = nextConfig;
        conversations.value = nextConversations;
        let targetId = String(route.query.conversationId || '');
        if (
          targetId &&
          !conversations.value.some((item) => item.id === targetId)
        ) {
          targetId = '';
        }
        if (!targetId) {
          const firstGeneral = conversations.value.find(
            (conversation) => conversation.scene === 'general',
          );
          targetId = firstGeneral?.id || '';
        }
        if (!targetId) {
          const created = await createLlmConversation(configId.value);
          conversations.value = [created];
          targetId = created.id;
        }
        await activateConversation(targetId);
      } catch (error) {
        message.error(errorText(error, '大模型对话加载失败'));
      } finally {
        initialLoading.value = false;
      }
    }

    /**
     * 按当前连接协议实时发现模型，并把失败或空结果固化为禁发提示。
     */
    async function loadAvailableModels() {
      availableModels.value = [];
      modelDiscoveryError.value = '';
      selectedModel.value = '';
      selectedReasoningEffort.value = '';
      selectedServiceTier.value = '';
      try {
        const result = await getLlmConfigModels(configId.value);
        availableModels.value = result.items;
        if (result.items.length === 0) {
          modelDiscoveryError.value =
            '当前连接未发现可用模型，暂时无法发送消息，请检查供应商端点与凭据。';
        }
      } catch (error) {
        const reason = errorText(error, '请检查供应商端点与凭据');
        modelDiscoveryError.value = `实时模型发现失败，暂时无法发送消息：${reason}`;
        message.error(modelDiscoveryError.value);
      }
    }

    /**
     * 用服务端最新摘要替换左栏数据，同时不改动当前激活会话标识。
     */
    async function refreshConversations() {
      conversations.value = await getLlmConversations(configId.value);
    }

    /**
     * 按当前模型实时能力保留仍受支持的选择，否则采用供应商声明默认值或上游默认空值。
     * @param modelId - 当前模型发送标识。
     * @param preferredReasoningEffort - 会话或切换前希望保留的推理强度。
     * @param preferredServiceTier - 会话或切换前希望保留的速度档位。
     */
    function applyModelCapabilities(
      modelId: string,
      preferredReasoningEffort?: null | string,
      preferredServiceTier?: null | string,
    ) {
      const model = availableModels.value.find((item) => item.id === modelId);
      if (!model) {
        selectedReasoningEffort.value = '';
        selectedServiceTier.value = '';
        return;
      }
      let reasoningEffort = model.defaultReasoningEffort || '';
      if (
        preferredReasoningEffort &&
        model.reasoningEfforts.some(
          (option) => option.id === preferredReasoningEffort,
        )
      ) {
        reasoningEffort = preferredReasoningEffort;
      }
      let serviceTier = model.defaultServiceTier || '';
      if (
        preferredServiceTier &&
        model.serviceTiers.some((option) => option.id === preferredServiceTier)
      ) {
        serviceTier = preferredServiceTier;
      }
      selectedReasoningEffort.value = reasoningEffort;
      selectedServiceTier.value = serviceTier;
    }

    /**
     * 切换模型并只保留新模型仍支持的推理强度与速度档位。
     * @param value - 新模型发送标识。
     */
    function changeModel(value: string) {
      const previousReasoningEffort = selectedReasoningEffort.value;
      const previousServiceTier = selectedServiceTier.value;
      selectedModel.value = value;
      applyModelCapabilities(
        value,
        previousReasoningEffort,
        previousServiceTier,
      );
    }

    /**
     * 载入指定会话，并仅在实时列表中保留上次选择模型。
     * @param id - 对话 Snowflake ID。
     */
    async function activateConversation(id: string) {
      if (!id || sending.value) return;
      const detail = await getLlmConversation(id);
      activeConversationId.value = id;
      activeConversation.value = detail.conversation;
      config.value = detail.config;
      messages.value = detail.messages;
      const preferredModel = detail.conversation.selectedModel || '';
      let model = availableModels.value[0]?.id || '';
      if (
        preferredModel &&
        availableModels.value.some((item) => item.id === preferredModel)
      ) {
        model = preferredModel;
      }
      selectedModel.value = model;
      applyModelCapabilities(
        model,
        detail.conversation.selectedReasoningEffort,
        detail.conversation.selectedServiceTier,
      );
      await router.replace({
        query: {
          ...route.query,
          conversationId: id,
          pageKey: `llm-chat-${configId.value}`,
        },
      });
    }

    /**
     * 为当前连接创建新对话并立即切换。
     */
    async function newConversation() {
      if (sending.value) return;
      const created = await createLlmConversation(configId.value);
      await refreshConversations();
      await activateConversation(created.id);
    }

    /**
     * 追加用户和助手占位消息，并按 SSE 到达顺序更新同一助手消息。
     */
    async function sendMessage() {
      const content = composer.value.trim();
      if (!canSend.value) return;
      const clientMessageId = `llm-user-${crypto.randomUUID()}`;
      const localUserId = `local-${clientMessageId}`;
      const localAssistantId = `local-assistant-${crypto.randomUUID()}`;
      const userMessage = createLocalMessage(
        localUserId,
        'user',
        content,
        null,
      );
      const assistantMessage = createLocalMessage(
        localAssistantId,
        'assistant',
        '',
        selectedModel.value,
      );
      assistantMessage.status = 'streaming';
      messages.value.push(userMessage, assistantMessage);
      composer.value = '';
      sending.value = true;
      streamController = new AbortController();
      try {
        const streamInput: {
          clientMessageId: string;
          content: string;
          model: string;
          reasoningEffort?: string;
          serviceTier?: string;
        } = {
          clientMessageId,
          content,
          model: selectedModel.value,
        };
        if (selectedReasoningEffort.value) {
          streamInput.reasoningEffort = selectedReasoningEffort.value;
        }
        if (selectedServiceTier.value) {
          streamInput.serviceTier = selectedServiceTier.value;
        }
        await streamLlmConversationMessage(
          activeConversationId.value,
          streamInput,
          (event) => mergeStreamEvent(event, userMessage, assistantMessage),
          streamController.signal,
        );
        await refreshConversations();
      } catch (error) {
        if (isAbortError(error)) {
          assistantMessage.status = 'interrupted';
        } else {
          assistantMessage.status = 'failed';
          assistantMessage.errorMessage = errorText(
            error,
            '大模型流式请求失败',
          );
          message.error(assistantMessage.errorMessage);
        }
      } finally {
        sending.value = false;
        streamController = undefined;
      }
    }

    /**
     * 合并单个服务端流事件，并保持用户/助手消息标识与实际模型一致。
     * @param event - 服务端统一 start、增量或 done 事件。
     * @param userMessage - 当前乐观用户消息。
     * @param assistantMessage - 当前乐观助手消息。
     */
    function mergeStreamEvent(
      event: LlmApi.StreamEvent,
      userMessage: ViewMessage,
      assistantMessage: ViewMessage,
    ) {
      if (event.type === 'start') {
        userMessage.id = event.userMessageId;
        userMessage.local = false;
        assistantMessage.id = event.assistantMessageId;
        assistantMessage.local = false;
        assistantMessage.model = event.model;
        return;
      }
      if (event.type === 'reasoning-delta') {
        const current = assistantMessage.reasoningContent || '';
        assistantMessage.reasoningContent = `${current}${event.content}`;
        return;
      }
      if (event.type === 'text-delta') {
        assistantMessage.content += event.content;
        return;
      }
      if (event.type !== 'done') return;
      assistantMessage.finishReason = event.finishReason || null;
      assistantMessage.model = event.model;
      assistantMessage.status = 'completed';
      assistantMessage.usage = event.usage || null;
    }

    /**
     * 取消浏览器流请求，API 与供应商适配器会继续向上游传播中断。
     */
    function stopGeneration() {
      streamController?.abort();
    }

    onMounted(() => {
      watch(tabTitle, (title) => void setTabTitle(title), { immediate: true });
      void initialize();
    });
    onBeforeUnmount(() => streamController?.abort());

    return () => (
      <Page autoContentHeight>
        <div class="llm-chat-page">
          <LlmChatWorkspace
            activeConversationId={activeConversationId.value}
            canCreateConversation={!mediaConversation.value}
            canSend={canSend.value}
            canStop={sending.value}
            composer={composer.value}
            connectionText={connectionText.value}
            conversations={workspaceConversations.value}
            conversationSearch={conversationSearch.value}
            loading={initialLoading.value}
            messages={messages.value}
            modelOptions={modelOptions.value}
            modelSwitchable={
              !sending.value &&
              !modelDiscoveryError.value &&
              modelOptions.value.length > 0
            }
            onComposerChange={(value: string) => (composer.value = value)}
            onConversationCreate={() => void newConversation()}
            onConversationSearchChange={(value: string) =>
              (conversationSearch.value = value)
            }
            onConversationSelect={(id: string) => void activateConversation(id)}
            onModelChange={changeModel}
            onReasoningEffortChange={(value: string) =>
              (selectedReasoningEffort.value = value)
            }
            onSend={() => void sendMessage()}
            onServiceTierChange={(value: string) =>
              (selectedServiceTier.value = value)
            }
            onStop={stopGeneration}
            readonlyNotice={modelDiscoveryError.value}
            reasoningEffortOptions={reasoningEffortOptions.value}
            selectedModel={selectedModel.value}
            selectedReasoningEffort={selectedReasoningEffort.value}
            selectedServiceTier={selectedServiceTier.value}
            serviceTierOptions={serviceTierOptions.value}
          />
        </div>
      </Page>
    );
  },
});

/**
 * SSE start 前先写入 local 占位，并在事件到达后原位替换服务端消息标识。
 * @param id - 页面临时消息标识。
 * @param role - 用户或助手角色。
 * @param content - 初始正文。
 * @param model - 助手当前选择模型；用户消息为 null。
 * @returns 可直接加入消息列表的本地消息。
 */
function createLocalMessage(
  id: string,
  role: 'assistant' | 'user',
  content: string,
  model: null | string,
): ViewMessage {
  return {
    content,
    createTime: new Date().toISOString(),
    errorMessage: null,
    finishReason: null,
    id,
    local: true,
    model,
    reasoningContent: null,
    role,
    sequence: Date.now(),
    status: 'completed',
    usage: null,
  };
}

/**
 * 把浏览器 AbortError 与内部取消标志归一到“已中断”状态分支。
 * @param error - 流式请求捕获的未知异常。
 * @returns AbortError 或显式取消文本时返回 true。
 */
function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.message === 'llm-stream-aborted') {
    return true;
  }
  return false;
}

/**
 * 提取异常消息并回退到调用方文案。
 * @param error - 未知异常。
 * @param fallback - 无可读消息时显示的文本。
 * @returns 可展示错误文案。
 */
function errorText(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * 将连接状态投影为页头中文文本。
 * @param status - API 连接状态。
 * @returns 中文状态标签。
 */
function connectionStatusLabel(status: LlmApi.ConnectionStatus) {
  if (status === 'connected') return '已连接';
  if (status === 'error') return '连接异常';
  if (status === 'disabled') return '已停用';
  return '未测试';
}
