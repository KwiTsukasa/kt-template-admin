import type { NodeMetadata } from '@antv/x6';

import type { BpmnElement } from '#/api/workflow-engine/bpmn';

import { BPMN_KIND_GROUPS, BPMN_TYPE } from '#/constants/automation/bpmn';
import { BPMN_CANVAS_COLORS } from '#/constants/automation/workflow-canvas';

import { bpmnNodeSize } from './bpmn-geometry';

const { ink, surface } = BPMN_CANVAS_COLORS;
type SvgAttrs = NonNullable<NonNullable<NodeMetadata['attrs']>[string]>;
type SvgMarkup = Extract<NonNullable<NodeMetadata['markup']>, unknown[]>;
type NodePorts = Exclude<NonNullable<NodeMetadata['ports']>, unknown[]>;

/**
 * 按标准事件、活动和网关生成 SVG 图形，选中只改变一层描边。
 * @param element - 标准流程元素。
 * @param bounds - 标准 DI 中的坐标和尺寸。
 * @returns X6 原生 SVG 节点数据，模型身份保持不变。
 */
export function nodeMetadata(
  element: BpmnElement,
  bounds?: Record<string, number>,
): NodeMetadata {
  const event = element.$type.endsWith('Event');
  const gateway = element.$type.endsWith('Gateway');
  const container = BPMN_KIND_GROUPS.containers.has(element.$type);
  const { width, height } = bpmnNodeSize(element, bounds);
  const body: SvgAttrs = { fill: surface, stroke: ink, strokeWidth: 1.5 };
  let tagName = 'rect';
  if (event) {
    tagName = 'circle';
    Object.assign(body, {
      cx: width / 2,
      cy: height / 2,
      r: Math.min(width, height) / 2 - 2,
    });
  } else if (gateway) {
    tagName = 'polygon';
    body.points = `${width / 2},1 ${width - 1},${height / 2} ${width / 2},${height - 1} 1,${height / 2}`;
  } else Object.assign(body, { width, height, rx: 9, ry: 9 });
  if (element.$type === BPMN_TYPE.EndEvent) body.strokeWidth = 3.5;
  if (
    (element.$type === BPMN_TYPE.BoundaryEvent &&
      element.cancelActivity === false) ||
    (element.$type === BPMN_TYPE.StartEvent && element.isInterrupting === false)
  )
    body.strokeDasharray = '4 3';
  if (element.$type === BPMN_TYPE.SubProcess && element.triggeredByEvent)
    body.strokeDasharray = '2 3';
  const attrs: BpmnDrawingAttrs = {
    body,
    label: {
      text: element.name ?? '',
      fill: 'var(--ant-color-text)',
      fontSize: 13,
      textAnchor: 'middle',
      refX: 0,
      refY: 0,
      x: width / 2,
      y: height / 2,
      textVerticalAnchor: 'middle',
      textWrap: { width: width - 20, height: height - 20, ellipsis: true },
    },
    marker: { fill: 'none', stroke: ink, strokeWidth: 1.5 },
  };
  const markup: SvgMarkup = [
    { tagName, selector: 'body' },
    { tagName: 'path', selector: 'marker' },
    { tagName: 'text', selector: 'label' },
  ];
  const centerX = width / 2;
  const centerY = height / 2;
  const drawing = {
    element,
    width,
    height,
    body,
    attrs,
    markup,
    centerX,
    centerY,
  };
  if (container) decorateBpmnContainer(drawing);
  else if (event || gateway) decorateBpmnEvent(drawing);
  else decorateBpmnActivity(drawing);
  const groups: NonNullable<NodePorts['groups']> = {};
  const items = ['left', 'top', 'right', 'bottom'].map((side) => {
    groups[side] = {
      position: side,
      attrs: {
        circle: {
          r: 4.5,
          magnet: true,
          stroke: ink,
          strokeWidth: 1.3,
          fill: 'color-mix(in srgb, var(--ant-color-text-secondary) 18%, transparent)',
        },
      },
    };
    return { id: side, group: side };
  });
  if (element.$type === BPMN_TYPE.Lane) items.length = 0;
  let zIndex = 1;
  if (element.$type === BPMN_TYPE.Participant) zIndex = -3;
  if (element.$type === BPMN_TYPE.Lane) zIndex = -2;
  if (element.$type === BPMN_TYPE.BoundaryEvent) zIndex = 2;
  return {
    id: element.id,
    shape: 'rect',
    x: bounds?.x ?? 100,
    y: bounds?.y ?? 100,
    width,
    height,
    markup,
    attrs,
    ports: { groups, items },
    zIndex,
    data: { bpmnType: element.$type },
  };
}

