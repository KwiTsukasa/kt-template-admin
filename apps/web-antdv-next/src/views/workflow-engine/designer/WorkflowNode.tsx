import type { NodeMetadata } from '@antv/x6';

import type { WorkflowNode, WorkflowNodeLayout } from '#/api/workflow-engine';

const labels: Record<WorkflowNode['type'], string> = {
  start: '开始',
  end: '结束',
  task: '执行任务',
  business: '业务步骤',
  rule: '规则分支',
  fork: '并行分支',
  join: '全部汇合',
  wait: '等待',
  loop: '循环',
};
const colors: Record<WorkflowNode['type'], string> = {
  start: 'var(--ant-color-success-text, #16a34a)',
  end: 'var(--ant-color-text-secondary, #475569)',
  task: 'var(--ant-color-primary-text, #2563eb)',
  business: 'var(--ant-color-primary-text, #2563eb)',
  rule: 'var(--ant-color-warning-text, #d97706)',
  fork: 'var(--ant-color-info-text, #0891b2)',
  join: 'var(--ant-color-info-text, #0891b2)',
  wait: 'var(--ant-color-info-text, #0891b2)',
  loop: 'var(--ant-color-primary-text, #2563eb)',
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
  pending: 'var(--ant-color-text-tertiary, #94a3b8)',
  waiting: 'var(--ant-color-info-text, #0891b2)',
  succeeded: 'var(--ant-color-success-text, #16a34a)',
  failed: 'var(--ant-color-error-text, #dc2626)',
  skipped: 'var(--ant-color-text-tertiary, #94a3b8)',
  cancelled: 'var(--ant-color-text-secondary, #64748b)',
};

export const workflowNodeMarkup: NodeMetadata['markup'] = [
  { tagName: 'rect', selector: 'body', className: 'automation-node__outline' },
  {
    tagName: 'polygon',
    selector: 'diamond',
    className: 'automation-node__outline',
  },
  { tagName: 'text', selector: 'kind' },
  { tagName: 'text', selector: 'name' },
  { tagName: 'circle', selector: 'endRing' },
  { tagName: 'path', selector: 'endMark' },
  { tagName: 'title', selector: 'title' },
];

/**
 * 把节点文字、形状和执行状态投影为 X6 自有 SVG 属性，避免跨画布共享 Vue 渲染宿主。
 * @param node - 当前领域节点。
 * @param layout - 已补齐尺寸、形态与端口方向的布局。
 * @param status - 运行详情传入的节点执行状态，设计时为空。
 * @returns 与图节点共同创建、更新和销毁的原生 SVG 属性。
 */
export function workflowNodeAttrs(
  node: WorkflowNode,
  layout: Required<WorkflowNodeLayout>,
  status = '',
): NodeMetadata['attrs'] {
  const { width, height, shape } = layout;
  let radius = 0;
  if (shape === 'rounded') radius = 10;
  let bodyDisplay = 'inline';
  let diamondDisplay = 'none';
  let x = 16;
  let textWidth = width - 32;
  let textAnchor = 'start';
  if (shape === 'capsule') {
    radius = height / 2;
    x = 28;
    textWidth = width - 56;
  }
  if (shape === 'diamond') {
    bodyDisplay = 'none';
    diamondDisplay = 'inline';
    x = width / 2;
    textWidth = width * 0.6;
    textAnchor = 'middle';
  }
  let kind = labels[node.type];
  let color = colors[node.type];
  let execution = executionLabels[status] || '';
  let mark = '';
  let markDisplay = 'none';
  let markX = width - 24;
  let markY = height / 2;
  if (node.type === 'end') {
    const outcome = node.outcome || 'succeeded';
    kind = `${executionLabels[outcome]}结束`;
    if (outcome === 'cancelled') kind = '取消结束';
    if (status === outcome) execution = '';
    color = executionColors[outcome] || color;
    markDisplay = 'inline';
    mark = 'M -4 0 L -1 3 L 5 -4';
    if (outcome === 'failed') mark = 'M -3 -3 L 3 3 M 3 -3 L -3 3';
    if (outcome === 'cancelled') mark = 'M -4 0 L 4 0';
    textWidth -= 28;
    if (shape === 'diamond') {
      markX = width / 2;
      markY = 17;
      textWidth += 28;
    }
  }
  const text = {
    x,
    textAnchor,
    textVerticalAnchor: 'middle',
    pointerEvents: 'none',
  };
  return {
    body: {
      x: 1,
      y: 1,
      width: width - 2,
      height: height - 2,
      rx: radius,
      ry: radius,
      display: bodyDisplay,
    },
    diamond: {
      points: `${width / 2},2 ${width - 2},${height / 2} ${width / 2},${height - 2} 2,${height / 2}`,
      display: diamondDisplay,
    },
    kind: {
      ...text,
      y: height / 2 - 12,
      fill: executionColors[status] || color,
      fontSize: 11,
      text: `${kind} ${execution}`.trim(),
      textWrap: { width: textWidth, height: 16, ellipsis: true },
    },
    name: {
      ...text,
      y: height / 2 + 10,
      fill: 'var(--ant-color-text, #172033)',
      fontSize: 14,
      fontWeight: 600,
      text: node.name,
      textWrap: { width: textWidth, height: 20, ellipsis: true },
    },
    title: { text: node.name },
    endRing: {
      cx: markX,
      cy: markY,
      r: 9,
      display: markDisplay,
      stroke: color,
      strokeWidth: 1.5,
      fill: color,
      fillOpacity: 0.15,
      pointerEvents: 'none',
    },
    endMark: {
      d: mark,
      transform: `translate(${markX},${markY})`,
      display: markDisplay,
      stroke: color,
      strokeWidth: 1.5,
      fill: 'none',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      pointerEvents: 'none',
    },
  };
}
