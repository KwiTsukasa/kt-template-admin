import type { MediaGovernanceApi } from '#/api/media-governance';

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Card, Progress, Tag } from 'antdv-next';

import {
  getMediaGovernanceEvidence,
  getMediaGovernanceTask,
  startMediaGovernanceAcceptanceVerification,
  startMediaGovernanceAgent,
  startMediaGovernanceMetadataRepair,
  startMediaGovernanceMetadataVerification,
  startMediaGovernanceRun,
  submitMediaGovernanceOperatorDecision,
} from '#/api/media-governance';

import { useMediaGovernanceStream } from '../composables/useMediaGovernanceStream';

const AAlert = Alert as any;
const ACard = Card as any;
const AProgress = Progress as any;
const ATag = Tag as any;

const TABS = [
  ['overview', '概览'],
  ['sources', '来源'],
  ['mapping', '映射'],
  ['subtitles', '字幕'],
  ['metadata', '元数据'],
  ['agent', 'CodexAgent'],
  ['runs', '运行'],
  ['evidence', '证据'],
] as const;

export default defineComponent({
  name: 'MediaGovernanceTaskDetail',
  setup() {
    const route = useRoute();
    const activeTab = ref<(typeof TABS)[number][0]>('overview');
    const error = ref('');
    const evidence = ref<MediaGovernanceApi.Evidence>();
    const loading = ref(false);
    const reason = ref('已核对候选身份、季号和 provider 编号');
    const selectedCandidateId = ref('candidate-confirmed');
    const task = ref<MediaGovernanceApi.Task>();
    const taskId = computed(() => String(route.params.taskId || ''));

    async function load() {
      if (!taskId.value) return;
      const [nextTask, nextEvidence] = await Promise.all([
        getMediaGovernanceTask(taskId.value),
        getMediaGovernanceEvidence(taskId.value),
      ]);
      task.value = nextTask;
      evidence.value = nextEvidence;
    }

    async function runAction(action: () => Promise<unknown>) {
      loading.value = true;
      error.value = '';
      try {
        await action();
        await load();
      } catch (error_) {
        error.value = error_ instanceof Error ? error_.message : '任务操作失败';
      } finally {
        loading.value = false;
      }
    }

    const stream = useMediaGovernanceStream({
      onSnapshotRequired: () => void load(),
      onTaskChanged: (event) => {
        if (event.taskId === taskId.value) void load();
      },
    });

    onMounted(() => {
      void load();
      stream.start();
    });
    onBeforeUnmount(stream.close);

    function agentStatusColor(
      status: MediaGovernanceApi.AgentSession['status'],
    ) {
      if (status === 'succeeded') return 'success';
      if (status === 'failed') return 'error';
      return 'processing';
    }

    function agentStatusTag(status: MediaGovernanceApi.AgentSession['status']) {
      if (status === 'failed') return '可安全重试';
      if (status === 'needs-operator') return '等待人工放行';
      return '有界执行';
    }

    function renderOverview(item: MediaGovernanceApi.Task) {
      return (
        <div class="grid gap-4">
          <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              ['阶段', item.semanticProjection.stageLabel],
              ['状态', item.semanticProjection.runStateLabel],
              ['当前动作', item.semanticProjection.currentActionLabel],
              ['来源健康', item.semanticProjection.sourceHealthLabel],
              ['元数据', item.semanticProjection.metadataStatusLabel],
              ['阻塞', item.semanticProjection.gateReasonLabel],
            ].map(([label, value]) => (
              <div
                class="grid gap-1 rounded border border-solid border-border p-3"
                key={label}
              >
                <span class="text-sm text-muted-foreground">{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <AProgress percent={item.progress.percent} status="active" />
          <div class="grid gap-2 md:grid-cols-2">
            <div>量化进度：{item.progress.progressLabel}</div>
            <div>
              已完成 {item.progress.completedItems}/{item.progress.totalItems}{' '}
              项
            </div>
            <div>
              速率：{item.progress.speedLabel} · 剩余：{item.progress.etaLabel}
            </div>
            <div>最后心跳：{item.progress.heartbeatLabel}</div>
          </div>
          <div class="flex flex-wrap gap-2">
            {item.stage === 'download' && item.runState === 'succeeded' ? (
              <button
                class="rounded bg-primary px-4 py-2 text-primary-foreground"
                disabled={loading.value}
                onClick={() =>
                  void runAction(() =>
                    startMediaGovernanceRun(item.id, item.revision),
                  )
                }
              >
                开始本地治理
              </button>
            ) : null}
            {item.metadataStatus === 'requires-agent' &&
            item.nextCommandLabel.includes('有界元数据修复') ? (
              <button
                class="rounded bg-primary px-4 py-2 text-primary-foreground"
                disabled={loading.value}
                onClick={() =>
                  void runAction(() =>
                    startMediaGovernanceMetadataRepair(item.id, item.revision),
                  )
                }
              >
                {item.nextCommandLabel}
              </button>
            ) : null}
            {item.stage === 'metadata' &&
            item.activeRunId === null &&
            ((item.runState === 'succeeded' &&
              item.metadataStatus === 'pending') ||
              item.nextCommandLabel.includes('重新采集')) ? (
              <button
                class="rounded bg-primary px-4 py-2 text-primary-foreground"
                disabled={loading.value}
                onClick={() =>
                  void runAction(() =>
                    startMediaGovernanceMetadataVerification(
                      item.id,
                      item.revision,
                    ),
                  )
                }
              >
                {item.nextCommandLabel}
              </button>
            ) : null}
            {item.stage === 'metadata' &&
            item.runState === 'succeeded' &&
            item.metadataStatus === 'verified' &&
            item.activeRunId === null ? (
              <button
                class="rounded bg-primary px-4 py-2 text-primary-foreground"
                disabled={loading.value}
                onClick={() =>
                  void runAction(() =>
                    startMediaGovernanceAcceptanceVerification(
                      item.id,
                      item.revision,
                    ),
                  )
                }
              >
                {item.nextCommandLabel}
              </button>
            ) : null}
            {item.metadataStatus === 'requires-agent' &&
            !item.nextCommandLabel.includes('有界元数据修复') &&
            !item.nextCommandLabel.includes('重新采集') &&
            (!item.agentSession || item.agentSession.status === 'failed') ? (
              <button
                class="rounded bg-primary px-4 py-2 text-primary-foreground"
                disabled={loading.value}
                onClick={() =>
                  void runAction(() =>
                    startMediaGovernanceAgent(item.id, item.revision),
                  )
                }
              >
                {item.agentSession?.status === 'failed'
                  ? '安全重试 CodexAgent'
                  : '启动 CodexAgent 人工治理'}
              </button>
            ) : null}
          </div>
        </div>
      );
    }

    function renderSources(item: MediaGovernanceApi.Task) {
      return (
        <div class="grid gap-3">
          {item.sources.map((source) => (
            <div
              class="grid gap-2 rounded border border-solid border-border p-4"
              key={source.id}
            >
              <div class="flex flex-wrap items-center gap-2">
                <strong>
                  {source.sourceRole === 'primary_media'
                    ? '主媒体来源'
                    : '补充字幕来源'}
                </strong>
                <ATag>
                  {source.transportKind === 'magnet' ? '磁链' : '种子'}
                </ATag>
                <ATag
                  color={
                    source.sourceHealth === 'viable' ? 'success' : 'warning'
                  }
                >
                  {source.sourceHealthLabel}
                </ATag>
              </div>
              <div>种子身份哈希：{source.infoHash}</div>
              <div>发布组：{source.releaseGroup || '待识别'}</div>
              <div>所选清单：{source.selectedFileCount} 个文件</div>
              <div class="text-sm text-muted-foreground">
                {source.sourceHealthReasonLabel}
              </div>
              {source.manifest.map((file) => (
                <div class="flex justify-between text-sm" key={file.index}>
                  <span>{file.relativePath}</span>
                  <span>{file.sizeBytes} 字节</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }

    function renderSubtitles(item: MediaGovernanceApi.Task) {
      return (
        <div class="grid gap-3 md:grid-cols-2">
          {item.units.map((unit) => (
            <div
              class="rounded border border-solid border-border p-4"
              key={unit.id}
            >
              <strong>{unit.seasonNumber || '电影单元'}</strong>
              {unit.subtitleContract ? (
                <div class="mt-2 grid gap-1">
                  <div>发布组：{unit.subtitleContract.releaseGroup}</div>
                  <div>
                    覆盖：
                    {unit.subtitleContract.expectedEpisodeNumbers.join('、')}
                  </div>
                  <div>字幕文件：{unit.subtitleContract.mappings.length}</div>
                </div>
              ) : (
                <div class="mt-2 text-muted-foreground">
                  使用媒体自身字幕或等待字幕合同
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    function renderAgent(item: MediaGovernanceApi.Task) {
      const session = item.agentSession;
      return (
        <div class="grid gap-4">
          {session ? (
            <div class="grid gap-2 rounded border border-solid border-border p-4">
              <div class="flex items-center gap-2">
                <strong>{session.statusLabel}</strong>
                <ATag color={agentStatusColor(session.status)}>
                  {agentStatusTag(session.status)}
                </ATag>
              </div>
              <div>当前动作：{session.currentActionLabel}</div>
              <div>最后心跳：{session.lastHeartbeatLabel}</div>
              <div>边界：{session.policyBoundaryLabel}</div>
              <div>任务会话：{session.threadId}</div>
            </div>
          ) : (
            <AAlert message="当前尚未启动 CodexAgent" showIcon type="info" />
          )}
          {session?.status === 'needs-operator' ? (
            <div class="grid gap-3 rounded border border-solid border-warning p-4">
              <strong>人工歧义选择</strong>
              <label class="grid gap-1">
                <span>候选编号</span>
                <input
                  class="rounded border border-solid border-border bg-background px-3 py-2"
                  onInput={(event) => {
                    selectedCandidateId.value = (
                      event.target as HTMLInputElement
                    ).value;
                  }}
                  value={selectedCandidateId.value}
                />
              </label>
              <label class="grid gap-1">
                <span>放行理由</span>
                <textarea
                  class="rounded border border-solid border-border bg-background px-3 py-2"
                  onInput={(event) => {
                    reason.value = (event.target as HTMLTextAreaElement).value;
                  }}
                  value={reason.value}
                />
              </label>
              <button
                class="w-fit rounded bg-primary px-4 py-2 text-primary-foreground"
                onClick={() =>
                  void runAction(() =>
                    submitMediaGovernanceOperatorDecision(item.id, {
                      expectedRevision: item.revision,
                      reason: reason.value,
                      selectedCandidateId: selectedCandidateId.value,
                    }),
                  )
                }
              >
                确认候选并闭环
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    function renderTab(item: MediaGovernanceApi.Task) {
      if (activeTab.value === 'overview') return renderOverview(item);
      if (activeTab.value === 'sources') return renderSources(item);
      if (activeTab.value === 'subtitles') return renderSubtitles(item);
      if (activeTab.value === 'agent') return renderAgent(item);
      if (activeTab.value === 'mapping') {
        return (
          <div class="grid gap-3 md:grid-cols-2">
            {[
              ['作品名称', item.identityPreview.title],
              ['作品类型', item.identityPreview.mediaTypeLabel],
              ['季号范围', item.identityPreview.seasonLabel],
              ['首播/上映年份', item.identityPreview.releaseYearLabel],
              ['媒体资料库编号', item.identityPreview.providerLabel],
              ['身份核验状态', item.identityPreview.statusLabel],
            ].map(([label, value]) => (
              <div
                class="grid gap-1 rounded border border-solid border-border p-3"
                key={label}
              >
                <span class="text-sm text-muted-foreground">{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        );
      }
      if (activeTab.value === 'metadata') {
        return (
          <AAlert
            message={`元数据状态：${item.semanticProjection.metadataStatusLabel}`}
            showIcon
            type="info"
          />
        );
      }
      if (activeTab.value === 'runs') {
        return (
          <AAlert
            message={`${item.progress.progressLabel}；最后心跳 ${item.progress.heartbeatLabel}`}
            showIcon
            type="info"
          />
        );
      }
      return evidence.value ? (
        <div class="grid gap-2">
          <div>描述文件：{evidence.value.descriptorCount}</div>
          <div>本地验收单元：{evidence.value.localAcceptedUnitCount}</div>
          <div>事件层：{evidence.value.eventProjection}</div>
          <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {[
              ['云端写入', evidence.value.writeBoundaries.cloud ?? 0],
              ['数据库写入', evidence.value.writeBoundaries.database ?? 0],
              ['正式媒体写入', evidence.value.writeBoundaries.media ?? 0],
              ['NAS 写入', evidence.value.writeBoundaries.nas ?? 0],
              [
                'Admin 外界面写操作',
                evidence.value.writeBoundaries.uiMutationOutsideAdmin ?? 0,
              ],
            ].map(([label, value]) => (
              <div
                class="grid gap-1 rounded border border-solid border-border p-3"
                key={label}
              >
                <span class="text-sm text-muted-foreground">{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null;
    }

    return () => (
      <Page autoContentHeight>
        <div class="grid gap-4">
          {error.value ? (
            <AAlert message={error.value} showIcon type="error" />
          ) : null}
          {task.value ? (
            <ACard title={`${task.value.titleHint} · 任务详情`}>
              <div class="mb-4 flex flex-wrap gap-2 border-b border-solid border-border pb-3">
                {TABS.map(([key, label]) => (
                  <button
                    class={[
                      'rounded px-3 py-2',
                      activeTab.value === key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground',
                    ]}
                    key={key}
                    onClick={() => {
                      activeTab.value = key;
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {renderTab(task.value)}
            </ACard>
          ) : (
            <AAlert message="正在加载任务详情" showIcon type="info" />
          )}
        </div>
      </Page>
    );
  },
});
