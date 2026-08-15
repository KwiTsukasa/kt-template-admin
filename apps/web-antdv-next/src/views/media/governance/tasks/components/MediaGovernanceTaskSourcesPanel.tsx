import type { PropType } from 'vue';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { defineComponent } from 'vue';

import { Button, Empty, Popconfirm, Space, Tag } from 'antdv-next';

import { hasCompleteSourceMapping } from '../task-operation-contract';

const AButton = Button as any;
const AEmpty = Empty as any;
const APopconfirm = Popconfirm as any;
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
  emits: ['configure', 'remove'],
  setup(props, { emit }) {
    function healthColor(source: MediaGovernanceApi.Source) {
      if (source.sourceHealth === 'viable') return 'success';
      return 'warning';
    }

    function mappingLabel(source: MediaGovernanceApi.Source) {
      if (hasCompleteSourceMapping(source)) return '调整文件映射';
      return '配置文件映射';
    }

    function seasonLabel(source: MediaGovernanceApi.Source) {
      if (source.seasonNumbers.length > 0) {
        return source.seasonNumbers.join('、');
      }
      return '电影单元';
    }

    function renderActions(source: MediaGovernanceApi.Source) {
      if (!props.editable) return null;
      const controls = [];
      if (source.manifestState === 'inspected') {
        controls.push(
          <AButton
            key="mapping"
            onClick={() => emit('configure', source)}
            size="small"
          >
            {mappingLabel(source)}
          </AButton>,
        );
      }
      controls.push(
        <APopconfirm
          description="只移除当前任务中的来源描述；已经开始下载或治理后不可移除。"
          key="remove"
          onConfirm={() => emit('remove', source)}
          title="确认移除此来源？"
        >
          <AButton
            danger
            loading={props.operationKey === `remove-source:${source.id}`}
            size="small"
          >
            移除来源
          </AButton>
        </APopconfirm>,
      );
      return <ASpace wrap>{controls}</ASpace>;
    }

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
