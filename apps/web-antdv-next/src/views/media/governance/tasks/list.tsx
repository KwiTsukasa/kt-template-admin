import type { TableColumnType } from 'antdv-next';

import type { MediaGovernanceApi } from '#/api/media-governance';
import type { KtTableApi } from '#/components/ktTable';

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Card, Progress, Tag } from 'antdv-next';

import {
  addMediaGovernanceMagnetSource,
  bindMediaGovernanceSubtitleContract,
  createMediaGovernanceTask,
  getMediaGovernanceSummary,
  getMediaGovernanceTask,
  getMediaGovernanceTaskPage,
  inspectMediaGovernanceSource,
  probeMediaGovernanceSource,
  startMediaGovernanceDownload,
  startMediaGovernanceRun,
  uploadMediaGovernanceTorrentSource,
} from '#/api/media-governance';
import { KtTable, useKtTable } from '#/components/ktTable';

import { useMediaGovernanceStream } from '../composables/useMediaGovernanceStream';
import {
  buildCreateTaskInput,
  buildIdentityPreview,
  parseSeasonNumbers,
  validateIntakeForm,
} from './intake-contract';

const AAlert = Alert as any;
const ACard = Card as any;
const AKtTable = KtTable as any;
const AProgress = Progress as any;
const ATag = Tag as any;

const WIZARD_STEPS = [
  '作品身份',
  '来源',
  '文件选择',
  '字幕矩阵',
  '来源健康与下载',
  '治理就绪',
] as const;

const CONTENT_KIND_OPTIONS: Array<{
  label: string;
  value: MediaGovernanceApi.ContentKind;
}> = [
  { label: '内嵌字幕媒体', value: 'embedded_subtitle_media' },
  { label: '画面内字幕媒体', value: 'burned_in_subtitle_media' },
  { label: '同包外挂字幕媒体', value: 'bundled_sidecar_media' },
  { label: '无字幕媒体（需关联整季字幕）', value: 'subtitleless_media' },
];

type SubtitleSeasonForm = {
  episodeText: string;
  magnetUri: string;
  releaseGroup: string;
};

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = value;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function getSubtitleContractLabel(
  unit: MediaGovernanceApi.TaskUnit,
  needsSubtitle: boolean,
) {
  if (unit.subtitleContract) {
    return `${unit.subtitleContract.releaseGroup} · ${unit.subtitleContract.expectedEpisodeNumbers.length} 集已覆盖`;
  }
  return needsSubtitle ? '等待整季字幕合同' : '使用媒体自身字幕合同';
}

function getWizardStepClass(index: number, current: number) {
  if (index === current) {
    return 'border-primary bg-primary/10 font-medium text-primary';
  }
  if (index < current) return 'border-success/50 bg-success/5';
  return 'border-border text-muted-foreground';
}

