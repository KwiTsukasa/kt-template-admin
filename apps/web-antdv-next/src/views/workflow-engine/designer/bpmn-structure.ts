import type { BpmnDefinition, BpmnElement } from '#/api/workflow-engine/bpmn';

import {
  bpmnId,
  bpmnPlane,
  bpmnProcess,
  indexBpmn,
  setBpmnBounds,
} from './bpmn-model';

export type BpmnBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

/**
 * 读取节点的标准图形边界，缺失 DI 时保持未布局状态。
 * @param document - 当前结构化定义。
 * @param id - 流程元素身份。
 * @returns 已保存的坐标与尺寸，未布局时为空。
 */
export function bpmnBounds(
  document: BpmnDefinition,
  id?: string,
): BpmnBounds | undefined {
  return document.model.diagrams?.[0]?.plane?.planeElement?.find(
    (shape: BpmnElement) => shape.bpmnElement?.$ref === id,
  )?.bounds;
}

/**
 * 将嵌套泳道展开为编辑器可选择的标准元素，不复制流程节点。
 * @param scope - 拥有泳道集的流程或子流程。
 * @returns 按包含顺序排列的泳道。
 */
export function bpmnLanes(scope: BpmnElement): BpmnElement[] {
  const result: BpmnElement[] = [];
  const visit = (set: BpmnElement) => {
    for (const lane of set.lanes ?? []) {
      result.push(lane);
      if (lane.childLaneSet) visit(lane.childLaneSet);
    }
  };
  for (const set of scope.laneSets ?? []) visit(set);
  return result;
}

/**
 * 按流程边界显示图元，顶层同时展示参与者及消息流。
 * @param document - 当前标准定义。
 * @param scopeId - 当前打开的子流程身份。
 * @returns 当前画布应呈现的元素。
 */
export function bpmnVisibleElements(
  document: BpmnDefinition,
  scopeId = '',
): BpmnElement[] {
  const scope =
    indexBpmn(document).get(scopeId)?.element ?? bpmnProcess(document);
  const elements = [
    ...bpmnLanes(scope),
    ...(scope.flowElements ?? []),
    ...(scope.artifacts ?? []),
  ];
  if (scopeId) return elements;
  const collaboration = document.model.rootElements.find(
    (item: BpmnElement) => item.$type === 'bpmn:Collaboration',
  );
  if (!collaboration) return elements;
  return [
    ...(collaboration.participants ?? []),
    ...elements,
    ...(collaboration.messageFlows ?? []),
  ];
}

/**
 * 将活动所属流程映射到参与者，泳道不构成消息流边界。
 * @param document - 当前定义。
 * @param id - 活动、事件或泳池身份。
 * @returns 对应参与者；未声明泳池时为空。
 */
export function bpmnPool(
  document: BpmnDefinition,
  id: string,
): BpmnElement | undefined {
  const index = indexBpmn(document);
  let current = index.get(id);
  if (current?.element.$type === 'bpmn:Participant') return current.element;
  while (current && current.element.$type !== 'bpmn:Process')
    current = index.get(current.parent?.id ?? '');
  if (!current) return;
  const processId = current.element.id;
  return [...index.values()].find(
    ({ element }) =>
      element.$type === 'bpmn:Participant' &&
      element.processRef?.$ref === processId,
  )?.element;
}

/**
 * 根据节点类型和作用域决定合法连线种类，拒绝泳道连线和跨子流程顺序流。
 * @param document - 包含源目标的标准定义。
 * @param sourceId - 源元素身份。
 * @param targetId - 目标元素身份。
 * @returns 合法连接类型；不合法时为空。
 */
