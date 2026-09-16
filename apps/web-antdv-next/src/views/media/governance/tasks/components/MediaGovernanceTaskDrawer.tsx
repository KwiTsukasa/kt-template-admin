import type { MediaGovernanceTaskEventCursor } from '../../composables/mediaGovernanceTaskEvent';
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
  discardMediaGovernanceTask,
  getMediaGovernanceEvidence,
  getMediaGovernanceTask,
} from '#/api/media-governance';

import { mergeMediaGovernanceTaskEvent } from '../../composables/mediaGovernanceTaskEvent';
import { useMediaGovernanceStream } from '../../composables/useMediaGovernanceStream';
import { getMediaGovernanceTaskOperations } from '../task-operation-contract';
import MediaGovernanceSourceFormDrawer from './MediaGovernanceSourceFormDrawer';
import MediaGovernanceSourceMappingDrawer from './MediaGovernanceSourceMappingDrawer';
import MediaGovernanceTaskEvidencePanel from './MediaGovernanceTaskEvidencePanel';
import MediaGovernanceTaskMappingsPanel from './MediaGovernanceTaskMappingsPanel';
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
  | 'evidence'
  | 'mapping'
  | 'overview'
  | 'runs'
  | 'sources'
  | 'subtitles';

export default defineComponent({
  name: 'MediaGovernanceTaskDrawer',
  props: {
    readOnly: { default: false, type: Boolean },
  },
  emits: ['changed', 'close'],
  setup(props, { emit, expose }) {
    const { hasAccessByCodes } = useAccess();
    const activeTab = ref<MediaGovernanceTaskDrawerTabKey>('overview');
    const evidence = ref<MediaGovernanceApi.Evidence>();
    const loading = ref(false);
    const operationKey = ref('');
    const open = ref(false);
    const sourceFormDrawer = ref<MediaGovernanceSourceFormDrawerExposed>();
    const sourceMappingDrawer =
      ref<MediaGovernanceSourceMappingDrawerExposed>();
    const task = ref<MediaGovernanceApi.Task>();
    const taskEventCursors = new Map<string, MediaGovernanceTaskEventCursor>();
    const taskId = ref('');
    const title = computed(() => task.value?.titleHint || '媒体治理任务详情');
    const operations = computed(() => {
      if (!task.value || props.readOnly) return [];
      return getMediaGovernanceTaskOperations(task.value);
    });

    const stream = useMediaGovernanceStream({
      onSnapshotRequired: () => void refresh(true),
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
      if (props.readOnly) return false;
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
        task.value = undefined;
        evidence.value = undefined;
      }
      taskId.value = taskIdentity;
      activeTab.value = initialTab;
      open.value = true;
      void refresh();
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
     * 并行刷新任务与机械治理证据。
     *
     * @param silent - 请求失败时是否省略错误提示；后台补偿刷新会设为 true；未传入时使用 `false`。
     */
    async function refresh(silent = false) {
      if (!taskId.value) return;
      if (!silent) loading.value = true;
      try {
        const [nextTask, nextEvidence] = await Promise.all([
          getMediaGovernanceTask(taskId.value),
          getMediaGovernanceEvidence(taskId.value),
        ]);
        task.value = nextTask;
        evidence.value = nextEvidence;
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
        await refresh();
        taskEventCursors.clear();
        return;
      }
      task.value = merged.task;
    }

    /**
     * 只替换抽屉内当前展示页签，不触发 Task 请求或业务状态变更。
     *
     * @param key - 准备切换到的详情页签键。
     */
    function changeTab(key: MediaGovernanceTaskDrawerTabKey) {
      activeTab.value = key;
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
      if (props.readOnly) return;
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
      if (operation.key === 'discard-task') {
        void discardTask(currentTask);
        return;
      }
      if (operation.key === 'workflow') openWorkflow();
    }

    /**
     * 打开当前任务已经关联的流程实例，业务页不再选择或单独发起模型。
     */
    function openWorkflow() {
      activeTab.value = 'runs';
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
     * 仅当任务仍在接收阶段且尚未封存计划时允许编辑来源。
     *
     * @param currentTask - 详情抽屉内最新的媒体治理任务快照。
     * @returns 任务仍处于接收阶段且计划未封存时为 true。
     */
    function isSourceEditable(currentTask: MediaGovernanceApi.Task) {
      if (props.readOnly) return false;
      if (currentTask.stage !== 'intake') return false;
      if (currentTask.activeRunId !== null) return false;
      return can('Media:Governance:SourceUpload');
    }

    /**
     * 依据当前任务状态组装详情抽屉的全部页签内容。
     *
     * @param currentTask - 详情抽屉内最新的媒体治理任务快照。
     * @returns 概要、来源、字幕、运行和机械验收证据页签配置。
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
          content: (
            <MediaGovernanceTaskRunPanel
              active={open.value && activeTab.value === 'runs'}
              onChanged={() => {
                void refresh(true);
                emit('changed');
              }}
              readOnly={props.readOnly}
              task={currentTask}
            />
          ),
          key: 'runs',
          label: '工作流',
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
     * 根据任务加载状态渲染骨架、概要、连接状态和详情页签。
     *
     * @returns 任务详情骨架、空态或包含页签与连接状态的完整内容。
     */
    function renderTaskContent() {
      const currentTask = task.value;
      if (!currentTask) return <AEmpty description="尚未加载任务详情" />;
      let readOnlyTag = null;
      if (props.readOnly) readOnlyTag = <ATag>只读执行视图</ATag>;
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
              {readOnlyTag}
              <ATag color={connectionColor()}>{connectionLabel()}</ATag>
            </ASpace>
            <ASpace>
              <AButton onClick={() => void refresh()}>刷新</AButton>
            </ASpace>
          </div>
          <ATabs
            activeKey={activeTab.value}
            items={createTabItems(currentTask)}
            key={currentTask.id}
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
      await refresh();
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
