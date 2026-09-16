import type { MediaGovernanceTaskDrawerExposed } from '../tasks/components/MediaGovernanceTaskDrawer';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { computed, defineComponent, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';

import { message, Select } from 'antdv-next';

import { getMediaGovernanceSeries } from '#/api/media-governance';

import MediaGovernanceTaskDrawer from '../tasks/components/MediaGovernanceTaskDrawer';
import { useSeriesActions } from './useSeriesActions';

const ASelect = Select as any;

export type SeriesQuickAction = 'batch' | 'rss' | 'season' | 'task' | 'work';
export interface SeriesQuickActionsExposed {
  open: (
    series: MediaGovernanceApi.SeriesCard,
    action: SeriesQuickAction,
  ) => Promise<void>;
}

export const SERIES_ACTION_LABELS: Record<SeriesQuickAction, string> = {
  work: '添加作品',
  task: '创建执行任务',
  season: '添加季',
  batch: '批量添加磁链',
  rss: '创建 RSS 订阅',
};

/**
 * 将目录创建和来源接入操作分别映射到已有后端权限。
 * @param action - 资料库快捷操作类型。
 * @returns 后端对应接口要求的权限码。
 */
export function seriesActionPermission(action: SeriesQuickAction) {
  if (action === 'batch' || action === 'rss')
    return 'Media:Governance:SourceUpload';
  return 'Media:Governance:Create';
}

export default defineComponent({
  name: 'MediaGovernanceSeriesQuickActions',
  emits: ['changed'],
  setup(_props, { emit, expose }) {
    const { hasAccessByCodes } = useAccess();
    const detail = ref<MediaGovernanceApi.SeriesDetail>();
    const seriesId = computed(() => detail.value?.series.id || '');
    const selectedWorkId = ref<string>();
    const selectedSeasonNumber = ref<number>();
    const selectedWork = computed(() =>
      detail.value?.works.find((work) => work.id === selectedWorkId.value),
    );
    const selectedSeason = computed(() =>
      selectedWork.value?.seasons.find(
        (season) => season.seasonNumber === selectedSeasonNumber.value,
      ),
    );
    const action = ref<SeriesQuickAction>('work');
    const taskDrawer = ref<MediaGovernanceTaskDrawerExposed>();
    let requestVersion = 0;
    const eligibleWorks = computed(() => {
      const works = detail.value?.works || [];
      if (action.value === 'work' || action.value === 'task') return works;
      return works.filter((work) => work.workType === 'tv');
    });
    const needsSeason = computed(
      () => selectedWork.value?.workType === 'tv' && action.value !== 'season',
    );
    const actions = useSeriesActions({
      detail,
      seriesId,
      selectedWork,
      selectedSeason,
      selectedSeasonNumber,
      loadDetail: refresh,
      loadEpisodes: async () => {
        emit('changed');
      },
      selectWork,
      openTask: (id) => taskDrawer.value?.open(id),
    });
    const [ContextModal, contextModal] = useVbenModal({
      confirmText: '继续',
      /**
       * 在明确选择作品和必要的季后，提交任务创建或打开对应编辑表单。
       */
      async onConfirm() {
        if (!selectedWork.value || (needsSeason.value && !selectedSeason.value))
          return;
        contextModal.lock();
        try {
          if (action.value === 'task') await actions.createWorkTask();
          await contextModal.close();
          if (action.value === 'season') actions.openSeason();
          if (action.value === 'batch') await actions.openBatch();
          if (action.value === 'rss') actions.openRss();
        } finally {
          contextModal.unlock();
        }
      },
    });

    /**
     * 保存后回读当前系列并通知外层卡片刷新。
     */
    async function refresh() {
      if (!seriesId.value) return;
      detail.value = await getMediaGovernanceSeries(seriesId.value);
      emit('changed');
    }

    /**
     * 切换已加载作品并清空上一作品的季选择。
     * @param workId - 当前系列内用户选择的作品标识。
     */
    function selectWork(workId: string) {
      selectedWorkId.value = workId;
      selectedSeasonNumber.value = undefined;
      const seasons = selectedWork.value?.seasons || [];
      if (seasons.length === 1)
        selectedSeasonNumber.value = seasons[0]?.seasonNumber;
    }

    /**
     * 回读目标系列的权威作品与季，随后在当前页面打开相应操作表单。
     * @param series - 被点击卡片的系列身份。
     * @param requestedAction - 用户明确选择的快捷操作。
     */
    async function open(
      series: MediaGovernanceApi.SeriesCard,
      requestedAction: SeriesQuickAction,
    ) {
      if (!hasAccessByCodes([seriesActionPermission(requestedAction)])) return;
      const request = ++requestVersion;
      const snapshot = await getMediaGovernanceSeries(series.id);
      if (request !== requestVersion) return;
      detail.value = snapshot;
      action.value = requestedAction;
      selectedWorkId.value = undefined;
      selectedSeasonNumber.value = undefined;
      if (requestedAction === 'work') {
        actions.openWork();
        return;
      }
      if (eligibleWorks.value.length === 0) {
        message.info('该系列暂无可执行此操作的作品');
        return;
      }
      const onlyWork = eligibleWorks.value[0];
      if (eligibleWorks.value.length === 1 && onlyWork) selectWork(onlyWork.id);
      contextModal
        .setState({ title: SERIES_ACTION_LABELS[requestedAction] })
        .open();
    }

    expose({ open } satisfies SeriesQuickActionsExposed);
    return () => (
      <div>
        <ContextModal
          confirmDisabled={
            !selectedWork.value || (needsSeason.value && !selectedSeason.value)
          }
        >
          <div class="grid min-w-0 gap-4">
            <label class="grid min-w-0 gap-2">
              <span>作品</span>
              <ASelect
                aria-label="作品"
                class="w-full min-w-0"
                onChange={selectWork}
                options={eligibleWorks.value.map((work) => ({
                  label: work.title,
                  value: work.id,
                }))}
                value={selectedWorkId.value}
              />
            </label>
            {needsSeason.value && (
              <label class="grid min-w-0 gap-2">
                <span>季</span>
                <ASelect
                  aria-label="季"
                  class="w-full min-w-0"
                  onChange={(value: number) => {
                    selectedSeasonNumber.value = value;
                  }}
                  options={selectedWork.value?.seasons.map((season) => ({
                    label: `S${season.seasonNumber} · ${season.title}`,
                    value: season.seasonNumber,
                  }))}
                  value={selectedSeasonNumber.value}
                />
              </label>
            )}
          </div>
        </ContextModal>
        {actions.renderModals()}
        <MediaGovernanceTaskDrawer
          onChanged={() => void refresh()}
          ref={taskDrawer}
        />
      </div>
    );
  },
});