export function bpmnConnectionType(
  document: BpmnDefinition,
  sourceId: string,
  targetId: string,
): 'bpmn:Association' | 'bpmn:MessageFlow' | 'bpmn:SequenceFlow' | null {
  const index = indexBpmn(document);
  const source = index.get(sourceId);
  const target = index.get(targetId);
  if (!source || !target || source === target) return null;
  const sourcePool = bpmnPool(document, sourceId);
  const targetPool = bpmnPool(document, targetId);
  if (sourcePool && targetPool && sourcePool.id !== targetPool.id) {
    const messageEndpoint = (element: BpmnElement, incoming: boolean) => {
      if (
        element.$type === 'bpmn:Participant' ||
        /(?:Task|Activity|SubProcess|Transaction)$/.test(element.$type)
      )
        return true;
      if (
        !element.eventDefinitions?.some(
          (event: BpmnElement) => event.$type === 'bpmn:MessageEventDefinition',
        )
      )
        return false;
      if (incoming)
        return [
          'bpmn:BoundaryEvent',
          'bpmn:IntermediateCatchEvent',
          'bpmn:StartEvent',
        ].includes(element.$type);
      return ['bpmn:EndEvent', 'bpmn:IntermediateThrowEvent'].includes(
        element.$type,
      );
    };
    if (
      messageEndpoint(source.element, false) &&
      messageEndpoint(target.element, true)
    )
      return 'bpmn:MessageFlow';
    return null;
  }
  if (source.parent !== target.parent) return null;
  if (source.element.triggeredByEvent || target.element.triggeredByEvent)
    return null;
  if (
    source.element.$type === 'bpmn:BoundaryEvent' &&
    source.element.eventDefinitions?.some(
      (event: BpmnElement) => event.$type === 'bpmn:CompensateEventDefinition',
    )
  ) {
    if (target.element.isForCompensation) return 'bpmn:Association';
    return null;
  }
  if (
    ![source.element, target.element].every((element) =>
      /(?:Task|Activity|Event|Gateway|SubProcess|Transaction)$/.test(
        element.$type,
      ),
    )
  )
    return null;
  if (source.element.isForCompensation || target.element.isForCompensation)
    return null;
  if (
    source.element.$type === 'bpmn:EndEvent' ||
    ['bpmn:BoundaryEvent', 'bpmn:StartEvent'].includes(target.element.$type)
  )
    return null;
  return 'bpmn:SequenceFlow';
}

/**
 * 为主流程建立标准参与者和协作平面，已有节点与执行身份保持不变。
 * @param document - 需要泳池容器的定义。
 * @returns 主流程所属参与者。
 */
export function ensureBpmnPool(document: BpmnDefinition): BpmnElement {
  const process = bpmnProcess(document);
  let collaboration = document.model.rootElements.find(
    (item: BpmnElement) => item.$type === 'bpmn:Collaboration',
  );
  if (!collaboration) {
    collaboration = {
      $type: 'bpmn:Collaboration',
      id: bpmnId('Collaboration'),
      participants: [],
      messageFlows: [],
    };
    document.model.rootElements.push(collaboration);
  }
  let pool = collaboration.participants.find(
    (item: BpmnElement) => item.processRef?.$ref === process.id,
  );
  if (!pool) {
    pool = {
      $type: 'bpmn:Participant',
      id: bpmnId('Participant'),
      name: process.name || '当前业务',
      processRef: { $ref: process.id },
    };
    collaboration.participants.push(pool);
    const bounds = (process.flowElements ?? [])
      .map((item: BpmnElement) => bpmnBounds(document, item.id))
      .filter(Boolean) as BpmnBounds[];
    const x = Math.min(40, ...bounds.map((box) => box.x - 70));
    const y = Math.min(40, ...bounds.map((box) => box.y - 50));
    setBpmnBounds(document, pool.id, {
      x,
      y,
      width: Math.max(920, ...bounds.map((box) => box.x + box.width - x + 60)),
      height: Math.max(
        280,
        ...bounds.map((box) => box.y + box.height - y + 60),
      ),
    });
  }
  bpmnPlane(document).bpmnElement = { $ref: collaboration.id };
  return pool;
}

/**
 * 添加外部参与者泳池，外部协作不会自动产生可执行流程。
 * @param document - 当前标准定义。
 * @param position - 用户拖入的坐标；点击添加时放在现有图元下方。
 * @param position.x - 泳池左侧横坐标。
 * @param position.y - 泳池顶部纵坐标。
 * @returns 新的外部参与者。
 */
