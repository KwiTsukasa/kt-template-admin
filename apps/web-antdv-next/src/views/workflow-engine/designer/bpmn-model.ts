import type {
  BpmnContract,
  BpmnDefinition,
  BpmnElement,
} from '#/api/workflow-engine/bpmn';

import {
  BPMN_COORDINATE,
  BPMN_DI,
  BPMN_EXTENSION,
  BPMN_TYPE,
} from '#/constants/automation/bpmn';
import {
  BPMN_EXPRESSION_LANGUAGE,
  BPMN_FORMAT,
  BPMN_NAMESPACE,
  WORKFLOW_LIMITS,
} from '#/constants/automation/workflow';

import { readBpmnExpression } from './bpmn-expression';

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
    format: BPMN_FORMAT,
    model: {
      $type: BPMN_TYPE.Definitions,
      id: bpmnId('Definitions'),
      targetNamespace: BPMN_NAMESPACE,
      expressionLanguage: BPMN_EXPRESSION_LANGUAGE,
      rootElements: [
        {
          $type: BPMN_TYPE.Process,
          id: processId,
          isExecutable: true,
          flowElements: [],
          extensionElements: {
            $type: BPMN_TYPE.ExtensionElements,
            values: [
              {
                $type: BPMN_EXTENSION.Contract,
                body: JSON.stringify(emptyBpmnContract()),
              },
            ],
          },
        },
      ],
      diagrams: [
        {
          $type: BPMN_DI.BPMNDiagram,
          id: bpmnId('Diagram'),
          plane: {
            $type: BPMN_DI.BPMNPlane,
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
    timeoutMs: WORKFLOW_LIMITS.defaultTimeoutMs,
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
        element.$type === BPMN_TYPE.Process && element.isExecutable,
    ) ??
    definition.model.rootElements.find(
      (element: BpmnElement) => element.$type === BPMN_TYPE.Process,
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
  type: typeof BPMN_EXTENSION.Contract | typeof BPMN_EXTENSION.Step,
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
  type: typeof BPMN_EXTENSION.Contract | typeof BPMN_EXTENSION.Step,
  value: unknown,
): void {
  const values = (element.extensionElements?.values ?? []).filter(
    (item: BpmnElement) => item.$type !== type,
  );
  values.push({ $type: type, body: JSON.stringify(value) });
  element.extensionElements = { $type: BPMN_TYPE.ExtensionElements, values };
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
      $type: BPMN_DI.BPMNDiagram,
      id: bpmnId('Diagram'),
      plane: {
        $type: BPMN_DI.BPMNPlane,
        id: bpmnId('Plane'),
        bpmnElement: { $ref: bpmnProcess(definition).id },
        planeElement: [],
      },
    });
  return diagrams[0].plane;
}

/**
 * 一次建立展示平面的图元索引，批量渲染和布局按身份读取，不逐节点重扫全部图元。
 * @param definition - 当前标准模型，缺少展示平面时建立空平面。
 * @returns 引用原有图元的索引，本批新增图元时应同步加入索引。
 */
export function indexBpmnShapes(
  definition: BpmnDefinition,
): Map<string, BpmnElement> {
  const shapes = new Map<string, BpmnElement>();
  for (const shape of bpmnPlane(definition).planeElement ?? []) {
    if (shape.bpmnElement?.$ref) shapes.set(shape.bpmnElement.$ref, shape);
  }
  return shapes;
}

export type BpmnDiagramIndex = {
  elements: ReturnType<typeof indexBpmn>;
  plane: BpmnElement;
  shapes: Map<string, BpmnElement>;
};

/**
 * 为一次编辑批次建立模型与 DI 索引，批量坐标写入复用原对象，不按节点重扫模型。
 * @param definition - 本次编辑拥有的模型副本。
 * @returns 本批有效的模型、图元和展示平面索引；拓扑变化后重新建立。
 */
export function indexBpmnDiagram(definition: BpmnDefinition): BpmnDiagramIndex {
  return {
    elements: indexBpmn(definition),
    plane: bpmnPlane(definition),
    shapes: indexBpmnShapes(definition),
  };
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
 * @param index - 同一编辑批次的索引，单次写入时省略。
 */
export function setBpmnBounds(
  definition: BpmnDefinition,
  id: string,
  bounds: { height: number; width: number; x: number; y: number },
  index = indexBpmnDiagram(definition),
): void {
  const plane = index.plane;
  let shape = index.shapes.get(id);
  if (!shape) {
    shape = {
      $type: BPMN_DI.BPMNShape,
      id: bpmnId('Shape'),
      bpmnElement: { $ref: id },
    };
    plane.planeElement.push(shape);
    index.shapes.set(id, shape);
  }
  shape.bounds = { $type: BPMN_COORDINATE.Bounds, ...bounds };
  const type = index.elements.get(id)?.element.$type;
  if (type === BPMN_TYPE.Participant || type === BPMN_TYPE.Lane)
    shape.isHorizontal = true;
}

/**
 * 将手动改接或拖动后的折线保存为标准 BPMNEdge 路径。
 * @param definition - 当前标准模型。
 * @param id - 对应顺序流或消息流的身份。
 * @param points - 包括源端点与目标端点的完整路径。
 * @param index - 同一编辑批次的索引，单次写入时省略。
 */
export function setBpmnWaypoints(
  definition: BpmnDefinition,
  id: string,
  points: Array<{ x: number; y: number }>,
  index = indexBpmnDiagram(definition),
): void {
  const plane = index.plane;
  let edge = index.shapes.get(id);
  if (!edge) {
    edge = {
      $type: BPMN_DI.BPMNEdge,
      id: bpmnId('Edge'),
      bpmnElement: { $ref: id },
    };
    plane.planeElement.push(edge);
    index.shapes.set(id, edge);
  }
  edge.waypoint = points.map((point) => ({
    $type: BPMN_COORDINATE.Point,
    ...point,
  }));
}

/**
 * 判断连线是否已填写完整条件，空字段和无法解析的草稿保持中性色。
 * @param flow - 待检查的顺序流。
 * @returns 条件结构及其操作数均已填写时返回真，不执行条件表达式。
 */
export function hasBpmnCondition(flow: BpmnElement): boolean {
  const body = flow.conditionExpression?.body;
  if (flow.conditionExpression?.language !== BPMN_EXPRESSION_LANGUAGE)
    return false;
  if (typeof body !== 'string' || !body.trim()) return false;
  const expression = readBpmnExpression(body, true);
  if (!expression) return false;
  if ('value' in expression) return typeof expression.value === 'boolean';
  if ('op' in expression && expression.op === 'sum') return false;
  return true;
}
