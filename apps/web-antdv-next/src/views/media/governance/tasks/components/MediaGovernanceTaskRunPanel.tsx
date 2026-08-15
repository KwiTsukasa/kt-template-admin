import type { PropType } from 'vue';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { defineComponent } from 'vue';

import { Descriptions } from 'antdv-next';

const ADescriptions = Descriptions as any;

export default defineComponent({
  name: 'MediaGovernanceTaskRunPanel',
  props: {
    task: {
      required: true,
      type: Object as PropType<MediaGovernanceApi.Task>,
    },
  },
  setup(props) {
    return () => (
      <ADescriptions
        bordered
        column={1}
        items={[
          {
            content: props.task.activeRunId || '当前没有运行中的执行器',
            key: 'run',
            label: '当前运行',
          },
          {
            content: props.task.semanticProjection.currentActionLabel,
            key: 'action',
            label: '当前动作',
          },
          {
            content: props.task.semanticProjection.gateReasonLabel,
            key: 'gate',
            label: '阻塞原因',
          },
          {
            content: `${props.task.progress.completedItems}/${props.task.progress.totalItems} 项`,
            key: 'items',
            label: '项目进度',
          },
        ]}
      />
    );
  },
});
