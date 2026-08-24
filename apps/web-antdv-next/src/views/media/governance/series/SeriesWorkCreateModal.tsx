import type { MediaGovernanceApi } from '#/api/media-governance';

import { defineComponent, h, markRaw, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { CheckOutlined, SearchOutlined } from '@antdv-next/icons';
import { Button, Empty, InputSearch, message, Spin, Tag } from 'antdv-next';

import { useVbenForm, z } from '#/adapter/form';
import {
  createMediaGovernanceSeries,
  createMediaGovernanceWork,
  getMediaGovernanceCatalogIdentityCandidates,
} from '#/api/media-governance';

import './SeriesWorkCreateModal.scss';

const AButton = Button as any;
const AEmpty = Empty as any;
const ASpin = Spin as any;
const ATag = Tag as any;

const WORK_TYPE_OPTIONS = [
  { label: 'TV', value: 'tv' },
  { label: '电影', value: 'movie' },
  { label: '剧场版', value: 'theatrical' },
];

export interface SeriesWorkCreateModalExposed {
  openCreateSeries: () => void;
  openCreateWork: (seriesId: string) => void;
}

type CreateMode = 'series' | 'work';

export default defineComponent({
  name: 'MediaGovernanceSeriesWorkCreateModal',
  emits: ['saved'],
  setup(_, { emit, expose }) {
    const candidates = ref<MediaGovernanceApi.RssIdentityCandidate[]>([]);
    const loading = ref(false);
    const mode = ref<CreateMode>('series');
    const selected = ref<MediaGovernanceApi.RssIdentityCandidate>();
    const targetSeriesId = ref<string>();
    let searchSequence = 0;
    const [IdentityForm, identityFormApi] = useVbenForm({
      /**
       * Work 类型变化后废弃旧候选，防止跨 TMDB 命名空间提交。
       * @param _values - 当前完整表单值；本回调只使用变更字段集合。
       * @param fieldsChanged - 本轮发生变化的字段名。
       */
      handleValuesChange(_values, fieldsChanged) {
        if (!fieldsChanged.includes('workType')) return;
        invalidateSelection();
      },
      layout: 'vertical',
      schema: [
        {
          component: 'Select',
          componentProps: { options: WORK_TYPE_OPTIONS },
          defaultValue: 'tv',
          fieldName: 'workType',
          label: '作品类型',
          rules: 'selectRequired',
        },
        {
          component: markRaw(InputSearch),
          componentProps: () => ({
            allowClear: true,
            enterButton: h(SearchOutlined, { 'aria-label': '搜索作品身份' }),
            loading: loading.value,
            maxlength: 120,
            onSearch: () => void searchIdentities(),
            placeholder: '输入作品名后选择唯一资料身份',
          }),
          fieldName: 'keyword',
          formItemClass: 'col-span-1 sm:col-span-2',
          label: '作品身份搜索',
          modelPropName: 'value',
          rules: z.string().trim().min(1, '请输入作品名').max(120),
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1 sm:grid-cols-2',
    });
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[920px]',
      confirmDisabled: true,
      confirmText: '创建',
      fullscreenButton: true,
      /**
       * 把未失效的已选候选交给服务端二次核验，并复用统一锁完成提交收口。
       */
      async onConfirm() {
        await submit();
      },
      /**
       * 打开态递增 requestSequence 使在途搜索失效，并重建 TV 默认表单；关闭态不触碰异步状态。
       * @param isOpen - 通用 Modal 最新显隐状态。
       */
      onOpenChange(isOpen) {
        if (isOpen) void reset();
      },
    });

    /**
     * 清空候选与选择，并在身份重新确认前禁用创建按钮。
     */
    function invalidateSelection() {
      searchSequence += 1;
      candidates.value = [];
      selected.value = undefined;
      modalApi.setState({ confirmDisabled: true });
    }

    /**
     * 在列表上下文打开 Series 创建，并让身份成为主 Work。
     */
    function openCreateSeries() {
      mode.value = 'series';
      targetSeriesId.value = undefined;
      modalApi.setState({ title: '新建媒体系列' }).open();
    }

    /**
     * 先绑定目标 Series 并切换为 Work 模式，再打开 Modal；身份事实仍等待用户搜索选择。
     *
     * @param seriesId - 新 Work 所属 Series 标识。
     */
    function openCreateWork(seriesId: string) {
      mode.value = 'work';
      targetSeriesId.value = seriesId;
      modalApi.setState({ title: '向系列添加作品' }).open();
    }

    /**
     * 废弃并发搜索结果，清空旧校验，再把 Work 类型稳定恢复为 TV。
     */
    async function reset() {
      invalidateSelection();
      await identityFormApi.resetForm();
      await identityFormApi.setValues({ keyword: '', workType: 'tv' });
      await identityFormApi.resetValidate();
    }

    /**
     * 按当前表单关键词和 Work 类型执行 latest-wins 身份搜索。
     */
    async function searchIdentities() {
      const { valid } = await identityFormApi.validate();
      if (!valid) return;
      const values = await identityFormApi.getValues<{
        keyword: string;
        workType: MediaGovernanceApi.MediaType;
      }>();
      const sequence = ++searchSequence;
      loading.value = true;
      candidates.value = [];
      selected.value = undefined;
      modalApi.setState({ confirmDisabled: true });
      try {
        const result = await getMediaGovernanceCatalogIdentityCandidates(
          values.keyword.trim(),
          values.workType,
        );
        if (sequence !== searchSequence) return;
        candidates.value = result.items;
      } finally {
        if (sequence === searchSequence) loading.value = false;
      }
    }

    /**
     * 保存服务端返回的稳定 candidateId 对应候选，并只据此解除确认按钮锁定。
     *
     * @param candidate - 服务端身份搜索返回的候选。
     */
    function selectCandidate(
      candidate: MediaGovernanceApi.RssIdentityCandidate,
    ) {
      selected.value = candidate;
      modalApi.setState({ confirmDisabled: false });
    }

    /**
     * 仅从候选投影 provider/ID/year，按当前模式调用 Series 或 Work 唯一写入口。
     * @throws Work 模式缺少调用方绑定的 Series 上下文时拒绝提交。
     */
    async function submit() {
      const identity = selected.value;
      if (!identity) {
        message.warning('请先选择唯一作品身份');
        return;
      }
      const values = await identityFormApi.getValues<{
        workType: MediaGovernanceApi.MediaType;
      }>();
      const input: MediaGovernanceApi.SeriesOrWorkCreateInput = {
        identity: {
          provider: identity.provider,
          providerId: identity.providerId,
        },
        workType: values.workType,
      };
      if (identity.releaseYear !== null) {
        input.identity.releaseYear = identity.releaseYear;
      }
      modalApi.lock();
      try {
        let detail: MediaGovernanceApi.SeriesDetail;
        if (mode.value === 'series') {
          detail = await createMediaGovernanceSeries(input);
        } else {
          const seriesId = targetSeriesId.value;
          if (!seriesId) throw new Error('Series context missing');
          detail = await createMediaGovernanceWork(seriesId, input);
        }
        await modalApi.close();
        emit('saved', detail);
      } finally {
        modalApi.unlock();
      }
    }

    expose({
      openCreateSeries,
      openCreateWork,
    } satisfies SeriesWorkCreateModalExposed);

    return () => {
      let candidateContent = <AEmpty description="搜索后选择唯一作品身份" />;
      if (candidates.value.length > 0) {
        candidateContent = (
          <div class="media-series-identity-picker__candidates">
            {candidates.value.map((candidate) => {
              const active =
                selected.value?.candidateId === candidate.candidateId;
              const classes = ['media-series-identity-picker__candidate'];
              if (active) classes.push('is-selected');
              let year = '年份未知';
              if (candidate.releaseYear !== null) {
                year = `${candidate.releaseYear} 年`;
              }
              let selectedIcon = null;
              if (active) selectedIcon = <CheckOutlined />;
              return (
                <AButton
                  aria-pressed={active}
                  class={classes.join(' ')}
                  key={candidate.candidateId}
                  onClick={() => selectCandidate(candidate)}
                  type="text"
                >
                  <span>
                    <strong>{candidate.title}</strong>
                    <small>{candidate.originalTitle || '未记录原名'}</small>
                    <span>
                      <ATag color="blue">
                        {candidate.provider.toUpperCase()}
                      </ATag>
                      <span>{candidate.providerId}</span>
                      <span>{year}</span>
                    </span>
                  </span>
                  {selectedIcon}
                </AButton>
              );
            })}
          </div>
        );
      }
      return (
        <Modal>
          <div class="media-series-identity-picker">
            <IdentityForm />
            <ASpin spinning={loading.value}>{candidateContent}</ASpin>
          </div>
        </Modal>
      );
    };
  },
});