export default defineComponent({
  name: 'MediaGovernanceTaskList',
  setup() {
    const router = useRouter();
    const form = reactive({
      mediaType: 'tv' as MediaGovernanceApi.MediaType,
      provider: '' as '' | MediaGovernanceApi.Provider,
      providerId: '',
      releaseYear: '',
      seasonText: 'S01',
      titleHint: '',
    });
    const sourceForm = reactive({
      contentKind: 'embedded_subtitle_media' as MediaGovernanceApi.ContentKind,
      file: undefined as File | undefined,
      magnetUri: '',
      releaseGroup: '',
      transportKind: 'magnet' as 'magnet' | 'torrent',
    });
    const subtitleSeasonForms = reactive<Record<string, SubtitleSeasonForm>>(
      {},
    );
    const activeSource = ref<MediaGovernanceApi.Source>();
    const errors = ref<string[]>([]);
    const latestTask = ref<MediaGovernanceApi.Task>();
    const recentTasks = ref<MediaGovernanceApi.Task[]>([]);
    const submitting = ref(false);
    const summary = ref<MediaGovernanceApi.Summary>({
      agentPending: 0,
      closed: 0,
      downloading: 0,
      governing: 0,
      metadataAutoClosureRate: 0,
      mixedSubtitleSeasonCount: 0,
      stagingResidualCount: 0,
      total: 0,
    });
    const wizardStep = ref(0);
    const preview = computed(() => buildIdentityPreview(form));

    function getSubtitleSeasonForm(seasonNumber: string) {
      subtitleSeasonForms[seasonNumber] ??= {
        episodeText: '1',
        magnetUri: '',
        releaseGroup: '',
      };
      return subtitleSeasonForms[seasonNumber];
    }

    const columns: Array<TableColumnType<MediaGovernanceApi.Task>> = [
      { dataIndex: 'titleHint', key: 'titleHint', title: '标题', width: 220 },
      {
        dataIndex: 'governanceProfile',
        key: 'governanceProfile',
        title: '治理类型',
        width: 150,
      },
      {
        dataIndex: 'semanticProjection',
        key: 'currentAction',
        title: '当前动作',
        width: 220,
      },
      { dataIndex: 'progress', key: 'progress', title: '进度', width: 180 },
      {
        dataIndex: 'metadataStatus',
        key: 'metadataStatus',
        title: '元数据',
        width: 130,
      },
      { dataIndex: 'gateReason', key: 'gateReason', title: '阻塞', width: 140 },
    ];
    const api: KtTableApi<MediaGovernanceApi.Task> = {
      list: async (params) => await getMediaGovernanceTaskPage(params),
    };
    const [registerTable, tableApi] = useKtTable<MediaGovernanceApi.Task>({
      api,
      columns,
      formOptions: {
        schema: [
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: [
                { label: '接收资料', value: 'intake' },
                { label: 'NAS 下载', value: 'download' },
                { label: '本地治理', value: 'governance' },
                { label: '元数据核验', value: 'metadata' },
                { label: '独立验收', value: 'acceptance' },
                { label: '已闭环', value: 'closed' },
              ],
            },
            fieldName: 'stage',
            label: '阶段',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: [
                { label: '草稿', value: 'draft' },
                { label: '队列中', value: 'queued' },
                { label: '执行中', value: 'running' },
                { label: '等待处理', value: 'blocked' },
                { label: '已完成', value: 'succeeded' },
              ],
            },
            fieldName: 'runState',
            label: '状态',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: [
                { label: '内嵌字幕', value: 'embedded' },
                { label: '同包外挂字幕', value: 'sidecar-bundled' },
                { label: '关联外挂字幕', value: 'sidecar-linked' },
              ],
            },
            fieldName: 'governanceProfile',
            label: '治理类型',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: [
                { label: '待校验', value: 'pending' },
                { label: '需要人工治理', value: 'requires-agent' },
                { label: '已验证', value: 'verified' },
              ],
            },
            fieldName: 'metadataStatus',
            label: '元数据',
          },
        ],
      },
      tableTitle: '媒体治理任务',
    });

    async function loadDashboard() {
      const [nextSummary, page] = await Promise.all([
        getMediaGovernanceSummary(),
        getMediaGovernanceTaskPage({ pageNo: 1, pageSize: 5 }),
      ]);
      summary.value = nextSummary;
      recentTasks.value = page.items;
    }

    async function refreshLatestTask() {
      if (!latestTask.value) return;
      latestTask.value = await getMediaGovernanceTask(latestTask.value.id);
      activeSource.value = latestTask.value.sources.find(
        (source) => source.sourceRole === 'primary_media',
      );
    }

    async function refreshAll() {
      await Promise.all([loadDashboard(), tableApi.reload()]);
      await refreshLatestTask();
    }

    async function handleCreateTask(event: Event) {
      event.preventDefault();
      errors.value = validateIntakeForm(form);
      if (errors.value.length > 0) return;
      await runAction(async () => {
        latestTask.value = await createMediaGovernanceTask(
          buildCreateTaskInput(form),
        );
        wizardStep.value = 1;
      });
    }

    async function handleAddSource(event: Event) {
      event.preventDefault();
      const task = latestTask.value;
      if (!task) return;
      if (
        sourceForm.transportKind === 'magnet' &&
        !sourceForm.magnetUri.trim()
      ) {
        errors.value = ['必须填写磁链'];
        return;
      }
      if (sourceForm.transportKind === 'torrent' && !sourceForm.file) {
        errors.value = ['必须选择种子文件'];
        return;
      }
      await runAction(async () => {
        const input = {
          contentKind: sourceForm.contentKind,
          expectedRevision: task.revision,
          releaseGroup: sourceForm.releaseGroup.trim() || undefined,
          seasonNumbers: parseSeasonNumbers(form.seasonText),
          sourceRole: 'primary_media' as const,
        };
        activeSource.value =
          sourceForm.transportKind === 'torrent'
            ? await uploadMediaGovernanceTorrentSource(
                task.id,
                sourceForm.file as File,
                input,
              )
            : await addMediaGovernanceMagnetSource(task.id, {
                ...input,
                magnetUri: sourceForm.magnetUri.trim(),
              });
        await refreshLatestTask();
        wizardStep.value = 2;
      });
    }

    async function handleInspect() {
      const task = latestTask.value;
      const source = activeSource.value;
      if (!task || !source) return;
      await runAction(async () => {
        if (source.manifestState !== 'inspected') {
          await inspectMediaGovernanceSource(task.id, source.id, task.revision);
          await refreshLatestTask();
        }
        wizardStep.value = 3;
      });
    }

    async function handleSubtitleStep() {
      const task = latestTask.value;
      if (!task) return;
      if (sourceForm.contentKind !== 'subtitleless_media') {
        wizardStep.value = 4;
        return;
      }
      const seasonUnits = task.units.filter(
        (
          unit,
        ): unit is MediaGovernanceApi.TaskUnit & { seasonNumber: string } =>
          Boolean(unit.seasonNumber),
      );
      const invalidSeason = seasonUnits.find((unit) => {
        const seasonForm = getSubtitleSeasonForm(unit.seasonNumber);
        const episodes = seasonForm.episodeText
          .split(/[\s,，]+/)
          .map(Number)
          .filter((value) => Number.isInteger(value) && value >= 0);
        return (
          !seasonForm.magnetUri.trim() ||
          !seasonForm.releaseGroup.trim() ||
          episodes.length === 0
        );
      });
      if (invalidSeason) {
        errors.value = [
          `${invalidSeason.seasonNumber} 必须填写一个完整字幕磁链、发布组和覆盖集号`,
        ];
        return;
      }
      await runAction(async () => {
        for (const unit of seasonUnits) {
          const seasonForm = getSubtitleSeasonForm(unit.seasonNumber);
          const episodes = seasonForm.episodeText
            .split(/[\s,，]+/)
            .map(Number)
            .filter((value) => Number.isInteger(value) && value >= 0);
          let current = latestTask.value as MediaGovernanceApi.Task;
          const subtitleSource = await addMediaGovernanceMagnetSource(
            current.id,
            {
              contentKind: 'sidecar_subtitle_package',
              expectedRevision: current.revision,
              magnetUri: seasonForm.magnetUri.trim(),
              releaseGroup: seasonForm.releaseGroup.trim(),
              seasonNumbers: [unit.seasonNumber],
              sourceRole: 'supplemental_subtitle',
            },
          );
          await refreshLatestTask();
          current = latestTask.value as MediaGovernanceApi.Task;
          await bindMediaGovernanceSubtitleContract(current.id, unit.id, {
            expectedEpisodeNumbers: episodes,
            expectedRevision: current.revision,
            mappings: episodes.map((episodeNumber) => ({
              episodeNumber,
              relativePath: `${unit.seasonNumber}/${String(episodeNumber).padStart(2, '0')}.zh-Hans.ass`,
            })),
            releaseGroup: seasonForm.releaseGroup.trim(),
            sourceId: subtitleSource.id,
          });
          await refreshLatestTask();
        }
        wizardStep.value = 4;
      });
    }

    async function handleProbeAndDownload() {
      const task = latestTask.value;
      if (!task) return;
      await runAction(async () => {
        const sourceIds = task.sources.map((source) => source.id);
        for (const sourceId of sourceIds) {
          let current = latestTask.value as MediaGovernanceApi.Task;
          let source = current.sources.find((item) => item.id === sourceId);
          if (!source) continue;
          if (source.manifestState !== 'inspected') {
            await inspectMediaGovernanceSource(
              current.id,
              source.id,
              current.revision,
            );
            await refreshLatestTask();
          }
          current = latestTask.value as MediaGovernanceApi.Task;
          source = current.sources.find((item) => item.id === sourceId);
          if (source && source.sourceHealth !== 'viable') {
            await probeMediaGovernanceSource(
              current.id,
              source.id,
              current.revision,
            );
            await refreshLatestTask();
          }
        }
        const current = latestTask.value as MediaGovernanceApi.Task;
        await startMediaGovernanceDownload(current.id, current.revision);
        await refreshLatestTask();
        wizardStep.value = 5;
      });
    }

    async function handleStartGovernance() {
      const task = latestTask.value;
      if (!task) return;
      await runAction(async () => {
        await startMediaGovernanceRun(task.id, task.revision);
        await refreshLatestTask();
      });
    }

    async function runAction(action: () => Promise<void>) {
      submitting.value = true;
      errors.value = [];
      try {
        await action();
        await refreshAll();
      } catch (error) {
        errors.value = [
          error instanceof Error ? error.message : '媒体治理操作失败',
        ];
      } finally {
        submitting.value = false;
      }
    }

    const stream = useMediaGovernanceStream({
      onSnapshotRequired: () => void refreshAll(),
      onTaskChanged: (event) => {
        if (!latestTask.value || latestTask.value.id === event.taskId) {
          void refreshAll();
        } else {
          void Promise.all([loadDashboard(), tableApi.reload()]);
        }
      },
    });

    onMounted(() => {
      void loadDashboard();
      stream.start();
    });
    onBeforeUnmount(stream.close);

    function renderWizardBody() {
      const task = latestTask.value;
      if (wizardStep.value === 0) {
        return (
          <form class="grid gap-4" onSubmit={handleCreateTask}>
            <label class="grid gap-1">
              <span class="font-medium">作品名</span>
              <input
                class="rounded border border-solid border-border bg-background px-3 py-2"
                data-testid="title-hint"
                maxlength="200"
                onInput={(event) => {
                  form.titleHint = (event.target as HTMLInputElement).value;
                }}
                placeholder="例如：异世界迷宫黑心企业"
                value={form.titleHint}
              />
            </label>
            <div class="grid gap-4 md:grid-cols-2">
              <label class="grid gap-1">
                <span class="font-medium">作品类型</span>
                <select
                  class="rounded border border-solid border-border bg-background px-3 py-2"
                  data-testid="media-type"
                  onChange={(event) => {
                    form.mediaType = (event.target as HTMLSelectElement)
                      .value as MediaGovernanceApi.MediaType;
                  }}
                  value={form.mediaType}
                >
                  <option value="tv">TV 正常剧集</option>
                  <option value="movie">Movie 电影</option>
                  <option value="theatrical">Theatrical 剧场版</option>
                </select>
              </label>
              <label class="grid gap-1">
                <span class="font-medium">TV 季号</span>
                <input
                  class="rounded border border-solid border-border bg-background px-3 py-2"
                  data-testid="season-numbers"
                  onInput={(event) => {
                    form.seasonText = (event.target as HTMLInputElement).value;
                  }}
                  placeholder="S00, S01"
                  value={form.seasonText}
                />
                <span class="text-sm text-muted-foreground">
                  TV 必须填写季号；特别篇/番外篇使用 S00。电影和剧场版不填写。
                </span>
              </label>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <label class="grid gap-1">
                <span class="font-medium">首播/上映年份（可选）</span>
                <input
                  class="rounded border border-solid border-border bg-background px-3 py-2"
                  data-testid="release-year"
                  inputmode="numeric"
                  onInput={(event) => {
                    form.releaseYear = (event.target as HTMLInputElement).value;
                  }}
                  placeholder="2021"
                  value={form.releaseYear}
                />
                <span class="text-sm text-muted-foreground">
                  同名作品较多时用于缩小范围；填错会造成候选身份偏移。
                </span>
              </label>
              <div class="grid gap-1">
                <span class="font-medium">媒体资料库编号（可选）</span>
                <div class="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
                  <select
                    class="rounded border border-solid border-border bg-background px-3 py-2"
                    data-testid="provider"
                    onChange={(event) => {
                      form.provider = (event.target as HTMLSelectElement)
                        .value as '' | MediaGovernanceApi.Provider;
                    }}
                    value={form.provider}
                  >
                    <option value="">请选择</option>
                    <option value="tmdb">TMDB</option>
                    <option value="tvdb">TVDB</option>
                    <option value="bangumi">Bangumi</option>
                  </select>
                  <input
                    class="rounded border border-solid border-border bg-background px-3 py-2"
                    data-testid="provider-id"
                    onInput={(event) => {
                      form.providerId = (
                        event.target as HTMLInputElement
                      ).value;
                    }}
                    placeholder="例如：105476"
                    value={form.providerId}
                  />
                </div>
                <span class="text-sm text-muted-foreground">
                  用于锁定唯一作品；填错会关联到另一部作品，保存后仍需资料源核验。
                </span>
              </div>
            </div>
            <div class="rounded border border-solid border-border bg-muted/30 p-3">
              <div class="mb-1 flex items-center gap-2 font-medium">
                候选身份预览 <ATag color="warning">待资料源核验</ATag>
              </div>
              <div data-testid="identity-preview">{preview.value}</div>
            </div>
            <button
              class="w-fit rounded bg-primary px-4 py-2 text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              disabled={submitting.value}
              type="submit"
            >
              {submitting.value ? '正在创建…' : '创建草稿并继续'}
            </button>
          </form>
        );
      }
      if (wizardStep.value === 1 && task) {
        return (
          <form class="grid gap-4" onSubmit={handleAddSource}>
            <AAlert
              message="描述文件只进入媒体专用私有存储；追踪器地址与访问凭据不进入列表、日志或实时事件。"
              showIcon
              type="info"
            />
            <div class="grid gap-4 md:grid-cols-2">
              <label class="grid gap-1">
                <span class="font-medium">来源方式</span>
                <select
                  class="rounded border border-solid border-border bg-background px-3 py-2"
                  data-testid="source-transport"
                  onChange={(event) => {
                    sourceForm.transportKind = (
                      event.target as HTMLSelectElement
                    ).value as 'magnet' | 'torrent';
                  }}
                  value={sourceForm.transportKind}
                >
                  <option value="magnet">磁链</option>
                  <option value="torrent">种子文件</option>
                </select>
              </label>
              <label class="grid gap-1">
                <span class="font-medium">治理类型</span>
                <select
                  class="rounded border border-solid border-border bg-background px-3 py-2"
                  data-testid="content-kind"
                  onChange={(event) => {
                    sourceForm.contentKind = (event.target as HTMLSelectElement)
                      .value as MediaGovernanceApi.ContentKind;
                  }}
                  value={sourceForm.contentKind}
                >
                  {CONTENT_KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {sourceForm.transportKind === 'magnet' ? (
              <label class="grid gap-1">
                <span class="font-medium">磁链</span>
                <textarea
                  class="min-h-24 rounded border border-solid border-border bg-background px-3 py-2"
                  data-testid="magnet-uri"
                  onInput={(event) => {
                    sourceForm.magnetUri = (
                      event.target as HTMLTextAreaElement
                    ).value;
                  }}
                  placeholder="magnet:?xt=urn:btih:..."
                  value={sourceForm.magnetUri}
                />
              </label>
            ) : (
              <label class="grid gap-1">
                <span class="font-medium">种子描述文件（最大 2 MiB）</span>
                <input
                  accept=".torrent,application/x-bittorrent"
                  class="rounded border border-solid border-border bg-background px-3 py-2"
                  data-testid="torrent-file"
                  onChange={(event) => {
                    sourceForm.file = (
                      event.target as HTMLInputElement
                    ).files?.[0];
                  }}
                  type="file"
                />
              </label>
            )}
            <label class="grid gap-1">
              <span class="font-medium">发布组（可选）</span>
              <input
                class="rounded border border-solid border-border bg-background px-3 py-2"
                onInput={(event) => {
                  sourceForm.releaseGroup = (
                    event.target as HTMLInputElement
                  ).value;
                }}
                placeholder="例如：DBD-Raws"
                value={sourceForm.releaseGroup}
              />
            </label>
            <button
              class="w-fit rounded bg-primary px-4 py-2 text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              disabled={submitting.value}
              type="submit"
            >
              添加来源并继续
            </button>
          </form>
        );
      }
      if (wizardStep.value === 2 && task && activeSource.value) {
        return (
          <div class="grid gap-4">
            <AAlert
              message={`来源身份：${activeSource.value.infoHash}；清单状态：${
                activeSource.value.manifestState === 'inspected'
                  ? '已安全解析'
                  : '等待检查'
              }`}
              showIcon
              type="info"
            />
            <div class="grid gap-2">
              {(activeSource.value.manifest.length > 0
                ? activeSource.value.manifest
                : [{ index: 0, relativePath: '等待获取来源清单', sizeBytes: 0 }]
              ).map((file) => (
                <div
                  class="flex justify-between rounded border border-solid border-border p-3"
                  key={`${file.index}-${file.relativePath}`}
                >
                  <span>{file.relativePath}</span>
                  <span>{formatBytes(file.sizeBytes)}</span>
                </div>
              ))}
            </div>
            <button
              class="w-fit rounded bg-primary px-4 py-2 text-primary-foreground"
              onClick={() => void handleInspect()}
            >
              检查清单并继续
            </button>
          </div>
        );
      }
      if (wizardStep.value === 3 && task) {
        const needsSubtitle = sourceForm.contentKind === 'subtitleless_media';
        return (
          <div class="grid gap-4">
            <AAlert
              message={
                needsSubtitle
                  ? '无字幕媒体必须按季绑定完整字幕包；同一季只能使用一个发布组。'
                  : '当前媒体已声明内嵌、画面内或同包外挂字幕，可直接进入来源健康检查。'
              }
              showIcon
              type={needsSubtitle ? 'warning' : 'success'}
            />
            {needsSubtitle ? (
              <div class="grid gap-4 md:grid-cols-2">
                {task.units
                  .filter((unit) => unit.seasonNumber)
                  .map((unit) => {
                    const seasonForm = getSubtitleSeasonForm(
                      unit.seasonNumber as string,
                    );
                    return (
                      <div
                        class="grid gap-3 rounded border border-solid border-border p-4"
                        key={unit.id}
                      >
                        <strong>{unit.seasonNumber} 整季字幕</strong>
                        <label class="grid gap-1">
                          <span>字幕磁链</span>
                          <textarea
                            class="min-h-20 rounded border border-solid border-border bg-background px-3 py-2"
                            data-testid={`subtitle-magnet-${unit.seasonNumber}`}
                            onInput={(event) => {
                              seasonForm.magnetUri = (
                                event.target as HTMLTextAreaElement
                              ).value;
                            }}
                            value={seasonForm.magnetUri}
                          />
                        </label>
                        <label class="grid gap-1">
                          <span>本季字幕发布组</span>
                          <input
                            class="rounded border border-solid border-border bg-background px-3 py-2"
                            data-testid={`subtitle-release-group-${unit.seasonNumber}`}
                            onInput={(event) => {
                              seasonForm.releaseGroup = (
                                event.target as HTMLInputElement
                              ).value;
                            }}
                            value={seasonForm.releaseGroup}
                          />
                        </label>
                        <label class="grid gap-1">
                          <span>本季覆盖集号</span>
                          <input
                            class="rounded border border-solid border-border bg-background px-3 py-2"
                            data-testid={`subtitle-episodes-${unit.seasonNumber}`}
                            onInput={(event) => {
                              seasonForm.episodeText = (
                                event.target as HTMLInputElement
                              ).value;
                            }}
                            placeholder="1, 2, 3"
                            value={seasonForm.episodeText}
                          />
                        </label>
                      </div>
                    );
                  })}
              </div>
            ) : null}
            <div class="grid gap-2 md:grid-cols-2">
              {task.units.map((unit) => (
                <div
                  class="rounded border border-solid border-border p-3"
                  key={unit.id}
                >
                  <div class="font-medium">
                    {unit.seasonNumber || '电影单元'}
                  </div>
                  <div class="text-sm text-muted-foreground">
                    {getSubtitleContractLabel(unit, needsSubtitle)}
                  </div>
                </div>
              ))}
            </div>
            <button
              class="w-fit rounded bg-primary px-4 py-2 text-primary-foreground"
              onClick={() => void handleSubtitleStep()}
            >
              {needsSubtitle ? '绑定整季字幕并继续' : '字幕合同已确认，继续'}
            </button>
          </div>
        );
      }
      if (wizardStep.value === 4 && task && activeSource.value) {
        return (
          <div class="grid gap-4">
            <AAlert
              message={
                task.persistenceMode === 'database'
                  ? '先执行有界死种/死链探针；通过后由 NAS 执行器在任务隔离目录下载，并持续回传量化进度。'
                  : '当前后端处于进程内模拟模式，不会写入 NAS 正式媒体目录。'
              }
              showIcon
              type="info"
            />
            <div class="grid gap-2 md:grid-cols-3">
              <div class="grid gap-1 rounded border border-solid border-border bg-card p-3">
                <span>来源健康</span>
                <strong>{activeSource.value.sourceHealthLabel}</strong>
              </div>
              <div class="grid gap-1 rounded border border-solid border-border bg-card p-3">
                <span>所选文件</span>
                <strong>{activeSource.value.selectedFileCount}</strong>
              </div>
              <div class="grid gap-1 rounded border border-solid border-border bg-card p-3">
                <span>所选大小</span>
                <strong>{formatBytes(activeSource.value.selectedBytes)}</strong>
              </div>
            </div>
            <button
              class="w-fit rounded bg-primary px-4 py-2 text-primary-foreground"
              onClick={() => void handleProbeAndDownload()}
            >
              探针通过后启动下载
            </button>
          </div>
        );
      }
      if (wizardStep.value === 5 && task) {
        return (
          <div class="grid gap-4">
            <AProgress percent={task.progress.percent} status="active" />
            <div class="grid gap-2 md:grid-cols-2">
              <div class="grid gap-1 rounded border border-solid border-border bg-card p-3">
                <span>当前动作</span>
                <strong>{task.progress.progressLabel}</strong>
              </div>
              <div class="grid gap-1 rounded border border-solid border-border bg-card p-3">
                <span>速率 / 剩余</span>
                <strong>
                  {task.progress.speedLabel} · {task.progress.etaLabel}
                </strong>
              </div>
              <div class="grid gap-1 rounded border border-solid border-border bg-card p-3">
                <span>完成量</span>
                <strong>
                  {task.progress.completedItems}/{task.progress.totalItems} 项
                </strong>
              </div>
              <div class="grid gap-1 rounded border border-solid border-border bg-card p-3">
                <span>最后心跳</span>
                <strong>{task.progress.heartbeatLabel}</strong>
              </div>
            </div>
            <button
              class="w-fit rounded bg-primary px-4 py-2 text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                task.stage !== 'download' || task.runState !== 'succeeded'
              }
              onClick={() => void handleStartGovernance()}
            >
              {task.runState === 'succeeded'
                ? '开始本地治理'
                : '等待来源载荷就绪'}
            </button>
            <a
              class="text-primary"
              href={
                router.resolve({
                  name: 'MediaGovernanceTaskDetail',
                  params: { taskId: task.id },
                }).href
              }
            >
              打开任务详情与 CodexAgent 面板
            </a>
          </div>
        );
      }
      return null;
    }

    return () => (
      <Page autoContentHeight>
        <div class="grid gap-4">
          <div class="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            {[
              ['任务总数', summary.value.total],
              ['下载中', summary.value.downloading],
              ['治理中', summary.value.governing],
              ['Agent 待治理', summary.value.agentPending],
              ['已闭环', summary.value.closed],
              ['自动闭环率', `${summary.value.metadataAutoClosureRate}%`],
              ['暂存目录残留', summary.value.stagingResidualCount],
              ['混合字幕季', summary.value.mixedSubtitleSeasonCount],
            ].map(([label, value]) => (
              <div
                class="grid gap-1 rounded border border-solid border-border bg-card p-3"
                key={String(label)}
              >
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <ACard title="新建媒体治理任务">
            <AAlert
              class="mb-4"
              message="来源、字幕合同与作品身份会先密封校验；正式媒体写入仅由 NAS 执行器按任务边界执行，页面持续显示语义进度。"
              showIcon
              type="info"
            />
            {errors.value.length > 0 ? (
              <AAlert
                class="mb-4"
                message={errors.value.join('；')}
                showIcon
                type="error"
              />
            ) : null}
            <div class="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-6">
              {WIZARD_STEPS.map((step, index) => (
                <div
                  class={[
                    'rounded border border-solid px-3 py-2 text-center text-sm',
                    getWizardStepClass(index, wizardStep.value),
                  ]}
                  data-active={index === wizardStep.value ? 'true' : 'false'}
                  key={step}
                >
                  {index + 1}. {step}
                </div>
              ))}
            </div>
            {renderWizardBody()}
          </ACard>

          <AKtTable
            onRegister={registerTable}
            v-slots={{
              bodyCell: ({ column, record }: any) => {
                const row = record as MediaGovernanceApi.Task;
                if (column.key === 'titleHint') {
                  return (
                    <a
                      href={
                        router.resolve({
                          name: 'MediaGovernanceTaskDetail',
                          params: { taskId: row.id },
                        }).href
                      }
                    >
                      {row.titleHint}
                    </a>
                  );
                }
                if (column.key === 'governanceProfile') {
                  const labels: Record<string, string> = {
                    embedded: '内嵌字幕',
                    'sidecar-bundled': '同包外挂字幕',
                    'sidecar-linked': '关联外挂字幕',
                  };
                  return labels[row.governanceProfile || ''] || '待选择';
                }
                if (column.key === 'currentAction') {
                  return row.semanticProjection.currentActionLabel;
                }
                if (column.key === 'progress') {
                  return `${row.progress.percent}% · ${row.progress.progressLabel}`;
                }
                if (column.key === 'metadataStatus') {
                  return row.semanticProjection.metadataStatusLabel;
                }
                if (column.key === 'gateReason') {
                  return row.semanticProjection.gateReasonLabel;
                }
                return undefined;
              },
            }}
          />

          {recentTasks.value.length > 0 ? (
            <div class="text-sm text-muted-foreground">
              最近任务：
              {recentTasks.value.map((task) => task.titleHint).join('、')}
            </div>
          ) : null}
        </div>
      </Page>
    );
  },
});