export function addBpmnPool(
  document: BpmnDefinition,
  position?: { x: number; y: number },
): BpmnElement {
  ensureBpmnPool(document);
  const collaboration = document.model.rootElements.find(
    (item: BpmnElement) => item.$type === 'bpmn:Collaboration',
  );
  const pool = {
    $type: 'bpmn:Participant',
    id: bpmnId('Participant'),
    name: '外部参与者',
  };
  const bounds = collaboration.participants
    .map((item: BpmnElement) => bpmnBounds(document, item.id))
    .filter(Boolean) as BpmnBounds[];
  collaboration.participants.push(pool);
  setBpmnBounds(document, pool.id, {
    x: position?.x ?? 40,
    y: position?.y ?? Math.max(...bounds.map((box) => box.y + box.height)) + 80,
    width: 920,
    height: 100,
  });
  return pool;
}

/**
 * 添加同一流程的泳道，首条泳道接收已有节点，新增泳道不改变执行拓扑。
 * @param document - 当前定义。
 * @param scopeId - 所属流程或子流程。
 * @returns 新增泳道身份。
 */
export function addBpmnLane(
  document: BpmnDefinition,
  scopeId = '',
): BpmnElement {
  const scope =
    indexBpmn(document).get(scopeId)?.element ?? bpmnProcess(document);
  let box: BpmnBounds = { x: 40, y: 40, width: 920, height: 240 };
  let pool: BpmnElement | undefined;
  if (!scopeId) {
    pool = ensureBpmnPool(document);
    box = bpmnBounds(document, pool.id) ?? box;
  }
  scope.laneSets ??= [
    { $type: 'bpmn:LaneSet', id: bpmnId('LaneSet'), lanes: [] },
  ];
  const lanes = scope.laneSets[0].lanes;
  const lane: BpmnElement = {
    $type: 'bpmn:Lane',
    id: bpmnId('Lane'),
    name: `泳道 ${lanes.length + 1}`,
    flowNodeRef: [],
  };
  let y = box.y;
  let height = box.height;
  if (lanes.length > 0) {
    y = Math.max(
      ...lanes.map((item: BpmnElement) => {
        const existing = bpmnBounds(document, item.id);
        return (existing?.y ?? box.y) + (existing?.height ?? 240);
      }),
    );
    height = 240;
  } else
    lane.flowNodeRef = (scope.flowElements ?? [])
      .filter((item: BpmnElement) => item.$type !== 'bpmn:SequenceFlow')
      .map((item: BpmnElement) => ({ $ref: item.id }));
  lanes.push(lane);
  setBpmnBounds(document, lane.id ?? '', {
    x: box.x + 30,
    y,
    width: box.width - 30,
    height,
  });
  if (pool)
    setBpmnBounds(document, pool.id ?? '', {
      ...box,
      height: y + height - box.y,
    });
  fitBpmnContainers(document, scopeId);
  return lane;
}

/**
 * 根据活动在画布上的位置更新泳道引用，边界事件与其宿主保持一致。
 * @param document - 当前定义。
 * @param id - 被移动或新建的节点。
 */
export function assignBpmnLane(document: BpmnDefinition, id: string): void {
  const current = indexBpmn(document).get(id);
  if (!current?.parent?.flowElements) return;
  const box = bpmnBounds(document, current.element.attachedToRef?.$ref ?? id);
  if (!box) return;
  const lanes = bpmnLanes(current.parent);
  const children = new Set([
    id,
    ...current.parent.flowElements
      .filter((item: BpmnElement) => item.attachedToRef?.$ref === id)
      .map((item: BpmnElement) => item.id),
  ]);
  const target = lanes.toReversed().find((lane) => {
    if (current.element.attachedToRef)
      return lane.flowNodeRef?.some(
        (reference: { $ref: string }) =>
          reference.$ref === current.element.attachedToRef.$ref,
      );
    const bounds = bpmnBounds(document, lane.id);
    return (
      bounds &&
      box.x + box.width / 2 >= bounds.x &&
      box.x + box.width / 2 <= bounds.x + bounds.width &&
      box.y + box.height / 2 >= bounds.y &&
      box.y + box.height / 2 <= bounds.y + bounds.height
    );
  });
  for (const lane of lanes)
    lane.flowNodeRef = (lane.flowNodeRef ?? []).filter(
      (reference: { $ref: string }) => !children.has(reference.$ref),
    );
  if (target)
    target.flowNodeRef.push(...[...children].map(($ref) => ({ $ref })));
}