/**
 * 按参与者或泳道绘制容器标题和分隔线，外部泳池保留居中标题。
 * @param context - 当前节点的标准元素、几何信息和 SVG 输出。
 */
function decorateBpmnContainer(context: BpmnDrawing): void {
  const { body, attrs, centerY, height, element, centerX, width } = context;

  Object.assign(body, { rx: 0, ry: 0, fill: 'transparent', strokeWidth: 1 });
  Object.assign(attrs.label, {
    x: 15,
    y: centerY,
    textWrap: { width: height - 20, height: 24, ellipsis: true },
    transform: `rotate(-90,15,${centerY})`,
  });
  if (element.$type === BPMN_TYPE.Participant && !element.processRef)
    Object.assign(attrs.label, {
      x: centerX,
      y: centerY,
      textWrap: { width: width - 20, height: 24, ellipsis: true },
      transform: '',
    });
  else attrs.marker.d = `M30,0 V${height}`;
}

/**
 * 按标准事件和网关绘制环线、触发符号及抛出填充。
 * @param context - 当前节点的标准元素、几何信息和 SVG 输出。
 */
function decorateBpmnEvent(context: BpmnDrawing): void {
  const { attrs, height, element, markup, centerX, centerY, width } = context;

  Object.assign(attrs.label, {
    y: height + 18,
    textWrap: { width: 145, height: 40, ellipsis: true },
  });
  const definition = element.eventDefinitions?.[0]?.$type;
  if (
    element.$type === BPMN_TYPE.IntermediateCatchEvent ||
    element.$type === BPMN_TYPE.IntermediateThrowEvent ||
    element.$type === BPMN_TYPE.BoundaryEvent
  ) {
    markup.splice(1, 0, { tagName: 'circle', selector: 'ring' });
    attrs.ring = {
      cx: centerX,
      cy: centerY,
      r: width / 2 - 6,
      fill: 'none',
      stroke: ink,
      strokeWidth: 1.2,
    };
    if (
      element.$type === BPMN_TYPE.BoundaryEvent &&
      element.cancelActivity === false
    )
      attrs.ring.strokeDasharray = '4 3';
  }
  if (definition === BPMN_TYPE.TerminateEventDefinition) {
    markup.push({ tagName: 'circle', selector: 'terminate' });
    attrs.terminate = {
      cx: centerX,
      cy: centerY,
      r: width / 4,
      fill: ink,
      stroke: 'none',
    };
  }
  if (definition === BPMN_TYPE.ErrorEventDefinition)
    attrs.marker.d = `M${centerX - 6},${centerY - 9} l4,6 7,-3 -5,15 -3,-7 -7,2 z`;
  if (definition === BPMN_TYPE.CancelEventDefinition)
    attrs.marker.d = `M${centerX - 7},${centerY - 7} l14,14 m0,-14 l-14,14`;
  if (definition === BPMN_TYPE.TimerEventDefinition) {
    markup.push({ tagName: 'circle', selector: 'clock' });
    attrs.clock = {
      cx: centerX,
      cy: centerY,
      r: width / 4,
      fill: 'none',
      stroke: ink,
      strokeWidth: 1.2,
    };
    attrs.marker.d = `M${centerX},${centerY - 8} v8 l5,3`;
  }
  if (definition === BPMN_TYPE.MessageEventDefinition)
    attrs.marker.d = `M${centerX - 9},${centerY - 6} h18 v12 h-18 z m0,0 l9,6 9,-6`;
  if (definition === BPMN_TYPE.SignalEventDefinition)
    attrs.marker.d = `M${centerX},${centerY - 10} l10,18 h-20 z`;
  if (definition === BPMN_TYPE.EscalationEventDefinition)
    attrs.marker.d = `M${centerX - 7},${centerY + 8} l7,-16 7,16 -7,-5 z`;
  if (definition === BPMN_TYPE.CompensateEventDefinition)
    attrs.marker.d = `M${centerX},${centerY - 7} l-8,7 8,7 z m8,0 l-8,-7 8,-7 z`;
  if (
    BPMN_KIND_GROUPS.throwEvents.has(element.$type) &&
    BPMN_KIND_GROUPS.namedEventReferences.has(definition)
  )
    attrs.marker.fill = ink;
  if (element.$type === BPMN_TYPE.ExclusiveGateway)
    attrs.marker.d = `M${centerX - 8},${centerY - 8} l16,16 m0,-16 l-16,16`;
  if (element.$type === BPMN_TYPE.ParallelGateway)
    attrs.marker.d = `M${centerX - 10},${centerY} h20 m-10,-10 v20`;
  if (element.$type === BPMN_TYPE.ComplexGateway)
    attrs.marker.d = `M${centerX - 10},${centerY} h20 m-10,-10 v20 M${centerX - 7},${centerY - 7} l14,14 m0,-14 l-14,14`;
  if (element.$type === BPMN_TYPE.InclusiveGateway) {
    markup.push({ tagName: 'circle', selector: 'inclusive' });
    attrs.inclusive = {
      cx: centerX,
      cy: centerY,
      r: 10,
      fill: 'none',
      stroke: ink,
      strokeWidth: 2,
    };
  }
}

