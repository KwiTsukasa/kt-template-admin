import type { BpmnDefinition, BpmnElement } from '#/api/workflow-engine/bpmn';

import { bpmnId, indexBpmn } from './bpmn-model';

const references: Record<
  string,
  { property: string; reference: string; type: string }
> = {
  'bpmn:ErrorEventDefinition': {
    property: 'errorCode',
    reference: 'errorRef',
    type: 'bpmn:Error',
  },
  'bpmn:EscalationEventDefinition': {
    property: 'escalationCode',
    reference: 'escalationRef',
    type: 'bpmn:Escalation',
  },
  'bpmn:SignalEventDefinition': {
    property: 'name',
    reference: 'signalRef',
    type: 'bpmn:Signal',
  },
};

/**
 * 存在外部顺序流、边界附着或多个开始事件时拒绝切换，避免丢弃用户模型。
 * @param document - 包含父作用域连接的流程定义。
 * @param element - 用户选中的子流程。
 * @returns 阻止切换的原因；空字符串表示允许切换。
 */
export function eventSubprocessRestriction(
  document: BpmnDefinition,
  element: BpmnElement,
): string {
  if (element.triggeredByEvent) return '';
  const parent = indexBpmn(document).get(element.id ?? '')?.parent;
  if (
    parent?.flowElements?.some(
      (item: BpmnElement) =>
        item.$type === 'bpmn:SequenceFlow' &&
        [item.sourceRef?.$ref, item.targetRef?.$ref].includes(element.id),
    )
  )
    return '请先移除子流程的外部顺序流';
  if (
    parent?.flowElements?.some(
      (item: BpmnElement) => item.attachedToRef?.$ref === element.id,
    )
  )
    return '请先移除附着的边界事件';
  if (
    (element.flowElements ?? []).filter(
      (item: BpmnElement) => item.$type === 'bpmn:StartEvent',
    ).length > 1
  )
    return '事件子流程只能有一个开始事件';
  return '';
}

/**
 * 替换事件定义时保留同类型参数，并落实错误、取消和补偿的中断约束。
 * @param element - 用户编辑的事件节点。
 * @param type - 目标事件定义类型，none 表示无触发器。
 */
export function setBpmnEventType(element: BpmnElement, type: string): void {
  if (element.eventDefinitions?.[0]?.$type === type) return;
  element.eventDefinitions = [];
  if (type === 'none') return;
  const definition: BpmnElement = {
    $type: type,
    id: bpmnId('EventDefinition'),
  };
  if (type === 'bpmn:TimerEventDefinition')
    definition.timeDuration = { $type: 'bpmn:FormalExpression', body: 'PT60S' };
  element.eventDefinitions.push(definition);
  if (element.$type === 'bpmn:BoundaryEvent') {
    if (type === 'bpmn:CompensateEventDefinition')
      element.cancelActivity = false;
    else if (
      ['bpmn:CancelEventDefinition', 'bpmn:ErrorEventDefinition'].includes(type)
    )
      element.cancelActivity = true;
  }
  if (
    element.$type === 'bpmn:StartEvent' &&
    type === 'bpmn:ErrorEventDefinition'
  )
    element.isInterrupting = true;
}

/**
 * 在没有冲突连接时切换子流程触发方式，保留内部活动、位置和已有事件参数。
 * @param document - 当前可编辑定义。
 * @param element - 待切换的普通子流程。
 * @param enabled - 是否改为事件触发。
 * @returns 是否完成切换，冲突时模型保持不变。
 */
export function setBpmnEventSubprocess(
  document: BpmnDefinition,
  element: BpmnElement,
  enabled: boolean,
): boolean {
  if (
    element.$type !== 'bpmn:SubProcess' ||
    (enabled && eventSubprocessRestriction(document, element))
  )
    return false;
  element.triggeredByEvent = enabled;
  for (const start of element.flowElements ?? []) {
    if (start.$type !== 'bpmn:StartEvent') continue;
    if (enabled) {
      if (!start.eventDefinitions?.length)
        setBpmnEventType(start, 'bpmn:SignalEventDefinition');
      if (start.isInterrupting === undefined) start.isInterrupting = true;
    } else {
      setBpmnEventType(start, 'none');
      delete start.isInterrupting;
    }
  }
  return true;
}

/**
 * 读取事件引用的业务代码或信号名称，避免让用户编辑内部标识。
 * @param document - 包含根级事件声明的定义。
 * @param event - 节点中的事件定义。
 * @returns 可编辑的匹配值，未设置引用时为空字符串。
 */
export function bpmnEventReferenceValue(
  document: BpmnDefinition,
  event: BpmnElement,
): string {
  const config = references[event.$type];
  if (!config) return '';
  return (
    indexBpmn(document).get(event[config.reference]?.$ref)?.element[
      config.property
    ] ?? ''
  );
}

/**
 * 按代码或名称复用根级声明，只清理本次替换后无人引用的旧声明。
 * @param document - 当前可编辑定义。
 * @param event - 接收引用的事件定义。
 * @param value - 用户输入的代码或名称。
 */
export function setBpmnEventReference(
  document: BpmnDefinition,
  event: BpmnElement,
  value: string,
): void {
  const config = references[event.$type];
  if (!config) return;
  const previous = event[config.reference]?.$ref;
  const text = value.trim();
  if (text) {
    let root = document.model.rootElements.find(
      (item: BpmnElement) =>
        item.$type === config.type && item[config.property] === text,
    );
    if (!root) {
      root = {
        $type: config.type,
        id: bpmnId(config.type.slice(5)),
        [config.property]: text,
      };
      document.model.rootElements.push(root);
    }
    event[config.reference] = { $ref: root.id };
  } else {
    Reflect.deleteProperty(event, config.reference);
  }
  if (!previous || previous === event[config.reference]?.$ref) return;
  const referenced = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    if ('$ref' in value && value.$ref === previous) return true;
    return Object.values(value).some((child) => referenced(child));
  };
  if (!referenced(document.model))
    document.model.rootElements = document.model.rootElements.filter(
      (root: BpmnElement) => root.id !== previous || root.$type !== config.type,
    );
}
