import type { MediaGovernanceTaskEventCursor } from '../../composables/mediaGovernanceTaskEvent';
import type { MediaGovernanceTaskOperation } from '../task-operation-contract';
import type { MediaGovernanceSourceFormDrawerExposed } from './MediaGovernanceSourceFormDrawer';
import type { MediaGovernanceSourceMappingDrawerExposed } from './MediaGovernanceSourceMappingDrawer';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { computed, defineComponent, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';

import {
  Button,
  Drawer,
  Empty,
  message,
  Space,
  Spin,
  Tabs,
  Tag,
} from 'antdv-next';

import {
  cancelMediaGovernanceDownload,
  discardMediaGovernanceTask,
  getMediaGovernanceAgentSession,
  getMediaGovernanceEvidence,
  getMediaGovernanceTask,
  inspectMediaGovernanceSource,
  pauseMediaGovernanceDownload,
  probeMediaGovernanceSource,
  removeMediaGovernanceSource,
  resumeMediaGovernanceDownload,
  startMediaGovernanceAcceptanceVerification,
  startMediaGovernanceAgent,
  startMediaGovernanceDownload,
  startMediaGovernanceMetadataRepair,
  startMediaGovernanceMetadataVerification,
  startMediaGovernanceRun,
  submitMediaGovernanceOperatorDecision,
} from '#/api/media-governance';

import { mergeMediaGovernanceTaskEvent } from '../../composables/mediaGovernanceTaskEvent';
import { useMediaGovernanceStream } from '../../composables/useMediaGovernanceStream';
import {
  getAddableSourceRole,
  getMediaGovernanceTaskOperations,
} from '../task-operation-contract';
import MediaGovernanceSourceFormDrawer from './MediaGovernanceSourceFormDrawer';
import MediaGovernanceSourceMappingDrawer from './MediaGovernanceSourceMappingDrawer';
import MediaGovernanceTaskAgentPanel from './MediaGovernanceTaskAgentPanel';
import MediaGovernanceTaskEvidencePanel from './MediaGovernanceTaskEvidencePanel';
import MediaGovernanceTaskMappingsPanel from './MediaGovernanceTaskMappingsPanel';
import MediaGovernanceTaskMetadataPanel from './MediaGovernanceTaskMetadataPanel';
import MediaGovernanceTaskOverviewPanel from './MediaGovernanceTaskOverviewPanel';
import MediaGovernanceTaskRunPanel from './MediaGovernanceTaskRunPanel';
import MediaGovernanceTaskSourcesPanel from './MediaGovernanceTaskSourcesPanel';
import MediaGovernanceTaskSubtitlesPanel from './MediaGovernanceTaskSubtitlesPanel';

const AButton = Button as any;
const ADrawer = Drawer as any;
const AEmpty = Empty as any;
const ASpace = Space as any;
const ASpin = Spin as any;
const ATabs = Tabs as any;
const ATag = Tag as any;

export interface MediaGovernanceTaskDrawerExposed {
  open: (taskId: string, initialTab?: MediaGovernanceTaskDrawerTabKey) => void;
  refresh: () => Promise<void>;
}

export type MediaGovernanceTaskDrawerTabKey =
  | 'agent'
  | 'evidence'
  | 'mapping'
  | 'metadata'
  | 'overview'
  | 'runs'
  | 'sources'
  | 'subtitles';

export default defineComponent({
  name: 'MediaGovernanceTaskDrawer',
  emits: ['changed', 'close', 'edit'],
  setup(_, { emit, expose }) {
    const { hasAccessByCodes } = useAccess();
    const router = useRouter();
    const activeTab = ref<MediaGovernanceTaskDrawerTabKey>('overview');
    const agentSession = ref<MediaGovernanceApi.AgentSession | null>();
    const evidence = ref<MediaGovernanceApi.Evidence>();
    const loading = ref(false);
    const operationKey = ref('');
    const open = ref(false);
    const operatorCandidateId = ref('');
    const operatorReason = ref('已核对候选身份、作品类型、季号和资料库编号');
    const replacementSourceId = ref('');
    const sourceFormDrawer = ref<MediaGovernanceSourceFormDrawerExposed>();
    const sourceMappingDrawer =
      ref<MediaGovernanceSourceMappingDrawerExposed>();
    const task = ref<MediaGovernanceApi.Task>();
    const taskEventCursors = new Map<string, MediaGovernanceTaskEventCursor>();
    const taskId = ref('');
    const title = computed(() => task.value?.titleHint || '媒体治理任务详情');
    const operations = computed(() => {
      if (!task.value) return [];
      return getMediaGovernanceTaskOperations(task.value);
    });

    const stream = useMediaGovernanceStream({
      onSnapshotRequired: () => void refresh(false, true),
      onTaskChanged: (event) => {
        if (event.taskId === taskId.value) void mergeTaskEvent(event);
      },
    });

    /**
     * 根据当前账号访问码判断是否拥有指定媒体治理权限。
     *
     * @param permissionCode - 执行媒体治理操作要求的权限码。
     * @returns 当前账号包含目标权限码时为 true，否则为 false。
     */
    function can(permissionCode: string) {
      return hasAccessByCodes([permissionCode]);
    }

    /**
     * 切换到指定任务与页签并启动详情实时流。
     *
     * @param taskIdentity - 任务详情路由传入的任务标识。
     * @param initialTab - 详情抽屉打开后首先激活的页签；未传入时使用 `'overview'`。
     */
    function show(
      taskIdentity: string,
      initialTab: MediaGovernanceTaskDrawerTabKey = 'overview',
    ) {
      if (taskId.value !== taskIdentity) {
        taskEventCursors.clear();
        replacementSourceId.value = '';
        task.value = undefined;
        evidence.value = undefined;
        agentSession.value = undefined;
      }
      taskId.value = taskIdentity;
      activeTab.value = initialTab;
      open.value = true;
      void refresh(true);
      stream.start();
    }

    /**
     * 仅在没有操作执行时关闭任务详情，并同时断开实时事件流。
     */
    function close() {
      if (operationKey.value) return;
      open.value = false;
      stream.close();
      emit('close');
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

    /**
     * 并行刷新任务与证据，并按需回读 Agent 完整会话。
     *
     * @param forceAgent - 是否无条件刷新 Agent 会话；false 时仅在 Agent 页签刷新；未传入时使用 `false`。
     * @param silent - 请求失败时是否省略错误提示；后台补偿刷新会设为 true；未传入时使用 `false`。
     */
    async function refresh(forceAgent = false, silent = false) {
      if (!taskId.value) return;
      if (!silent) loading.value = true;
      try {
        const [nextTask, nextEvidence] = await Promise.all([
          getMediaGovernanceTask(taskId.value),
          getMediaGovernanceEvidence(taskId.value),
        ]);
        task.value = nextTask;
        evidence.value = nextEvidence;
        await refreshAgentSession(nextTask, forceAgent);
        openReplacementFormWhenReady(nextTask);
      } catch (error) {
        message.error(errorMessage(error, '任务详情加载失败'));
      } finally {
        if (!silent) loading.value = false;
      }
    }

    /**
     * 合并任务实时事件，并在游标断档时回读详情快照。
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
        await refresh(false, true);
        taskEventCursors.clear();
        return;
      }
      task.value = merged.task;
      if (event.task?.agentSession && agentSession.value) {
        agentSession.value = {
          ...agentSession.value,
          ...event.task.agentSession,
        };
      }
    }

    /**
     * 当旧来源已从任务快照移除时自动打开同角色的新来源表单。
     *
     * @param nextTask - 子抽屉或会话刷新后取得的最新媒体治理任务。
     */
    function openReplacementFormWhenReady(nextTask: MediaGovernanceApi.Task) {
      if (!replacementSourceId.value) return;
      const sourceStillExists = nextTask.sources.some(
        (source) => source.id === replacementSourceId.value,
      );
      if (sourceStillExists || !getAddableSourceRole(nextTask)) return;
      replacementSourceId.value = '';
      sourceFormDrawer.value?.open(nextTask);
      message.success('旧来源已清理，请重新填写种子或磁链');
    }

    /**
     * 按线程与决策状态选择回读或增量合并 Agent 会话。
     *
     * @param nextTask - 子抽屉或会话刷新后取得的最新媒体治理任务。
     * @param force - 是否忽略当前页签条件并强制刷新 Agent 会话。
     */
    async function refreshAgentSession(
      nextTask: MediaGovernanceApi.Task,
      force: boolean,
    ) {
      const changedThread =
        nextTask.agentSession?.threadId !== agentSession.value?.threadId;
      const missingDecision =
        nextTask.agentSession?.status === 'needs-operator' &&
        !agentSession.value?.result;
      if (force || changedThread || missingDecision) {
        agentSession.value = await getMediaGovernanceAgentSession(nextTask.id);
      } else if (nextTask.agentSession && agentSession.value) {
        agentSession.value = {
          ...agentSession.value,
          ...nextTask.agentSession,
        };
      } else {
        agentSession.value = nextTask.agentSession;
      }
      const candidates = agentSession.value?.result?.candidates ?? [];
      const selectedStillExists = candidates.some(
        (candidate) => candidate.id === operatorCandidateId.value,
      );
      if (!selectedStillExists) {
        operatorCandidateId.value = candidates[0]?.id ?? '';
      }
    }

    /**
     * 切换详情页签，并在进入 Agent 页时强制刷新会话。
     *
     * @param key - 准备切换到的详情页签键。
     */
    async function changeTab(key: MediaGovernanceTaskDrawerTabKey) {
      activeTab.value = key;
      if (key !== 'agent' || !task.value) return;
      try {
        await refreshAgentSession(task.value, true);
      } catch (error) {
        message.error(errorMessage(error, 'CodexAgent 会话加载失败'));
      }
    }

    /**
     * 串行执行任务操作并统一刷新状态、提示与错误处理。
     *
     * @param key - 正在执行的操作键，用来维持逐操作 loading 状态。
     * @param successMessage - 任务操作成功后展示给用户的反馈文本。
     * @param action - 包裹媒体治理请求和状态刷新的异步操作。
     */
    async function runAction(
      key: string,
      successMessage: string,
      action: () => Promise<unknown>,
    ) {
      if (operationKey.value) return;
      operationKey.value = key;
      try {
        await action();
        await refresh(true);
        emit('changed');
        message.success(successMessage);
      } catch (error) {
        message.error(errorMessage(error, '任务操作失败'));
      } finally {
        operationKey.value = '';
      }
    }

    /**
     * 从任务来源中定位操作绑定的来源。
     *
     * @param currentTask - 详情抽屉内最新的媒体治理任务快照。
     * @param operation - 提供可选 sourceId、用于在任务来源中定位记录的操作描述。
     * @returns 操作 sourceId 对应的任务来源；未指定或未匹配时为 undefined。
     */
    function findOperationSource(
      currentTask: MediaGovernanceApi.Task,
      operation: MediaGovernanceTaskOperation,
    ) {
      if (!operation.sourceId) return undefined;
      return currentTask.sources.find(
        (source) => source.id === operation.sourceId,
      );
    }

    /**
     * 根据操作类型路由到抽屉交互或服务端动作。
     *
     * @param operation - 决定打开子抽屉或调用哪项服务端任务动作的操作描述。
     */
    function executeOperation(operation: MediaGovernanceTaskOperation) {
      const currentTask = task.value;
      if (!currentTask || !can(operation.permissionCode)) return;
      const currentSource = findOperationSource(currentTask, operation);
      if (operation.key === 'add-source') {
        sourceFormDrawer.value?.open(currentTask);
        return;
      }
      if (operation.key === 'configure-source' && currentSource) {
        sourceMappingDrawer.value?.open(currentTask, currentSource);
        return;
      }
      if (operation.key === 'edit-task') {
        emit('edit', currentTask);
        return;
      }
      if (operation.key === 'replace-source' && currentSource) {
        void replaceSource(currentTask, currentSource);
        return;
      }
      if (operation.key === 'discard-task') {
        void discardTask(currentTask);
        return;
      }
      const action = buildTaskAction(currentTask, operation);
      if (!action) return;
      void runAction(operation.key, `${operation.label}已提交`, action);
    }

    /**
     * 精确移除旧来源并等待实时状态触发重新填写。
     *
     * @param currentTask - 详情抽屉内最新的媒体治理任务快照。
     * @param source - 要从当前任务精确移除并随后重新填写的旧来源。
     */
    async function replaceSource(
      currentTask: MediaGovernanceApi.Task,
      source: MediaGovernanceApi.Source,
    ) {
      if (operationKey.value) return;
      operationKey.value = 'replace-source';
      replacementSourceId.value = source.id;
      try {
        await removeMediaGovernanceSource(
          currentTask.id,
          source.id,
          currentTask.revision,
        );
        await refresh(true);
        emit('changed');
        if (replacementSourceId.value) {
          message.success('旧来源正在精确清理，完成后自动打开来源表单');
        }
      } catch (error) {
        replacementSourceId.value = '';
        message.error(errorMessage(error, '来源更换失败'));
      } finally {
        operationKey.value = '';
      }
    }

    /**
     * 在服务端确认删除当前任务后关闭详情与实时事件流。
     *
     * @param currentTask - 详情抽屉内最新的媒体治理任务快照。
     */
    async function discardTask(currentTask: MediaGovernanceApi.Task) {
      if (operationKey.value) return;
      operationKey.value = 'discard-task';
      try {
        const result = await discardMediaGovernanceTask(
          currentTask.id,
          currentTask.revision,
        );
        let successMessage = '任务已删除';
        if (result.clearedWorkItemId) {
          successMessage = `任务与本地账本 ${result.clearedWorkItemId} 已删除`;
        }
        open.value = false;
        stream.close();
        emit('changed');
        emit('close');
        message.success(successMessage);
      } catch (error) {
        message.error(errorMessage(error, '任务删除失败'));
      } finally {
        operationKey.value = '';
      }
    }

    /**
     * 将任务操作投影为绑定当前任务版本的接口调用。
     *
     * @param currentTask - 详情抽屉内最新的媒体治理任务快照。
     * @param operation - 要绑定当前任务标识、修订号与可选来源标识的操作描述。
     * @returns 绑定当前任务标识、修订号和可选来源的异步请求函数。
     */
    function buildTaskAction(
      currentTask: MediaGovernanceApi.Task,
      operation: MediaGovernanceTaskOperation,
    ) {
      const revision = currentTask.revision;
      const actions: Partial<
        Record<MediaGovernanceTaskOperation['key'], () => Promise<unknown>>
      > = {
        'cancel-download': () =>
          cancelMediaGovernanceDownload(currentTask.id, revision),
        'inspect-source': () =>
          inspectMediaGovernanceSource(
            currentTask.id,
            operation.sourceId || '',
            revision,
          ),
        'pause-download': () =>
          pauseMediaGovernanceDownload(currentTask.id, revision),
        'probe-source': () =>
          probeMediaGovernanceSource(
            currentTask.id,
            operation.sourceId || '',
            revision,
          ),
        'resume-download': () =>
          resumeMediaGovernanceDownload(currentTask.id, revision),
        'start-acceptance': () =>
          startMediaGovernanceAcceptanceVerification(currentTask.id, revision),
        'start-agent': () =>
          startMediaGovernanceAgent(currentTask.id, revision),
        'start-download': () =>
          startMediaGovernanceDownload(currentTask.id, revision),
        'start-governance': () =>
          startMediaGovernanceRun(currentTask.id, revision),
        'start-metadata-repair': () =>
          startMediaGovernanceMetadataRepair(currentTask.id, revision),
        'start-metadata-verification': () =>
          startMediaGovernanceMetadataVerification(currentTask.id, revision),
      };
      return actions[operation.key];
    }

    /**
     * 在权限允许时打开来源逐文件映射抽屉。
     *
     * @param source - 要在逐文件映射抽屉中配置的任务来源。
     */
    function openSourceMapping(source: MediaGovernanceApi.Source) {
      const currentTask = task.value;
      if (!currentTask || !can('Media:Governance:SourceUpload')) return;
      sourceMappingDrawer.value?.open(currentTask, source);
    }

    /**
     * 仅在权限允许且来源可编辑时提交来源移除请求。
     *
     * @param source - 要在权限与任务状态允许时移除的来源记录。
     */
    function removeSource(source: MediaGovernanceApi.Source) {
      const currentTask = task.value;
      if (!currentTask || !can('Media:Governance:SourceUpload')) return;
      void runAction(`remove-source:${source.id}`, '来源已移除', () =>
        removeMediaGovernanceSource(
          currentTask.id,
          source.id,
          currentTask.revision,
        ),
      );
    }

    /**
     * 通过候选与依据非空校验后提交人工决策，并刷新任务状态。
     */
    function submitOperatorDecisionAction() {
      const currentTask = task.value;
      if (!currentTask || !can('Media:Governance:OperatorDecision')) return;
      if (!operatorCandidateId.value) {
        message.warning('请先选择一个经人工核对的候选结果');
        return;
      }
      if (operatorReason.value.trim().length < 4) {
        message.warning('请填写至少 4 个字的放行依据');
        return;
      }
      void runAction('operator-decision', '人工治理候选已放行', () =>
        submitMediaGovernanceOperatorDecision(currentTask.id, {
          expectedRevision: currentTask.revision,
          reason: operatorReason.value.trim(),
          selectedCandidateId: operatorCandidateId.value,
        }),
      );
    }

    /**
     * 仅当任务仍在接收阶段且尚未封存计划时允许编辑来源。
     *
     * @param currentTask - 详情抽屉内最新的媒体治理任务快照。
     * @returns 任务仍处于接收阶段且计划未封存时为 true。
     */
    function isSourceEditable(currentTask: MediaGovernanceApi.Task) {
      if (currentTask.stage !== 'intake') return false;
      if (currentTask.activeRunId !== null) return false;
      return can('Media:Governance:SourceUpload');
    }

    /**
     * 优先返回已回读的 Agent 会话，否则使用任务内嵌快照。
     *
     * @param currentTask - 详情抽屉内最新的媒体治理任务快照。
     * @returns 已单独加载的 Agent 会话，缺失时回退到任务内嵌会话；均无则为 null。
     */
    function currentAgentSession(currentTask: MediaGovernanceApi.Task) {
      if (agentSession.value !== undefined) return agentSession.value;
      return currentTask.agentSession;
    }

    /**
     * 依据当前任务状态组装详情抽屉的全部页签内容。
     *
     * @param currentTask - 详情抽屉内最新的媒体治理任务快照。
     * @returns 概要、来源、字幕、元数据与可选 Agent 页签配置。
     */
    function createTabItems(currentTask: MediaGovernanceApi.Task) {
      return [
        {
          content: (
            <MediaGovernanceTaskOverviewPanel
              canExecute={can}
              execute={executeOperation}
              operationKey={operationKey.value}
              operations={operations.value}
              task={currentTask}
            />
          ),
          key: 'overview',
          label: '概览',
        },
        {
          content: (
            <MediaGovernanceTaskSourcesPanel
              editable={isSourceEditable(currentTask)}
              onConfigure={openSourceMapping}
              onRemove={removeSource}
              operationKey={operationKey.value}
              task={currentTask}
            />
          ),
          key: 'sources',
          label: '来源',
        },
        {
          content: <MediaGovernanceTaskMappingsPanel task={currentTask} />,
          key: 'mapping',
          label: '映射',
        },
        {
          content: <MediaGovernanceTaskSubtitlesPanel task={currentTask} />,
          key: 'subtitles',
          label: '字幕',
        },
        {
          content: <MediaGovernanceTaskMetadataPanel task={currentTask} />,
          key: 'metadata',
          label: '元数据',
        },
        {
          content: (
            <MediaGovernanceTaskAgentPanel
              canDecide={can('Media:Governance:OperatorDecision')}
              candidateId={operatorCandidateId.value}
              onCandidateChange={(value: string) =>
                (operatorCandidateId.value = value)
              }
              onOpenConversation={() =>
                void router.push({
                  name: 'MediaGovernanceAgentSession',
                  params: { taskId: currentTask.id },
                })
              }
              onReasonChange={(value: string) => (operatorReason.value = value)}
              onSubmit={submitOperatorDecisionAction}
              operationKey={operationKey.value}
              reason={operatorReason.value}
              session={currentAgentSession(currentTask)}
            />
          ),
          key: 'agent',
          label: 'CodexAgent',
        },
        {
          content: <MediaGovernanceTaskRunPanel task={currentTask} />,
          key: 'runs',
          label: '运行',
        },
        {
          content: (
            <MediaGovernanceTaskEvidencePanel
              evidence={evidence.value}
              task={currentTask}
            />
          ),
          key: 'evidence',
          label: '证据',
        },
      ];
    }

    /**
     * 将实时流连接状态映射为标签颜色。
     *
     * @returns 当前实时流连接状态对应的标签颜色。
     */
    function connectionColor() {
      if (stream.connected.value) return 'success';
      return 'default';
    }

    /**
     * 将实时流连接状态映射为中文提示。
     *
     * @returns 当前实时流连接状态对应的中文文本。
     */
    function connectionLabel() {
      if (stream.connected.value) return '实时进度已连接';
      return '正在连接实时进度';
    }

    /**
     * 根据权限与任务状态渲染作品身份编辑入口。
     *
     * @param currentTask - 详情抽屉内最新的媒体治理任务快照。
     * @returns 有权限且任务可编辑时的身份修改按钮，否则返回 null。
     */
    function renderIdentityButton(currentTask: MediaGovernanceApi.Task) {
      if (!can('Media:Governance:Create')) return null;
      return (
        <AButton
          disabled={!canEditIdentity(currentTask)}
          onClick={() => emit('edit', currentTask)}
        >
          编辑作品身份
        </AButton>
      );
    }

    /**
     * 根据任务加载状态渲染骨架、概要、连接状态和详情页签。
     *
     * @returns 任务详情骨架、空态或包含页签与连接状态的完整内容。
     */
    function renderTaskContent() {
      const currentTask = task.value;
      if (!currentTask) return <AEmpty description="尚未加载任务详情" />;
      return (
        <div class="grid gap-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <ASpace wrap>
              <ATag color="processing">
                {currentTask.semanticProjection.stageLabel}
              </ATag>
              <ATag>{currentTask.semanticProjection.runStateLabel}</ATag>
              <span class="text-sm text-muted-foreground">
                任务版本 {currentTask.revision}
              </span>
              <ATag color={connectionColor()}>{connectionLabel()}</ATag>
            </ASpace>
            <ASpace>
              <AButton onClick={() => void refresh(true)}>刷新</AButton>
              {renderIdentityButton(currentTask)}
            </ASpace>
          </div>
          <ATabs
            activeKey={activeTab.value}
            items={createTabItems(currentTask)}
            key={`${currentTask.id}:${currentTask.revision}`}
            onChange={(key: MediaGovernanceTaskDrawerTabKey) =>
              void changeTab(key)
            }
          />
        </div>
      );
    }

    /**
     * 子抽屉保存后刷新详情并通知列表同步。
     */
    async function handleChildSaved() {
      await refresh(true);
      emit('changed');
    }

    expose({ open: show, refresh } satisfies MediaGovernanceTaskDrawerExposed);
    onBeforeUnmount(stream.close);

    return () => (
      <>
        <ADrawer
          destroyOnHidden
          mask={{ closable: !operationKey.value }}
          onClose={close}
          open={open.value}
          size="large"
          title={title.value}
        >
          <ASpin spinning={loading.value}>{renderTaskContent()}</ASpin>
        </ADrawer>
        <MediaGovernanceSourceFormDrawer
          onSaved={() => void handleChildSaved()}
          ref={sourceFormDrawer}
        />
        <MediaGovernanceSourceMappingDrawer
          onSaved={() => void handleChildSaved()}
          ref={sourceMappingDrawer}
        />
      </>
    );
  },
});

/**
 * 仅当任务未进入执行阶段且没有已接受来源时允许修改作品身份。
 *
 * @param task - 要检查阶段、运行态及来源接收状态的任务快照。
 * @returns 任务状态仍允许修改作品身份与季号时为 true。
 */
export function canEditIdentity(task: MediaGovernanceApi.Task) {
  return (
    task.stage === 'intake' &&
    (task.runState === 'draft' || task.runState === 'blocked') &&
    task.activeRunId === null &&
    task.payloadSeal === null &&
    task.sealedPlan === null &&
    task.sealedPlanSha256 === null &&
    task.closedAt === null &&
    task.agentSession === null &&
    task.metadataIdentity === null &&
    task.metadataStatus === 'pending'
  );
}