/**
 * 按任务、子流程及循环类型绘制活动标记，主体和端口仍由统一节点构造器创建。
 * @param context - 当前节点的标准元素、几何信息和 SVG 输出。
 */
function decorateBpmnActivity(context: BpmnDrawing): void {
  const { element, markup, attrs, width, height, centerX } = context;

  appendEventStartMarker(context);
  if (element.$type === BPMN_TYPE.UserTask)
    attrs.marker.d =
      'M19,9 a4,4 0 1 0 0,8 a4,4 0 1 0 0,-8 m-8,17 v-3 q8,-9 16,0 v3';
  if (element.$type === BPMN_TYPE.Transaction) {
    markup.splice(1, 0, { tagName: 'rect', selector: 'transactionRing' });
    attrs.transactionRing = {
      x: 4,
      y: 4,
      width: width - 8,
      height: height - 8,
      rx: 6,
      ry: 6,
      fill: 'none',
      stroke: ink,
      strokeWidth: 1,
    };
  }
  if (element.$type === BPMN_TYPE.BusinessRuleTask)
    attrs.marker.d = 'M10,10 h18 v14 h-18 z m0,5 h18 m-12,-5 v14';
  if (element.$type === BPMN_TYPE.ServiceTask)
    attrs.marker.d =
      'M12,11 h14 v14 h-14 z m7,-4 v4 m0,14 v4 m-11,-11 h4 m14,0 h4';
  if (
    element.$type === BPMN_TYPE.SubProcess ||
    element.$type === BPMN_TYPE.Transaction
  )
    attrs.marker.d = `M${centerX - 6},${height - 17} h12 v12 h-12 z m6,2 v8 m-4,-4 h8`;
  if (
    element.loopCharacteristics?.$type === BPMN_TYPE.StandardLoopCharacteristics
  )
    attrs.marker.d = `M${centerX + 7},${height - 12} a7,7 0 1 1 -3,-6 m-3,-2 l4,2 -2,4`;
  if (
    element.loopCharacteristics?.$type ===
    BPMN_TYPE.MultiInstanceLoopCharacteristics
  ) {
    attrs.marker.d = `M${centerX - 5},${height - 17} v12 m5,-12 v12 m5,-12 v12`;
    if (element.loopCharacteristics.isSequential)
      attrs.marker.d = `M${centerX - 6},${height - 16} h12 m-12,4 h12 m-12,4 h12`;
  }
}

type BpmnDrawingAttrs = NonNullable<NodeMetadata['attrs']> & {
  body: SvgAttrs;
  label: SvgAttrs;
  marker: SvgAttrs;
};
type BpmnDrawing = Readonly<{
  attrs: BpmnDrawingAttrs;
  body: SvgAttrs;
  centerX: number;
  centerY: number;
  element: BpmnElement;
  height: number;
  markup: SvgMarkup;
  width: number;
}>;

/**
 * 为事件子流程嵌入开始事件的小图标，缺少开始事件的草稿直接保留普通活动外观。
 * @param context - 当前活动的标准元素与 SVG 输出。
 */
function appendEventStartMarker(context: BpmnDrawing): void {
  const { element, attrs, markup } = context;
  if (element.$type !== BPMN_TYPE.SubProcess || !element.triggeredByEvent)
    return;

  const start = element.flowElements?.find(
    (item: BpmnElement) => item.$type === BPMN_TYPE.StartEvent,
  );
  if (!start) return;
  const miniature = nodeMetadata(
    { ...start, name: '' },
    { width: 26, height: 26 },
  );
  const children = (miniature.markup as SvgMarkup)
    .filter((item) => item.selector !== 'label')
    .map((item) => ({ ...item, selector: `start_${item.selector}` }));
  markup.push({ tagName: 'g', selector: 'eventStart', children });
  attrs.eventStart = { transform: 'translate(7,7)' };
  for (const [key, value] of Object.entries(miniature.attrs ?? {})) {
    if (key !== 'label') attrs[`start_${key}`] = value;
  }
}
