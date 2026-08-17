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
    /**
     * 根据治理单元是否密封字幕合同生成状态文案。
     *
     * @param unit - 需要生成标签或渲染字幕合同的媒体治理单元。
     * @returns 字幕合同已密封或待密封的状态文本。
     */
    function contractLabel(unit: MediaGovernanceApi.TaskUnit) {
      if (unit.subtitleContract) return '字幕合同已密封';
      return '使用媒体字幕或待补齐';
    }

    /**
     * 将字幕合同状态映射为标签颜色。
     *
     * @param unit - 需要生成标签或渲染字幕合同的媒体治理单元。
     * @returns 字幕合同已密封时为 success，否则为 warning。
     */
    function contractColor(unit: MediaGovernanceApi.TaskUnit) {
      if (unit.subtitleContract) return 'success';
      return 'default';
    }

    /**
     * 根据治理单元的字幕合同渲染发布组与覆盖集数；未密封时显示提示。
     *
     * @param unit - 需要生成标签或渲染字幕合同的媒体治理单元。
     * @returns 字幕发布组与覆盖范围节点；合同未密封时返回提示节点。
     */
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
