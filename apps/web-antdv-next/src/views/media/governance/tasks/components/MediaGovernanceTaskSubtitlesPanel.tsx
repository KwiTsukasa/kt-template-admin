import type { PropType } from 'vue';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { defineComponent } from 'vue';

import { Tag } from 'antdv-next';

const ATag = Tag as any;

export default defineComponent({
  name: 'MediaGovernanceTaskSubtitlesPanel',
  props: {
    task: {
      required: true,
      type: Object as PropType<MediaGovernanceApi.Task>,
    },
  },
  setup(props) {
    function contractLabel(unit: MediaGovernanceApi.TaskUnit) {
      if (unit.subtitleContract) return '字幕合同已密封';
      return '使用媒体字幕或待补齐';
    }

    function contractColor(unit: MediaGovernanceApi.TaskUnit) {
      if (unit.subtitleContract) return 'success';
      return 'default';
    }

    function renderContract(unit: MediaGovernanceApi.TaskUnit) {
      if (!unit.subtitleContract) return null;
      return (
        <div class="mt-2 text-sm text-muted-foreground">
          发布组 {unit.subtitleContract.releaseGroup} · 覆盖{' '}
          {unit.subtitleContract.expectedEpisodeNumbers.length} 集
        </div>
      );
    }

    return () => (
      <div class="grid gap-2">
        {props.task.units.map((unit) => (
          <div
            class="rounded border border-solid border-border p-3"
            key={unit.id}
          >
            <div class="flex items-center justify-between gap-3">
              <strong>{unit.seasonNumber || '电影单元'}</strong>
              <ATag color={contractColor(unit)}>{contractLabel(unit)}</ATag>
            </div>
            {renderContract(unit)}
          </div>
        ))}
      </div>
    );
  },
});
