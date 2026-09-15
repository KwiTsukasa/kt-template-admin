import type { Node } from '@antv/x6';

import type { PropType } from 'vue';

import type { WorkflowNode } from '#/api/workflow-engine';

import { defineComponent, onBeforeUnmount, ref } from 'vue';

const labels: Record<WorkflowNode['type'], string> = {
  start: '开始',
  end: '结束',
  task: '执行任务',
  rule: '规则分支',
  fork: '并行分支',
  join: '全部汇合',
  wait: '等待',
};
const colors: Record<WorkflowNode['type'], string> = {
  start: '#16a34a',
  end: '#475569',
  task: '#2563eb',
  rule: '#d97706',
  fork: '#9333ea',
  join: '#9333ea',
  wait: '#0891b2',
};
const executionLabels: Record<string, string> = {
  pending: '待执行',
  waiting: '等待中',
  succeeded: '成功',
  failed: '失败',
  skipped: '未选分支',
  cancelled: '已取消',
};
const executionColors: Record<string, string> = {
  pending: '#94a3b8',
  waiting: '#0891b2',
  succeeded: '#16a34a',
  failed: '#dc2626',
  skipped: '#94a3b8',
  cancelled: '#64748b',
};

export default defineComponent({
  name: 'AutomationWorkflowNode',
  props: { node: { type: Object as PropType<Node>, required: true } },
  setup(props) {
    const data = ref(props.node.getData<WorkflowNode>());
    const status = ref(props.node.getProp<string>('executionStatus'));
    const refresh = () => {
      data.value = props.node.getData<WorkflowNode>();
    };
    const refreshStatus = () => {
      status.value = props.node.getProp<string>('executionStatus');
    };
    props.node.on('change:data', refresh);
    props.node.on('change:executionStatus', refreshStatus);
    onBeforeUnmount(() => {
      props.node.off('change:data', refresh);
      props.node.off('change:executionStatus', refreshStatus);
    });
    return () => (
      <div
        style={{
          height: '100%',
          border: `2px solid ${executionColors[status.value] || colors[data.value.type]}`,
          borderRadius: '10px',
          background: 'var(--ant-color-bg-container, #fff)',
          padding: '10px 14px',
          boxShadow: '0 2px 6px #00000012',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: executionColors[status.value] || colors[data.value.type],
            marginBottom: '5px',
          }}
        >
          {labels[data.value.type]} {executionLabels[status.value]}
        </div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data.value.name}
        </div>
      </div>
    );
  },
});
