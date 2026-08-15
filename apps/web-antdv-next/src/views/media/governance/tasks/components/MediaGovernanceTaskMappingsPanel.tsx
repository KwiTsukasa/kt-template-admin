import type { PropType } from 'vue';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { defineComponent } from 'vue';

import { Empty } from 'antdv-next';

const AEmpty = Empty as any;

export default defineComponent({
  name: 'MediaGovernanceTaskMappingsPanel',
  props: {
    task: {
      required: true,
      type: Object as PropType<MediaGovernanceApi.Task>,
    },
  },
  setup(props) {
    return () => {
      const mappings = props.task.sources.flatMap(
        (source) => source.selectedFileMappings,
      );
      if (mappings.length === 0) {
        return <AEmpty description="尚未密封文件映射" />;
      }
      return (
        <div class="grid gap-2">
          {props.task.units.map((unit) => {
            const unitMappings = mappings.filter(
              (mapping) => mapping.unitId === unit.id,
            );
            const videoCount = unitMappings.filter(
              (item) => item.fileRole === 'video',
            ).length;
            const subtitleCount = unitMappings.filter(
              (item) => item.fileRole === 'subtitle',
            ).length;
            const fontCount = unitMappings.filter(
              (item) => item.fileRole === 'font',
            ).length;
            return (
              <div
                class="rounded border border-solid border-border p-3"
                key={unit.id}
              >
                <strong>{unit.seasonNumber || '电影单元'}</strong>
                <div class="mt-1 text-sm text-muted-foreground">
                  已映射 {videoCount} 个视频、{subtitleCount} 个字幕、
                  {fontCount} 个字体文件
                </div>
              </div>
            );
          })}
        </div>
      );
    };
  },
});
