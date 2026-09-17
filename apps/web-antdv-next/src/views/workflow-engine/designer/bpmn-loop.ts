import type { BpmnElement } from '#/api/workflow-engine/bpmn';

import { BPMN_TYPE } from '#/constants/automation/bpmn';
import {
  BPMN_EXPRESSION_LANGUAGE,
  BPMN_LOOP_LIMITS,
} from '#/constants/automation/workflow';

/**
 * 按用户选择创建互不共享对象的标准循环属性，切换为不循环时清除属性。
 * @param type - 标准循环或多实例元模型类型，其他选项表示不循环。
 * @returns 新的循环配置；不循环时为空。
 */
export function createBpmnLoop(type: string): BpmnElement | undefined {
  if (type === BPMN_TYPE.StandardLoopCharacteristics)
    return {
      $type: type,
      testBefore: false,
      loopMaximum: BPMN_LOOP_LIMITS.initialCount,
      loopCondition: {
        $type: BPMN_TYPE.FormalExpression,
        language: BPMN_EXPRESSION_LANGUAGE,
        body: JSON.stringify({ value: true }),
      },
    };
  if (type === BPMN_TYPE.MultiInstanceLoopCharacteristics)
    return {
      $type: type,
      isSequential: false,
      loopCardinality: {
        $type: BPMN_TYPE.FormalExpression,
        body: String(BPMN_LOOP_LIMITS.initialCount),
      },
    };
  return undefined;
}
