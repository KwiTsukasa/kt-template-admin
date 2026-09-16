import { describe, expect, it } from 'vitest';
import {
  readBpmnCountBinding,
  writeBpmnCountBinding,
} from '#/views/workflow-engine/designer/bpmn-count-binding';

describe('动态多实例数量', () => {
  it('保留旧固定次数和新业务字段映射，重开不会把表达式转成 NaN', () => {
    expect(readBpmnCountBinding('3')).toEqual({ type: 'literal', value: 3 });
    const input = { type: 'input' as const, field: 'sourceCount' };
    expect(readBpmnCountBinding(writeBpmnCountBinding(input)!)).toEqual(input);
    const choosing = { type: 'input' as const, field: '' };
    expect(readBpmnCountBinding(writeBpmnCountBinding(choosing)!)).toEqual(
      choosing,
    );
    const first = {
      type: 'first' as const,
      sources: [
        { type: 'node' as const, nodeId: 'review', field: 'sourceCount' },
        input,
      ],
    };
    expect(readBpmnCountBinding(writeBpmnCountBinding(first)!)).toEqual(first);
  });
  it('拒绝将当前循环序号当作实例数量，不覆盖无法编辑的导入表达式', () => {
    expect(writeBpmnCountBinding({ type: 'iteration' })).toBeUndefined();
    expect(readBpmnCountBinding('{"op":"unknown"}')).toBeUndefined();
    expect(readBpmnCountBinding('invalid')).toBeUndefined();
  });
});
