import type { BpmnElement } from '#/api/workflow-engine/bpmn';

import { bpmnNamespace } from '#/api/workflow-engine/bpmn';

export const BPMN_LOOP_LIMITS = Object.freeze({
  initialCount: 3,
  maxInstances: 1000,
  maxIterations: 10_000,
});

/**
 * 按用户选择创建互不共享对象的标准循环属性，切换为不循环时清除属性。
 * @param type - 标准循环或多实例元模型类型，其他选项表示不循环。
 * @returns 新的循环配置；不循环时为空。
 */
export function createBpmnLoop(type: string): BpmnElement | undefined {
  if (type === 'bpmn:StandardLoopCharacteristics')
    return {
      $type: type,
      testBefore: false,
      loopMaximum: BPMN_LOOP_LIMITS.initialCount,
      loopCondition: {
        $type: 'bpmn:FormalExpression',
        language: `${bpmnNamespace}/expression`,
        body: JSON.stringify({ value: true }),
      },
    };
  if (type === 'bpmn:MultiInstanceLoopCharacteristics')
    return {
      $type: type,
      isSequential: false,
      loopCardinality: {
        $type: 'bpmn:FormalExpression',
        body: String(BPMN_LOOP_LIMITS.initialCount),
      },
    };
  return undefined;
}
