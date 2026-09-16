import type {
  BpmnContract,
  BpmnDefinition,
  BpmnElement,
} from '#/api/workflow-engine/bpmn';

import { bpmnNamespace } from '#/api/workflow-engine/bpmn';

/**
 * 为画布元素生成符合标准标识约束的身份，复制节点不会复用执行标识。
 * @param prefix - 元素类别前缀。
 * @returns 本次新增元素的唯一标识。
 */
export function bpmnId(prefix = 'Element'): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '_')}`;
}

/**
 * 创建空的标准流程与 DI 平面，开始和结束事件由用户放置且不会预连线。
 * @returns 供现有列表新建操作保存的结构化定义。
 */
export function emptyBpmnWorkflow(): BpmnDefinition {
  const processId = bpmnId('Process');
  return {
    format: 'bpmn20',
    model: {
      $type: 'bpmn:Definitions',
      id: bpmnId('Definitions'),
      targetNamespace: bpmnNamespace,
      expressionLanguage: `${bpmnNamespace}/expression`,
      rootElements: [
        {
          $type: 'bpmn:Process',
          id: processId,
          isExecutable: true,
          flowElements: [],
          extensionElements: {
            $type: 'bpmn:ExtensionElements',
            values: [
              {
                $type: 'kt:Contract',
                body: JSON.stringify(emptyBpmnContract()),
              },
            ],
          },
        },
      ],
      diagrams: [
        {
          $type: 'bpmndi:BPMNDiagram',
          id: bpmnId('Diagram'),
          plane: {
            $type: 'bpmndi:BPMNPlane',
            id: bpmnId('Plane'),
            bpmnElement: { $ref: processId },
            planeElement: [],
          },
        },
      ],
    },
  };
}

/**
 * 给尚未接入业务的草稿提供空契约，避免默认创建业务或执行绑定。
 * @returns 空输入输出及有界总期限。
 */
export function emptyBpmnContract(): BpmnContract {
  return {
    processRef: null,
    inputSchema: { fields: [] },
    outputSchema: { fields: [] },
    output: {},
    formRef: null,
    formMapping: {},
    timeoutMs: 300_000,
  };
}

/**
 * 读取唯一可执行入口，子流程保留在各自作用域内。
 * @param definition - 完整标准定义。
 * @returns 当前发布入口的流程元素。
 */
export function bpmnProcess(definition: BpmnDefinition): BpmnElement {
  return (
    definition.model.rootElements.find(
      (element: BpmnElement) =>
        element.$type === 'bpmn:Process' && element.isExecutable,
    ) ??
    definition.model.rootElements.find(
      (element: BpmnElement) => element.$type === 'bpmn:Process',
    )
  );
}

/**
 * 读取流程或活动的 KT 扩展，不产生 XML 或另存自定义执行图。
 * @param element - 扩展所属标准元素。
 * @param type - 契约或步骤的命名空间类型。
 * @returns 已解析的业务扩展；没有配置时为空。
 */
export function bpmnExtension<T>(
  element: BpmnElement,
  type: 'kt:Contract' | 'kt:Step',
): null | T {
  const extension = element.extensionElements?.values?.find(
    (item: BpmnElement) => item.$type === type,
  );
  if (!extension) return null;
  return JSON.parse(extension.body) as T;
}

/**
 * 在所属标准元素上更新唯一业务扩展，其余标准属性与扩展保留。
 * @param element - 用户编辑的标准元素。
 * @param type - 当前扩展类别。
 * @param value - 结构化业务字段或脚本契约。
 */
export function setBpmnExtension(
  element: BpmnElement,
  type: 'kt:Contract' | 'kt:Step',
  value: unknown,
): void {
  const values = (element.extensionElements?.values ?? []).filter(
    (item: BpmnElement) => item.$type !== type,
  );
  values.push({ $type: type, body: JSON.stringify(value) });
  element.extensionElements = { $type: 'bpmn:ExtensionElements', values };
}

/**
 * 展开标准模型的包含关系，保留父作用域供连线和边界事件检查。
 * @param definition - 标准流程定义。
 * @returns 所有有身份的元素及其直接父元素。
 */
export function indexBpmn(
  definition: BpmnDefinition,
): Map<string, { element: BpmnElement; parent: BpmnElement | null }> {
  const index = new Map<
    string,
    { element: BpmnElement; parent: BpmnElement | null }
  >();
  const visit = (element: BpmnElement, parent: BpmnElement | null) => {
    if (element.id) index.set(element.id, { element, parent });
    for (const value of Object.values(element)) {
      if (Array.isArray(value)) {
        for (const child of value) if (child?.$type) visit(child, element);
      } else if (value?.$type) visit(value, element);
    }
  };
  visit(definition.model, null);
  return index;
}

/**
 * 读取标准 DI 平面；缺失的旧导入模型只补展示数据，不生成执行节点。
 * @param definition - 当前正在编辑的模型。
 * @returns 所属流程的标准展示平面。
 */
export function bpmnPlane(definition: BpmnDefinition): BpmnElement {
  const diagrams = (definition.model.diagrams ??= []);
  if (diagrams.length === 0)
    diagrams.push({
      $type: 'bpmndi:BPMNDiagram',
      id: bpmnId('Diagram'),
      plane: {
        $type: 'bpmndi:BPMNPlane',
        id: bpmnId('Plane'),
        bpmnElement: { $ref: bpmnProcess(definition).id },
        planeElement: [],
      },
    });
  return diagrams[0].plane;
}

/**
 * 将节点坐标和尺寸写入标准 BPMNShape，布局不会改变元素的标准类型。
 * @param definition - 待更新的模型。
 * @param id - 对应的流程元素标识。
 * @param bounds - 画布中确定的坐标和尺寸。
 * @param bounds.x - 节点左侧横坐标。
 * @param bounds.y - 节点顶部纵坐标。
 * @param bounds.width - 图形宽度。
 * @param bounds.height - 图形高度。
 */
export function setBpmnBounds(
  definition: BpmnDefinition,
  id: string,
  bounds: { height: number; width: number; x: number; y: number },
): void {
  const plane = bpmnPlane(definition);
  let shape = plane.planeElement.find(
    (item: BpmnElement) => item.bpmnElement?.$ref === id,
  );
  if (!shape) {
    shape = {
      $type: 'bpmndi:BPMNShape',
      id: bpmnId('Shape'),
      bpmnElement: { $ref: id },
    };
    plane.planeElement.push(shape);
  }
  shape.bounds = { $type: 'dc:Bounds', ...bounds };
  const type = indexBpmn(definition).get(id)?.element.$type;
  if (type === 'bpmn:Participant' || type === 'bpmn:Lane')
    shape.isHorizontal = true;
}

/**
 * 将手动改接或拖动后的折线保存为标准 BPMNEdge 路径。
 * @param definition - 当前标准模型。
 * @param id - 对应顺序流或消息流的身份。
 * @param points - 包括源端点与目标端点的完整路径。
 */
export function setBpmnWaypoints(
  definition: BpmnDefinition,
  id: string,
  points: Array<{ x: number; y: number }>,
): void {
  const plane = bpmnPlane(definition);
  let edge = plane.planeElement.find(
    (item: BpmnElement) => item.bpmnElement?.$ref === id,
  );
  if (!edge) {
    edge = {
      $type: 'bpmndi:BPMNEdge',
      id: bpmnId('Edge'),
      bpmnElement: { $ref: id },
    };
    plane.planeElement.push(edge);
  }
  edge.waypoint = points.map((point) => ({ $type: 'dc:Point', ...point }));
}

/**
 * 判断连线是否已填写完整条件，空字段和无法解析的草稿保持中性色。
 * @param flow - 待检查的顺序流。
 * @returns 条件结构及其操作数均已填写时返回真，不执行条件表达式。
 */
export function hasBpmnCondition(flow: BpmnElement): boolean {
  const body = flow.conditionExpression?.body;
  if (typeof body !== 'string' || !body.trim()) return false;
  const complete = (value: any, depth: number): boolean => {
    if (!value || typeof value !== 'object' || depth > 32) return false;
    if ('path' in value)
      return typeof value.path === 'string' && !!value.path.trim();
    if (!value.op && 'value' in value)
      return (
        value.value === null ||
        ['boolean', 'number', 'string'].includes(typeof value.value)
      );
    if (value.op === 'not') return complete(value.value, depth + 1);
    if (['and', 'or'].includes(value.op))
      return (
        Array.isArray(value.values) &&
        value.values.length > 0 &&
        value.values.every((item: unknown) => complete(item, depth + 1))
      );
    return (
      ['eq', 'gt', 'gte', 'lt', 'lte', 'ne'].includes(value.op) &&
      complete(value.left, depth + 1) &&
      complete(value.right, depth + 1)
    );
  };
  try {
    return complete(JSON.parse(body), 0);
  } catch {
    return false;
  }
}
