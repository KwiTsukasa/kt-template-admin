import type { PropType } from 'vue';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { defineComponent } from 'vue';

import { Descriptions, Empty } from 'antdv-next';

const ADescriptions = Descriptions as any;
const AEmpty = Empty as any;

export default defineComponent({
  name: 'MediaGovernanceTaskEvidencePanel',
  props: {
    evidence: {
      default: undefined,
      type: Object as PropType<MediaGovernanceApi.Evidence>,
    },
    task: {
      required: true,
      type: Object as PropType<MediaGovernanceApi.Task>,
    },
  },
  setup(props) {
    const writeLabels: Record<string, string> = {
      cloud: '云端写入',
      database: '数据库直写',
      media: '正式媒体写入',
      nas: 'NAS 越界写入',
      uiMutationOutsideAdmin: 'Admin 外 UI 写入',
    };

    return () => {
      if (!props.evidence) return <AEmpty description="证据摘要尚未加载" />;
      return (
        <div class="grid gap-4">
          <ADescriptions
            bordered
            column={1}
            items={[
              {
                content: props.evidence.descriptorCount,
                key: 'descriptors',
                label: '来源描述数量',
              },
              {
                content: props.evidence.localAcceptedUnitCount,
                key: 'accepted',
                label: '本地验收单元',
              },
              {
                content: props.evidence.metadataStatusLabel,
                key: 'metadata',
                label: '元数据状态',
              },
              {
                content: props.evidence.agentStatusLabel,
                key: 'agent',
                label: 'Agent 状态',
              },
            ]}
          />
          <div class="grid gap-2 md:grid-cols-2">
            {Object.entries(props.evidence.writeBoundaries).map(
              ([key, value]) => (
                <div
                  class="rounded border border-solid border-border p-3"
                  key={key}
                >
                  <span class="text-sm text-muted-foreground">
                    {writeLabels[key] || key}
                  </span>
                  <div class="mt-1 text-lg font-semibold">{value}</div>
                </div>
              ),
            )}
          </div>
          <div class="text-xs text-muted-foreground">
            任务编号：{props.task.id}
          </div>
        </div>
      );
    };
  },
});