/**
 * 移动容器或活动时同步其内容和附着事件，避免视觉位置与标准引用脱离。
 * @param document - 待更新定义。
 * @param id - 移动元素身份。
 * @param position - 拖动后的左上角坐标。
 * @param position.x - 元素左侧横坐标。
 * @param position.y - 元素顶部纵坐标。
 */
export function moveBpmnElement(
  document: BpmnDefinition,
  id: string,
  position: { x: number; y: number },
): void {
  const index = indexBpmn(document);
  const element = index.get(id)?.element;
  const box = bpmnBounds(document, id);
  if (!element || !box) return;
  const dx = position.x - box.x;
  const dy = position.y - box.y;
  const moved = new Set<string>([id]);
  if (element.$type === 'bpmn:Participant' && element.processRef) {
    const process = index.get(element.processRef.$ref)?.element;
    if (process)
      for (const item of [
        ...bpmnLanes(process),
        ...(process.flowElements ?? []),
      ])
        moved.add(item.id);
  }
  if (element.$type === 'bpmn:Lane')
    for (const reference of element.flowNodeRef ?? [])
      moved.add(reference.$ref);
  for (const { element: item } of index.values())
    if (moved.has(item.attachedToRef?.$ref)) moved.add(item.id ?? '');
  for (const movedId of moved) {
    const bounds = bpmnBounds(document, movedId);
    if (bounds)
      setBpmnBounds(document, movedId, {
        ...bounds,
        x: bounds.x + dx,
        y: bounds.y + dy,
      });
  }
  for (const shape of bpmnPlane(document).planeElement) {
    if (!shape.waypoint) continue;
    const flow = index.get(shape.bpmnElement?.$ref)?.element;
    if (
      !flow ||
      (!moved.has(flow.sourceRef?.$ref) && !moved.has(flow.targetRef?.$ref))
    )
      continue;
    if (moved.has(flow.sourceRef?.$ref) && moved.has(flow.targetRef?.$ref))
      shape.waypoint = shape.waypoint.map((point: BpmnElement) => ({
        ...point,
        x: point.x + dx,
        y: point.y + dy,
      }));
    else delete shape.waypoint;
  }
  assignBpmnLane(document, id);
}

/**
 * 自动排布后扩展泳道与泳池，按泳道顺序移动内容并保持外部参与者分离。
 * @param document - 已更新活动布局的定义。
 * @param scopeId - 当前排布的流程作用域。
 */
export function fitBpmnContainers(
  document: BpmnDefinition,
  scopeId = '',
): void {
  const scope =
    indexBpmn(document).get(scopeId)?.element ?? bpmnProcess(document);
  const lanes = bpmnLanes(scope).filter((lane) => !lane.childLaneSet);
  let bottom: number | undefined;
  for (const lane of lanes) {
    const box = bpmnBounds(document, lane.id);
    if (!box) continue;
    if (bottom !== undefined && box.y !== bottom)
      moveBpmnElement(document, lane.id ?? '', { x: box.x, y: bottom });
    const current = bpmnBounds(document, lane.id) ?? box;
    const children = (lane.flowNodeRef ?? [])
      .map((reference: { $ref: string }) =>
        bpmnBounds(document, reference.$ref),
      )
      .filter(Boolean) as BpmnBounds[];
    const height = Math.max(
      220,
      ...children.map((child) => child.y + child.height + 60 - current.y),
    );
    const width = Math.max(
      890,
      ...children.map((child) => child.x + child.width + 60 - current.x),
    );
    setBpmnBounds(document, lane.id ?? '', { ...current, height, width });
    bottom = current.y + height;
  }
  const width = Math.max(
    890,
    ...lanes.map((lane) => bpmnBounds(document, lane.id)?.width ?? 0),
  );
  for (const lane of lanes) {
    const box = bpmnBounds(document, lane.id);
    if (box) setBpmnBounds(document, lane.id ?? '', { ...box, width });
  }
  if (scopeId) return;
  const pool = bpmnPool(document, scope.id ?? '');
  const box = pool && bpmnBounds(document, pool.id);
  if (!pool || !box) return;
  const children = [...lanes, ...(scope.flowElements ?? [])]
    .map((element: BpmnElement) => bpmnBounds(document, element.id))
    .filter(Boolean) as BpmnBounds[];
  const height = Math.max(
    280,
    ...children.map((child) => child.y + child.height - box.y),
  );
  const poolWidth = Math.max(
    width + 30,
    ...children.map((child) => child.x + child.width + 30 - box.x),
  );
  setBpmnBounds(document, pool.id ?? '', { ...box, width: poolWidth, height });
  let nextY = box.y + height + 80;
  for (const { element } of indexBpmn(document).values()) {
    if (element.$type !== 'bpmn:Participant' || element.id === pool.id)
      continue;
    const external = bpmnBounds(document, element.id);
    if (!external) continue;
    if (external.y < nextY)
      moveBpmnElement(document, element.id ?? '', { x: external.x, y: nextY });
    nextY = Math.max(external.y, nextY) + external.height + 80;
  }
}

