import type { PropType } from 'vue';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { defineComponent } from 'vue';

import { Button, Empty, Space, Tag } from 'antdv-next';

import { hasCompleteSourceMapping } from '../task-operation-contract';

const AButton = Button as any;
const AEmpty = Empty as any;
const ASpace = Space as any;
const ATag = Tag as any;

const SOURCE_ROLE_LABELS: Record<MediaGovernanceApi.SourceRole, string> = {
  primary_media: '主媒体来源',
  supplemental_subtitle: '补充字幕来源',
};
const TRANSPORT_LABELS: Record<
  MediaGovernanceApi.Source['transportKind'],
  string
> = {
  magnet: '磁链',
  torrent: '种子文件',
};

export default defineComponent({
  name: 'MediaGovernanceTaskSourcesPanel',
  props: {
    editable: { default: false, type: Boolean },
    operationKey: { default: '', type: String },
    task: {
      required: true,
      type: Object as PropType<MediaGovernanceApi.Task>,
    },
  },
  emits: ['configure'],
  setup(props, { emit }) {
    /**
     * 将来源健康状态映射为标签颜色。
     *
     * @param source - 提供健康状态、用于选择标签颜色的来源记录。
     * @returns 来源健康、警告或失败状态对应的标签颜色。
     */
    function healthColor(source: MediaGovernanceApi.Source) {
      if (source.sourceHealth === 'viable') return 'success';
      return 'warning';
    }

    /**
     * 根据来源映射完整性生成操作文案。
     *
     * @param source - 提供清单检查与映射完成状态的来源记录。
     * @returns 来源未检查、待映射或已映射的中文状态文本。
     */
    function mappingLabel(source: MediaGovernanceApi.Source) {
      if (hasCompleteSourceMapping(source)) return '调整文件映射';
      return '配置文件映射';
    }

    /**
     * 根据来源内容形态与季号范围生成电影、整季或多季标签。
     *
     * @param source - 提供内容形态与覆盖季号的来源记录。
     * @returns 电影、整季或多季覆盖范围的展示文本。
     */
    function seasonLabel(source: MediaGovernanceApi.Source) {
      if (source.seasonNumbers.length > 0) {
        return source.seasonNumbers.join('、');
      }
      return '电影单元';
    }

    /**
     * 展示当前来源的人工映射入口，检查和清理由流程活动负责推进。
     *
     * @param source - 要按可编辑状态生成配置与移除按钮的来源记录。
     * @returns 使用统一禁用策略并可自动换行的来源操作栏。
     */
    function renderActions(source: MediaGovernanceApi.Source) {
      return (
        <ASpace wrap>
          <AButton
            disabled={
              !props.editable ||
              source.manifestState !== 'inspected' ||
              !!props.operationKey
            }
            onClick={() => emit('configure', source)}
            size="small"
          >
            {mappingLabel(source)}
          </AButton>
        </ASpace>
      );
    }

    /**
     * 根据单个来源的分类、健康状态与映射进度渲染摘要卡片。
     *
     * @param source - 要展示分类、健康、覆盖范围与映射进度的来源记录。
     * @returns 展示来源类型、覆盖范围、健康与映射状态的卡片。
     */
    function renderSource(source: MediaGovernanceApi.Source) {
      return (
        <div
          class="rounded border border-solid border-border p-4"
          key={source.id}
        >
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <strong>{SOURCE_ROLE_LABELS[source.sourceRole]}</strong>
              <ATag>{TRANSPORT_LABELS[source.transportKind]}</ATag>
              <ATag color={healthColor(source)}>
                {source.sourceHealthLabel}
              </ATag>
            </div>
            {renderActions(source)}
          </div>
          <div class="grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
            <span>发布组：{source.releaseGroup || '未声明'}</span>
            <span>季号：{seasonLabel(source)}</span>
            <span>已选文件：{source.selectedFileCount}</span>
            <span>来源检查：{source.sourceHealthReasonLabel}</span>
          </div>
        </div>
      );
    }

    return () => {
      if (props.task.sources.length === 0) {
        return <AEmpty description="尚未添加媒体或字幕来源" />;
      }
      return (
        <div class="grid gap-3">
          {props.task.sources.map((source) => renderSource(source))}
        </div>
      );
    };
  },
});
