import type { PropType } from 'vue';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { defineComponent } from 'vue';

import { Alert } from 'antdv-next';

const AAlert = Alert as any;

export default defineComponent({
  name: 'MediaGovernanceTaskMetadataPanel',
  props: {
    task: {
      required: true,
      type: Object as PropType<MediaGovernanceApi.Task>,
    },
  },
  setup(props) {
    /**
     * 根据元数据核验状态选择提示样式。
     *
     * @returns 核验失败为 error、存在缺口为 warning，其余状态为 info。
     */
    function alertType() {
      if (props.task.metadataStatus === 'verified') return 'success';
      return 'info';
    }

    return () => (
      <div class="grid gap-3">
        <AAlert
          showIcon
          title={`元数据状态：${props.task.semanticProjection.metadataStatusLabel}`}
          type={alertType()}
        />
        {props.task.units.map((unit) => (
          <div
            class="rounded border border-solid border-border p-3"
            key={unit.id}
          >
            <strong>{unit.seasonNumber || '电影单元'}</strong>
            <div class="mt-2 grid gap-1 text-sm text-muted-foreground md:grid-cols-3">
              <span>身份缺失：{unit.metadataProjection.missingA.length}</span>
              <span>
                关键展示缺失：{unit.metadataProjection.missingB.length}
              </span>
              <span>
                增强展示缺失：{unit.metadataProjection.missingC.length}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  },
});
