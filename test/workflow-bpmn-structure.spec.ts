import { describe, expect, it } from 'vitest';
import { arrangeBpmnScope } from '#/views/workflow-engine/designer/bpmn-layout';
import { bpmnPlane, bpmnProcess, emptyBpmnWorkflow, indexBpmn, setBpmnBounds, } from '#/views/workflow-engine/designer/bpmn-model';
import { addBpmnLane, addBpmnPool, assignBpmnLane, attachBpmnBoundary, bpmnBounds, bpmnConnectionType, bpmnLanes, bpmnPool, bpmnVisibleElements, fitBpmnContainers, moveBpmnElement, removeBpmnElement, } from '#/views/workflow-engine/designer/bpmn-structure';
const fixture = () => {
    const document = emptyBpmnWorkflow();
    const process = bpmnProcess(document);
    process.flowElements.push({ $type: 'bpmn:UserTask', id: 'a' }, { $type: 'bpmn:UserTask', id: 'b' }, { $type: 'bpmn:EndEvent', id: 'end' }, { $type: 'bpmn:ExclusiveGateway', id: 'g' }, {
        $type: 'bpmn:SequenceFlow',
        id: 'ab',
        sourceRef: { $ref: 'a' },
        targetRef: { $ref: 'b' },
    });
    setBpmnBounds(document, 'a', { x: 130, y: 100, width: 160, height: 76 });
    setBpmnBounds(document, 'b', { x: 390, y: 100, width: 160, height: 76 });
    return { document, process };
};
describe('bPMN 容器与附着关系', () => {
    it('三分支汇合按排布轴接入网关，侧向偏移不会误判回环', () => {
        const document = emptyBpmnWorkflow();
        const process = bpmnProcess(document);
        const flow = (source: string, target: string) => ({
            $type: 'bpmn:SequenceFlow',
            id: source + target,
            sourceRef: { $ref: source },
            targetRef: { $ref: target },
        });
        process.flowElements = [
            { $type: 'bpmn:StartEvent', id: 's' },
            ...['a', 'b', 'c'].map((id) => ({ $type: 'bpmn:UserTask', id })),
            { $type: 'bpmn:ComplexGateway', id: 'g' },
            ...['a', 'b', 'c'].flatMap((id) => [flow('s', id), flow(id, 'g')]),
            flow('g', 'a'),
        ];
        arrangeBpmnScope(document, '', false);
        const points = (id: string) => bpmnPlane(document).planeElement.find((item: any) => item.bpmnElement?.$ref === id).waypoint;
        const gateway = requireValue(bpmnBounds(document, 'g'));
        for (const id of ['ag', 'bg', 'cg'])
            expect(points(id).at(-1)).toMatchObject({
                x: gateway.x,
                y: gateway.y + gateway.height / 2,
            });
        expect(points('ga')[0].y).toBe(gateway.y + gateway.height);
        arrangeBpmnScope(document, '', true);
        const vertical = requireValue(bpmnBounds(document, 'g'));
        for (const id of ['ag', 'bg', 'cg'])
            expect(points(id).at(-1)).toMatchObject({
                x: vertical.x + vertical.width / 2,
                y: vertical.y,
            });
        expect(points('ga')[0].x).toBe(vertical.x + vertical.width);
    });
    it('没有 DI 的标准流程能生成分离布局，横纵排布保留原始流向和模型元素', () => {
        const document = emptyBpmnWorkflow();
        const process = bpmnProcess(document);
        process.flowElements = [
            { $type: 'bpmn:StartEvent', id: 'start' },
            { $type: 'bpmn:ServiceTask', id: 'step' },
            { $type: 'bpmn:EndEvent', id: 'end' },
            {
                $type: 'bpmn:SequenceFlow',
                id: 'first',
                sourceRef: { $ref: 'start' },
                targetRef: { $ref: 'step' },
            },
            {
                $type: 'bpmn:SequenceFlow',
                id: 'last',
                sourceRef: { $ref: 'step' },
                targetRef: { $ref: 'end' },
            },
        ];
        delete document.model.diagrams;
        expect(bpmnBounds(document, 'step')).toBeUndefined();
        expect(document.model.diagrams).toBeUndefined();
        const original = JSON.stringify(process.flowElements);
        arrangeBpmnScope(document, '', false);
        expect(requireValue(bpmnBounds(document, 'start')).x + 40).toBeLessThan(requireValue(bpmnBounds(document, 'step')).x);
        expect(requireValue(bpmnBounds(document, 'step')).x + 160).toBeLessThan(requireValue(bpmnBounds(document, 'end')).x);
        arrangeBpmnScope(document, '', true);
        expect(requireValue(bpmnBounds(document, 'start')).y + 40).toBeLessThan(requireValue(bpmnBounds(document, 'step')).y);
        expect(requireValue(bpmnBounds(document, 'step')).y + 76).toBeLessThan(requireValue(bpmnBounds(document, 'end')).y);
        expect(JSON.stringify(process.flowElements)).toBe(original);
    });
    it('排布过程中暂时超出旧泳道边界时，附着事件仍继承宿主归属', () => {
        const { document, process } = fixture();
        const lane = addBpmnLane(document);
        process.flowElements.push({
            $type: 'bpmn:BoundaryEvent',
            id: 'timer',
            attachedToRef: { $ref: 'a' },
        });
        setBpmnBounds(document, 'a', { x: 130, y: 700, width: 160, height: 76 });
        attachBpmnBoundary(document, 'timer', 'a');
        fitBpmnContainers(document);
        expect(lane.flowNodeRef.map((reference: any) => reference.$ref)).toContain('timer');
        expect(requireValue(bpmnBounds(document, 'timer')).y).toBe(requireValue(bpmnBounds(document, 'a')).y + 56);
    });
    it('纵向排布扩展泳道后，后续泳道和外部参与者不会与内容重叠', () => {
        const { document } = fixture();
        const first = addBpmnLane(document);
        const second = addBpmnLane(document);
        const external = addBpmnPool(document);
        setBpmnBounds(document, 'a', { x: 130, y: 700, width: 160, height: 76 });
        fitBpmnContainers(document);
        expect(requireValue(bpmnBounds(document, first.id)).height).toBeGreaterThan(736);
        expect(requireValue(bpmnBounds(document, second.id)).y).toBe(requireValue(bpmnBounds(document, first.id)).y +
            requireValue(bpmnBounds(document, first.id)).height);
        const pool = requireValue(bpmnBounds(document, requireValue(bpmnPool(document, 'a')).id));
        expect(requireValue(bpmnBounds(document, external.id)).y).toBeGreaterThan(pool.y + pool.height);
    });
    it('新增外部池不会创建执行流程，协作 DI 保存引用且原活动身份不变', () => {
        const { document, process } = fixture();
        const external = addBpmnPool(document);
        expect(document.model.rootElements.filter((element: any) => element.$type === 'bpmn:Process')).toEqual([process]);
        expect(external.processRef).toBeUndefined();
        expect(bpmnPool(document, 'a')?.processRef.$ref).toBe(process.id);
        expect(bpmnVisibleElements(document).map((element) => element.id)).toContain(external.id);
        expect(indexBpmn(structuredClone(document)).get(bpmnPlane(document).bpmnElement.$ref)?.element.$type).toBe('bpmn:Collaboration');
    });
    it('跨泳道仍为顺序流，跨参与者仅合法消息端点可连接', () => {
        const { document } = fixture();
        addBpmnLane(document);
        const lane = addBpmnLane(document);
        const box = requireValue(bpmnBounds(document, lane.id));
        moveBpmnElement(document, 'b', { x: box.x + 100, y: box.y + 60 });
        const external = addBpmnPool(document);
        expect(bpmnConnectionType(document, 'a', 'b')).toBe('bpmn:SequenceFlow');
        expect(bpmnConnectionType(document, 'a', requireValue(external.id))).toBe('bpmn:MessageFlow');
        expect(bpmnConnectionType(document, 'g', requireValue(external.id))).toBeNull();
        expect(bpmnConnectionType(document, requireValue(lane.id), 'b')).toBeNull();
        expect(bpmnConnectionType(document, 'end', 'b')).toBeNull();
    });
    it('移动活动和泳道同步标准归属，宿主边界不留在旧泳道', () => {
        const { document, process } = fixture();
        const first = addBpmnLane(document);
        const second = addBpmnLane(document);
        process.flowElements.push({
            $type: 'bpmn:BoundaryEvent',
            id: 'timer',
            eventDefinitions: [{ $type: 'bpmn:TimerEventDefinition' }],
        });
        attachBpmnBoundary(document, 'timer', 'a');
        const box = requireValue(bpmnBounds(document, second.id));
        moveBpmnElement(document, 'a', { x: box.x + 100, y: box.y + 60 });
        expect(first.flowNodeRef.map((reference: any) => reference.$ref)).not.toContain('a');
        expect(second.flowNodeRef.map((reference: any) => reference.$ref)).toEqual([
            'a',
            'timer',
        ]);
        const before = requireValue(bpmnBounds(document, 'a'));
        moveBpmnElement(document, requireValue(second.id), { x: box.x + 40, y: box.y + 30 });
        expect(bpmnBounds(document, 'a')).toMatchObject({
            x: before.x + 40,
            y: before.y + 30,
        });
        expect(requireValue(bpmnBounds(document, 'timer')).y).toBe(requireValue(bpmnBounds(document, 'a')).y + 56);
    });
    it('删除宿主清理边界、边界外出流和泳道引用；删除泳道保留活动', () => {
        const { document, process } = fixture();
        const lane = addBpmnLane(document);
        process.flowElements.push({
            $type: 'bpmn:BoundaryEvent',
            id: 'timer',
            attachedToRef: { $ref: 'a' },
        }, {
            $type: 'bpmn:SequenceFlow',
            id: 'timeout',
            sourceRef: { $ref: 'timer' },
            targetRef: { $ref: 'b' },
        });
        assignBpmnLane(document, 'a');
        removeBpmnElement(document, 'a');
        const index = indexBpmn(document);
        for (const id of ['a', 'timer', 'timeout', 'ab'])
            expect(index.has(id)).toBe(false);
        expect(lane.flowNodeRef.map((reference: any) => reference.$ref)).not.toContain('timer');
        removeBpmnElement(document, requireValue(lane.id));
        expect(indexBpmn(document).has('b')).toBe(true);
        expect(bpmnLanes(process)).toEqual([]);
    });
});

/**
 * 为测试中必须存在的模型元素保留明确断言，避免非空断言掩盖构图失败。
 * @param value - 构图或索引后应当存在的元素。
 * @returns 已确认存在的元素。
 * @throws 测试模型缺少预期元素时立即失败。
 */
function requireValue<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("测试模型缺少预期元素");
  return value;
}
