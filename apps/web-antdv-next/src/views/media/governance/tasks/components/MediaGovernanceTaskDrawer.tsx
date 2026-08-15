import type { MediaGovernanceTaskOperation } from '../task-operation-contract';
import type { MediaGovernanceSourceFormDrawerExposed } from './MediaGovernanceSourceFormDrawer';
import type { MediaGovernanceSourceMappingDrawerExposed } from './MediaGovernanceSourceMappingDrawer';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { computed, defineComponent, onBeforeUnmount, ref } from 'vue';

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

import { useMediaGovernanceStream } from '../../composables/useMediaGovernanceStream';
import { getMediaGovernanceTaskOperations } from '../task-operation-contract';
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
    const activeTab = ref<MediaGovernanceTaskDrawerTabKey>('overview');
    const agentSession = ref<MediaGovernanceApi.AgentSession | null>();
    const evidence = ref<MediaGovernanceApi.Evidence>();
    const loading = ref(false);
    const operationKey = ref('');
    const open = ref(false);
    const operatorCandidateId = ref('');
    const operatorReason = ref('已核对候选身份、作品类型、季号和资料库编号');
    const sourceFormDrawer = ref<MediaGovernanceSourceFormDrawerExposed>();
    const sourceMappingDrawer =
      ref<MediaGovernanceSourceMappingDrawerExposed>();
    const task = ref<MediaGovernanceApi.Task>();
    const taskId = ref('');
    const title = computed(() => task.value?.titleHint || '媒体治理任务详情');
    const operations = computed(() => {
      if (!task.value) return [];
      return getMediaGovernanceTaskOperations(task.value);
    });

    const stream = useMediaGovernanceStream({
      onSnapshotRequired: () => void refresh(),
      onTaskChanged: (event) => {
        if (event.taskId === taskId.value) void refresh();
      },
    });

    function can(permissionCode: string) {
      return hasAccessByCodes([permissionCode]);
    }

    function show(
      taskIdentity: string,
      initialTab: MediaGovernanceTaskDrawerTabKey = 'overview',
    ) {
      if (taskId.value !== taskIdentity) {
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

    function close() {
      if (operationKey.value) return;
      open.value = false;
      stream.close();
      emit('close');
    }

    function errorMessage(error: unknown, fallback: string) {
      if (error instanceof Error) return error.message;
      return fallback;
    }

    async function refresh(forceAgent = false) {
      if (!taskId.value) return;
      loading.value = true;
      try {
        const [nextTask, nextEvidence] = await Promise.all([
          getMediaGovernanceTask(taskId.value),
          getMediaGovernanceEvidence(taskId.value),
        ]);
        task.value = nextTask;
        evidence.value = nextEvidence;
        await refreshAgentSession(nextTask, forceAgent);
      } catch (error) {
        message.error(errorMessage(error, '任务详情加载失败'));
      } finally {
        loading.value = false;
      }
    }

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

    function findOperationSource(
      currentTask: MediaGovernanceApi.Task,
      operation: MediaGovernanceTaskOperation,
    ) {
      if (!operation.sourceId) return undefined;
      return currentTask.sources.find(
        (source) => source.id === operation.sourceId,
      );
    }

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
      const action = buildTaskAction(currentTask, operation);
      if (!action) return;
      void runAction(operation.key, `${operation.label}已提交`, action);
    }

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

    function openSourceMapping(source: MediaGovernanceApi.Source) {
      const currentTask = task.value;
      if (!currentTask || !can('Media:Governance:SourceUpload')) return;
      sourceMappingDrawer.value?.open(currentTask, source);
    }

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

    function isSourceEditable(currentTask: MediaGovernanceApi.Task) {
      if (currentTask.stage !== 'intake') return false;
      if (currentTask.activeRunId !== null) return false;
      return can('Media:Governance:SourceUpload');
    }

    function currentAgentSession(currentTask: MediaGovernanceApi.Task) {
      if (agentSession.value !== undefined) return agentSession.value;
      return currentTask.agentSession;
    }

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

    function connectionColor() {
      if (stream.connected.value) return 'success';
      return 'default';
    }

    function connectionLabel() {
      if (stream.connected.value) return '实时进度已连接';
      return '正在连接实时进度';
    }

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
              (activeTab.value = key)
            }
          />
        </div>
      );
    }

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