/**
 * 将边界事件贴到同作用域活动的底边，附着操作不会生成顺序流。
 * @param document - 当前定义。
 * @param boundaryId - 待附着的边界事件。
 * @param activityId - 用户选择的宿主活动。
 */
export function attachBpmnBoundary(
  document: BpmnDefinition,
  boundaryId: string,
  activityId: string,
): void {
  const index = indexBpmn(document);
  const boundary = index.get(boundaryId);
  const activity = index.get(activityId);
  if (
    !boundary ||
    !activity ||
    activity.element.triggeredByEvent ||
    boundary.parent !== activity.parent ||
    !/(?:Task|Activity|SubProcess|Transaction)$/.test(activity.element.$type)
  )
    return;
  boundary.element.attachedToRef = { $ref: activityId };
  const box = bpmnBounds(document, activityId);
  if (box) {
    const siblings =
      boundary.parent?.flowElements.filter(
        (item: BpmnElement) => item.attachedToRef?.$ref === activityId,
      ) ?? [];
    siblings.forEach((item: BpmnElement, position: number) =>
      setBpmnBounds(document, item.id ?? '', {
        x: box.x + (box.width * (position + 1)) / (siblings.length + 1) - 20,
        y: box.y + box.height - 20,
        width: 40,
        height: 40,
      }),
    );
  }
  assignBpmnLane(document, boundaryId);
}

/**
 * 删除元素、从属边界和相关连线，同时清理 DI、泳道和默认流引用。
 * @param document - 当前编辑定义。
 * @param id - 用户删除的元素身份。
 */
export function removeBpmnElement(document: BpmnDefinition, id: string): void {
  const ids = new Set([id]);
  const index = indexBpmn(document);
  const root = index.get(id)?.element;
  if (!root) return;
  const collect = (element: BpmnElement) => {
    if (element.id) ids.add(element.id);
    for (const value of Object.values(element)) {
      if (Array.isArray(value)) {
        for (const child of value) if (child?.$type) collect(child);
      } else if (value?.$type) collect(value);
    }
  };
  collect(root);
  for (const { element } of index.values())
    if (ids.has(element.attachedToRef?.$ref)) collect(element);
  for (const { element } of index.values())
    if (ids.has(element.sourceRef?.$ref) || ids.has(element.targetRef?.$ref))
      ids.add(element.id ?? '');
  const clean = (element: BpmnElement) => {
    for (const [key, value] of Object.entries(element)) {
      if (Array.isArray(value)) {
        element[key] = value.filter(
          (item) =>
            !ids.has(item?.id) &&
            !ids.has(item?.$ref) &&
            !ids.has(item?.bpmnElement?.$ref),
        );
        for (const child of element[key]) if (child?.$type) clean(child);
      } else if (value?.$ref && ids.has(value.$ref))
        Reflect.deleteProperty(element, key);
      else if (value?.$type) clean(value);
    }
  };
  clean(document.model);
}
