import { defineComponent, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Empty, Skeleton } from 'antdv-next';

import { getLlmConversation } from '#/api/llm';
import { getMediaGovernanceTask } from '#/api/media-governance';

const AAlert = Alert as any;
const AEmpty = Empty as any;
const ASkeleton = Skeleton as any;

export default defineComponent({
  name: 'MediaGovernanceAgentSessionRedirect',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const error = ref('');

    /**
     * 读取媒体任务唯一绑定的 LLM conversationId，并进入标准 LLM 对话页。
     */
    async function redirectToLlmConversation() {
      const taskId = String(route.params.taskId || '');
      if (!taskId) {
        error.value = '媒体治理任务标识缺失';
        return;
      }
      try {
        const task = await getMediaGovernanceTask(taskId);
        if (!task.llmConversationId) {
          error.value = '当前任务尚未绑定本地 Codex 对话';
          return;
        }
        const detail = await getLlmConversation(task.llmConversationId);
        await router.replace({
          name: 'LlmChat',
          params: { configId: detail.config.id },
          query: {
            conversationId: task.llmConversationId,
            pageKey: `llm-chat-${detail.config.id}`,
          },
        });
      } catch (error_) {
        error.value = errorText(error_);
      }
    }

    onMounted(() => void redirectToLlmConversation());

    return () => {
      let content = <ASkeleton active paragraph={{ rows: 6 }} />;
      if (error.value) {
        content = (
          <AEmpty description="无法进入本地 Codex 对话">
            <AAlert showIcon title={error.value} type="error" />
          </AEmpty>
        );
      }
      return <Page autoContentHeight>{content}</Page>;
    };
  },
});

/**
 * 提取媒体对话跳转错误并提供稳定兜底文案。
 * @param error - 加载任务或 LLM 对话时捕获的错误。
 * @returns 可展示的错误文本。
 */
function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return '本地 Codex 对话加载失败';
}
