import type { Cell, EdgeView, Node, NodeMetadata } from '@antv/x6';

import type { PropType } from 'vue';

import type { WorkflowNodeRun } from '#/api/workflow-engine';
import type { BpmnDefinition, BpmnElement } from '#/api/workflow-engine/bpmn';

import { defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { cloneDeep } from '@vben/utils';

import { Dnd, Graph, Selection, Snapline } from '@antv/x6';

import { arrangeBpmnScope } from './bpmn-layout';
import {
  bpmnId,
  bpmnPlane,
  bpmnProcess,
  hasBpmnCondition,
  indexBpmn,
  setBpmnBounds,
  setBpmnWaypoints,
} from './bpmn-model';
import {
  addBpmnLane,
  addBpmnPool,
  assignBpmnLane,
  attachBpmnBoundary,
  bpmnBounds,
  bpmnConnectionType,
  bpmnVisibleElements,
  moveBpmnElement,
} from './bpmn-structure';

import './workflow-canvas.scss';

const ink = 'var(--ant-color-text-secondary, #64748b)';
const surface = 'var(--ant-color-bg-container, #fff)';
type SvgAttrs = NonNullable<NonNullable<NodeMetadata['attrs']>[string]>;

/**
 * 按标准事件、活动和网关生成 SVG 图形，选中只改变一层描边。
 * @param element - 标准流程元素。
 * @param bounds - 标准 DI 中的坐标和尺寸。
 * @returns X6 原生 SVG 节点数据，模型身份保持不变。
 */
function nodeMetadata(
  element: BpmnElement,
  bounds?: Record<string, number>,
): NodeMetadata {
  const event = element.$type.endsWith('Event');
  const gateway = element.$type.endsWith('Gateway');
  const container = ['bpmn:Lane', 'bpmn:Participant'].includes(element.$type);
  let height = 76;
  let width = 160;
  if (container) {
    width = 920;
    height = 240;
  }
  if (event) {
    width = 40;
    height = 40;
  }
  if (gateway) {
    width = 56;
    height = 56;
  }
  width = bounds?.width ?? width;
  height = bounds?.height ?? height;
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
  if (element.$type === 'bpmn:EndEvent') body.strokeWidth = 3.5;
  if (
    element.$type === 'bpmn:BoundaryEvent' &&
    element.cancelActivity === false
  )
    body.strokeDasharray = '4 3';
  const attrs: NonNullable<NodeMetadata['attrs']> & {
    body: SvgAttrs;
    label: SvgAttrs;
    marker: SvgAttrs;
  } = {
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
  const markup: any[] = [
    { tagName, selector: 'body' },
    { tagName: 'path', selector: 'marker' },
    { tagName: 'text', selector: 'label' },
  ];
  const centerX = width / 2;
  const centerY = height / 2;
  if (container) {
    Object.assign(body, { rx: 0, ry: 0, fill: 'transparent', strokeWidth: 1 });
    Object.assign(attrs.label, {
      x: 15,
      y: centerY,
      textWrap: { width: height - 20, height: 24, ellipsis: true },
      transform: `rotate(-90,15,${centerY})`,
    });
    if (element.$type === 'bpmn:Participant' && !element.processRef)
      Object.assign(attrs.label, {
        x: centerX,
        y: centerY,
        textWrap: { width: width - 20, height: 24, ellipsis: true },
        transform: '',
      });
    else attrs.marker.d = `M30,0 V${height}`;
  } else if (event || gateway) {
    Object.assign(attrs.label, {
      y: height + 18,
      textWrap: { width: 145, height: 40, ellipsis: true },
    });
    const definition = element.eventDefinitions?.[0]?.$type;
    if (
      element.$type === 'bpmn:IntermediateCatchEvent' ||
      element.$type === 'bpmn:IntermediateThrowEvent' ||
      element.$type === 'bpmn:BoundaryEvent'
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
        element.$type === 'bpmn:BoundaryEvent' &&
        element.cancelActivity === false
      )
        attrs.ring.strokeDasharray = '4 3';
    }
    if (definition === 'bpmn:TerminateEventDefinition') {
      markup.push({ tagName: 'circle', selector: 'terminate' });
      attrs.terminate = {
        cx: centerX,
        cy: centerY,
        r: width / 4,
        fill: ink,
        stroke: 'none',
      };
    }
    if (definition === 'bpmn:ErrorEventDefinition')
      attrs.marker.d = `M${centerX - 6},${centerY - 9} l4,6 7,-3 -5,15 -3,-7 -7,2 z`;
    if (definition === 'bpmn:CancelEventDefinition')
      attrs.marker.d = `M${centerX - 7},${centerY - 7} l14,14 m0,-14 l-14,14`;
    if (definition === 'bpmn:TimerEventDefinition') {
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
    if (definition === 'bpmn:MessageEventDefinition')
      attrs.marker.d = `M${centerX - 9},${centerY - 6} h18 v12 h-18 z m0,0 l9,6 9,-6`;
    if (definition === 'bpmn:SignalEventDefinition')
      attrs.marker.d = `M${centerX},${centerY - 10} l10,18 h-20 z`;
    if (definition === 'bpmn:CompensateEventDefinition')
      attrs.marker.d = `M${centerX},${centerY - 7} l-8,7 8,7 z m8,0 l-8,-7 8,-7 z`;
    if (element.$type === 'bpmn:ExclusiveGateway')
      attrs.marker.d = `M${centerX - 8},${centerY - 8} l16,16 m0,-16 l-16,16`;
    if (element.$type === 'bpmn:ParallelGateway')
      attrs.marker.d = `M${centerX - 10},${centerY} h20 m-10,-10 v20`;
    if (element.$type === 'bpmn:InclusiveGateway') {
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
  } else {
    if (element.$type === 'bpmn:UserTask')
      attrs.marker.d =
        'M19,9 a4,4 0 1 0 0,8 a4,4 0 1 0 0,-8 m-8,17 v-3 q8,-9 16,0 v3';
    if (element.$type === 'bpmn:Transaction') {
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
    if (element.$type === 'bpmn:BusinessRuleTask')
      attrs.marker.d = 'M10,10 h18 v14 h-18 z m0,5 h18 m-12,-5 v14';
    if (element.$type === 'bpmn:ServiceTask')
      attrs.marker.d =
        'M12,11 h14 v14 h-14 z m7,-4 v4 m0,14 v4 m-11,-11 h4 m14,0 h4';
    if (
      element.$type === 'bpmn:SubProcess' ||
      element.$type === 'bpmn:Transaction'
    )
      attrs.marker.d = `M${centerX - 6},${height - 17} h12 v12 h-12 z m6,2 v8 m-4,-4 h8`;
    if (
      element.loopCharacteristics?.$type === 'bpmn:StandardLoopCharacteristics'
    )
      attrs.marker.d = `M${centerX + 7},${height - 12} a7,7 0 1 1 -3,-6 m-3,-2 l4,2 -2,4`;
    if (
      element.loopCharacteristics?.$type ===
      'bpmn:MultiInstanceLoopCharacteristics'
    ) {
      attrs.marker.d = `M${centerX - 5},${height - 17} v12 m5,-12 v12 m5,-12 v12`;
      if (element.loopCharacteristics.isSequential)
        attrs.marker.d = `M${centerX - 6},${height - 16} h12 m-12,4 h12 m-12,4 h12`;
    }
  }
  const groups: Record<string, any> = {};
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
  if (element.$type === 'bpmn:Lane') items.length = 0;
  let zIndex = 1;
  if (element.$type === 'bpmn:Participant') zIndex = -3;
  if (element.$type === 'bpmn:Lane') zIndex = -2;
  if (element.$type === 'bpmn:BoundaryEvent') zIndex = 2;
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

export default defineComponent({
  name: 'BpmnWorkflowCanvas',
  props: {
    definition: { type: Object as PropType<BpmnDefinition>, required: true },
    nodeStates: {
      type: Array as PropType<Pick<WorkflowNodeRun, 'nodeId' | 'status'>[]>,
      default: () => [],
    },
    scopeId: { type: String, default: '' },
    readonly: Boolean,
    selectedId: { type: String, default: '' },
  },
  emits: {
    error: (_message: string) => true,
    change: (_definition: BpmnDefinition) => true,
    select: (_id: string) => true,
    openScope: (_id: string) => true,
  },
  setup(props, { emit, expose }) {
    const host = ref<HTMLElement>();
    let dnd: Dnd | undefined;
    let graph: Graph | undefined;
    let rendering = false;
    let suppressClickUntil = 0;
    let stopDragTracking = () => {};
    const copy = () => {
      const definition = cloneDeep(props.definition) as BpmnDefinition;
      const elements = bpmnVisibleElements(definition, props.scopeId).filter(
        (element) =>
          /(?:Task|Activity|Event|Gateway|SubProcess|Transaction)$/.test(
            element.$type,
          ),
      );
      if (
        elements.length > 0 &&
        elements.every((element) => !bpmnBounds(definition, element.id))
      )
        arrangeBpmnScope(definition, props.scopeId, false);
      return definition;
    };
    const scope = (definition: BpmnDefinition) =>
      indexBpmn(definition).get(props.scopeId)?.element ??
      bpmnProcess(definition);
    const update = (change: (definition: BpmnDefinition) => void) => {
      const definition = copy();
      change(definition);
      emit('change', definition);
    };
    const render = () => {
      if (!graph) return;
      rendering = true;
      const definition = copy();
      const current = scope(definition);
      const shapes: BpmnElement[] = bpmnPlane(definition).planeElement ?? [];
      const cells: Cell[] = [];
      const nodes = new Map<string, Node>();
      const visible = bpmnVisibleElements(definition, props.scopeId);
      const containers = visible
        .filter((element) =>
          ['bpmn:Lane', 'bpmn:Participant'].includes(element.$type),
        )
        .map((element) => element.id ?? '');
      for (const element of visible) {
        if (
          !/(?:Task|Activity|Event|Gateway|Process|Transaction|Participant|Lane)$/.test(
            element.$type,
          )
        )
          continue;
        const shape = shapes.find(
          (item) => item.bpmnElement?.$ref === element.id,
        );
        const node = graph.createNode(nodeMetadata(element, shape?.bounds));
        cells.push(node);
        nodes.set(node.id, node);
        const state = props.nodeStates.find(
          (item) => item.nodeId === element.id,
        );
        const colors: Record<string, string> = {
          succeeded: 'var(--ant-color-success)',
          failed: 'var(--ant-color-error)',
          waiting: 'var(--ant-color-primary)',
          cancelled: 'var(--ant-color-text-disabled)',
        };
        if (state && colors[state.status]) {
          node.attr('body/stroke', colors[state.status]);
          node.setData({
            ...node.getData(),
            statusColor: colors[state.status],
          });
        }
      }
      for (const element of visible) {
        if (
          ![
            'bpmn:Association',
            'bpmn:MessageFlow',
            'bpmn:SequenceFlow',
          ].includes(element.$type)
        )
          continue;
        const sourceNode = nodes.get(element.sourceRef.$ref);
        const targetNode = nodes.get(element.targetRef.$ref);
        if (!sourceNode || !targetNode) continue;
        const shape = shapes.find(
          (item) => item.bpmnElement?.$ref === element.id,
        );
        const points = shape?.waypoint ?? [];
        const side = (cell: any, point: any, fallback: string) => {
          if (!point) return fallback;
          const box = cell.getBBox();
          return [
            ['left', Math.abs(point.x - box.x)],
            ['right', Math.abs(point.x - box.right)],
            ['top', Math.abs(point.y - box.y)],
            ['bottom', Math.abs(point.y - box.bottom)],
          ].toSorted((a, b) => Number(a[1]) - Number(b[1]))[0]?.[0] as string;
        };
        const sourceBounds = sourceNode.getBBox();
        const targetBounds = targetNode.getBBox();
        let sourceSide = 'right';
        let targetSide = 'left';
        if (
          Math.abs(targetBounds.center.y - sourceBounds.center.y) >
          Math.abs(targetBounds.center.x - sourceBounds.center.x)
        ) {
          sourceSide = 'bottom';
          targetSide = 'top';
          if (targetBounds.center.y < sourceBounds.center.y) {
            sourceSide = 'right';
            targetSide = 'right';
          }
        } else if (targetBounds.center.x < sourceBounds.center.x) {
          sourceSide = 'bottom';
          targetSide = 'bottom';
        }
        if (
          element.$type === 'bpmn:MessageFlow' &&
          targetBounds.y > sourceBounds.bottom
        ) {
          sourceSide = 'bottom';
          targetSide = 'top';
        }
        if (
          element.$type === 'bpmn:MessageFlow' &&
          sourceBounds.y > targetBounds.bottom
        ) {
          sourceSide = 'top';
          targetSide = 'bottom';
        }
        sourceSide = side(sourceNode, points[0], sourceSide);
        targetSide = side(targetNode, points.at(-1), targetSide);
        for (const [node, direction] of [
          [sourceNode, sourceSide],
          [targetNode, targetSide],
        ] as const) {
          if (
            node.getData()?.bpmnType.endsWith('Event') &&
            ['bottom', 'top'].includes(direction)
          )
            node.attr('label', {
              x: node.size().width + 12,
              y: node.size().height / 2,
              textAnchor: 'start',
              textWrap: { width: 145, height: 40, ellipsis: true },
            });
        }
        const sourceElement = indexBpmn(definition).get(
          element.sourceRef.$ref,
        )?.element;
        if (sourceElement?.$type === 'bpmn:ExclusiveGateway') {
          let color = ink;
          if (hasBpmnCondition(element)) color = 'var(--ant-color-success)';
          if (
            sourceElement.default?.$ref === element.id &&
            (current.flowElements ?? []).some(
              (flow: BpmnElement) =>
                flow.sourceRef?.$ref === sourceElement.id &&
                flow.id !== element.id &&
                hasBpmnCondition(flow),
            )
          )
            color = 'var(--ant-color-error)';
          sourceNode.portProp(sourceSide, 'attrs/circle/stroke', color);
          if (color !== ink)
            sourceNode.portProp(
              sourceSide,
              'attrs/circle/class',
              'x6-port-body bpmn-condition-port',
            );
          sourceNode.portProp(
            sourceSide,
            'attrs/circle/fill',
            `color-mix(in srgb, ${color} 20%, transparent)`,
          );
        }
        const line: Record<string, any> = {
          stroke: ink,
          strokeWidth: 1.4,
          targetMarker: { name: 'block', width: 7, height: 6 },
        };
        if (element.$type === 'bpmn:MessageFlow')
          Object.assign(line, {
            strokeDasharray: '6 4',
            sourceMarker: { name: 'circle', r: 3, fill: surface },
            targetMarker: { name: 'block', width: 8, height: 7, fill: surface },
          });
        if (element.$type === 'bpmn:Association')
          Object.assign(line, {
            strokeDasharray: '2 4',
            targetMarker: {
              name: 'classic',
              width: 8,
              height: 7,
              fill: surface,
            },
          });
        cells.push(
          graph.createEdge({
            id: element.id,
            source: { cell: element.sourceRef.$ref, port: sourceSide },
            target: { cell: element.targetRef.$ref, port: targetSide },
            vertices: points
              .slice(1, -1)
              .map((point: any) => ({ x: point.x, y: point.y })),
            router: {
              name: 'manhattan',
              args: {
                padding: 12,
                perpendicular: false,
                startDirections: [sourceSide],
                endDirections: [targetSide],
                maxLoopCount: 4000,
                excludeNodes: containers,
              },
            },
            connector: {
              name: 'jumpover',
              args: { type: 'gap', radius: 8, size: 5 },
            },
            attrs: { line },
          }),
        );
      }
      graph.resetCells(cells);
      const selected = graph.getCellById(props.selectedId);
      if (selected) graph.select(selected);
      rendering = false;
    };
    const add = (element: BpmnElement, position?: { x: number; y: number }) =>
      update((definition) => {
        if (!element.id || props.readonly) return;
        if (element.$type === 'bpmn:Participant') {
          if (props.scopeId) return;
          addBpmnPool(definition, position);
          return;
        }
        if (element.$type === 'bpmn:Lane') {
          addBpmnLane(definition, props.scopeId);
          return;
        }
        const current = scope(definition);
        let hostId: string | undefined;
        if (element.$type === 'bpmn:BoundaryEvent') {
          const activities = (current.flowElements ?? []).filter(
            (item: BpmnElement) =>
              /(?:Task|Activity|SubProcess|Transaction)$/.test(item.$type),
          );
          if (position)
            hostId = activities.find((item: BpmnElement) => {
              const box = bpmnBounds(definition, item.id);
              return (
                box &&
                position.x + 20 >= box.x - 20 &&
                position.x + 20 <= box.x + box.width + 20 &&
                position.y + 20 >= box.y - 20 &&
                position.y + 20 <= box.y + box.height + 20
              );
            })?.id;
          else
            hostId = activities.find(
              (item: BpmnElement) => item.id === props.selectedId,
            )?.id;
          if (!hostId) {
            emit('error', '请选中活动，或将边界事件拖到活动边缘');
            render();
            return;
          }
        }
        scope(definition).flowElements ??= [];
        scope(definition).flowElements.push(element);
        const metadata = nodeMetadata(element);
        const offset = (graph?.getNodes().length ?? 0) * 24;
        const bounds = host.value?.getBoundingClientRect();
        let fallback = { x: 100 + offset, y: 100 + offset };
        if (bounds && graph)
          fallback = graph.clientToLocal(
            bounds.left + 160 + offset,
            bounds.top + 120 + offset,
          );
        setBpmnBounds(definition, element.id ?? '', {
          ...(position ?? fallback),
          width: metadata.width ?? 160,
          height: metadata.height ?? 76,
        });
        if (hostId) attachBpmnBoundary(definition, element.id, hostId);
        else assignBpmnLane(definition, element.id);
      });
    onMounted(() => {
      if (!host.value) return;
      graph = new Graph({
        container: host.value,
        async: false,
        autoResize: true,
        background: { color: 'transparent' },
        grid: { visible: true, size: 16 },
        panning: true,
        mousewheel: {
          enabled: true,
          modifiers: ['ctrl', 'meta'],
          minScale: 0.2,
          maxScale: 2,
        },
        interacting: !props.readonly,
        connecting: {
          allowBlank: false,
          allowLoop: false,
          allowEdge: false,
          snap: { radius: 16 },
          highlight: false,
          createEdge: () => {
            if (!graph) throw new Error('画布尚未初始化');
            return graph.createEdge({
              id: bpmnId('Flow'),
              router: { name: 'manhattan', args: { padding: 26 } },
              connector: { name: 'rounded', args: { radius: 8 } },
              attrs: {
                line: { stroke: ink, strokeWidth: 1.4, targetMarker: 'block' },
              },
            });
          },
          validateConnection: ({ sourceCell, targetCell }) => {
            if (!sourceCell || !targetCell || sourceCell === targetCell)
              return false;
            return !!bpmnConnectionType(
              props.definition,
              sourceCell.id,
              targetCell.id,
            );
          },
        },
      });
      graph.use(
        new Selection({
          enabled: true,
          multiple: false,
          rubberband: false,
          showNodeSelectionBox: false,
          showEdgeSelectionBox: false,
        }),
      );
      graph.use(new Snapline({ enabled: true }));
      dnd = new Dnd({
        target: graph,
        getDragNode: (node) => node.clone({ keepId: true }),
        getDropNode: (node) => node.clone({ keepId: true }),
      });
      graph.on('node:added', ({ node, options }) => {
        if (rendering || !options.stencil || !node.getData()?.pendingElement)
          return;
        add(node.getData().pendingElement, node.position());
      });
      graph.on('node:moved', ({ node }) => {
        if (rendering || props.readonly) return;
        update((definition) => {
          const element = indexBpmn(definition).get(node.id)?.element;
          if (element?.attachedToRef)
            attachBpmnBoundary(definition, node.id, element.attachedToRef.$ref);
          else moveBpmnElement(definition, node.id, node.position());
        });
      });
      graph.on('cell:selected', ({ cell }) => {
        if (cell.isNode()) cell.attr('body/stroke', 'var(--ant-color-primary)');
        if (!rendering) emit('select', cell.id);
      });
      graph.on('cell:unselected', ({ cell }) => {
        if (cell.isNode())
          cell.attr('body/stroke', cell.getData()?.statusColor ?? ink);
      });
      graph.on('blank:click', () => emit('select', ''));
      graph.on('node:dblclick', ({ node }) => {
        if (
          ['bpmn:SubProcess', 'bpmn:Transaction'].includes(
            node.getData()?.bpmnType,
          )
        )
          emit('openScope', node.id);
      });
      graph.on('edge:selected', ({ edge }) => {
        if (!props.readonly)
          edge.addTools([
            { name: 'source-arrowhead' },
            { name: 'target-arrowhead' },
            { name: 'vertices' },
          ]);
      });
      graph.on('edge:unselected', ({ edge }) => edge.removeTools());
      graph.on('edge:connected', ({ edge }) => {
        if (
          rendering ||
          props.readonly ||
          !edge.getSourceCellId() ||
          !edge.getTargetCellId()
        )
          return;
        update((definition) => {
          const current = scope(definition);
          const index = indexBpmn(definition);
          let flow = index.get(edge.id)?.element;
          const kind = bpmnConnectionType(
            definition,
            edge.getSourceCellId() ?? '',
            edge.getTargetCellId() ?? '',
          );
          if (!kind) return;
          const previousSource = index.get(flow?.sourceRef?.$ref)?.element;
          if (
            previousSource?.default?.$ref === edge.id &&
            previousSource.id !== edge.getSourceCellId()
          )
            delete previousSource.default;
          if (!flow || flow.$type !== kind) {
            if (flow) {
              const parent = index.get(edge.id)?.parent;
              for (const key of ['flowElements', 'messageFlows', 'artifacts'])
                if (parent?.[key])
                  parent[key] = parent[key].filter(
                    (item: BpmnElement) => item.id !== edge.id,
                  );
            }
            flow = { $type: kind, id: edge.id };
            if (kind === 'bpmn:MessageFlow') {
              const collaboration = definition.model.rootElements.find(
                (item: BpmnElement) => item.$type === 'bpmn:Collaboration',
              );
              (collaboration.messageFlows ??= []).push(flow);
            } else if (kind === 'bpmn:Association') {
              flow.associationDirection = 'One';
              (current.artifacts ??= []).push(flow);
            } else current.flowElements.push(flow);
          }
          flow.sourceRef = { $ref: edge.getSourceCellId() };
          flow.targetRef = { $ref: edge.getTargetCellId() };
          setBpmnWaypoints(
            definition,
            edge.id,
            [
              edge.getSourcePoint(),
              ...edge.getVertices(),
              edge.getTargetPoint(),
            ].map(({ x, y }) => ({ x, y })),
          );
        });
      });
      graph.on('edge:change:vertices', ({ edge, options }) => {
        if (!rendering && options.ui && !props.readonly)
          update((definition) =>
            setBpmnWaypoints(
              definition,
              edge.id,
              [
                edge.getSourcePoint(),
                ...edge.getVertices(),
                edge.getTargetPoint(),
              ].map(({ x, y }) => ({ x, y })),
            ),
          );
      });
      render();
      graph.zoomToFit({ padding: 50, maxScale: 1 });
    });
    watch(() => [props.definition, props.scopeId, props.nodeStates], render, {
      deep: true,
    });
    watch(
      () => props.selectedId,
      () => {
        graph?.cleanSelection();
        const cell = graph?.getCellById(props.selectedId);
        if (cell) graph?.select(cell);
      },
    );
    onBeforeUnmount(() => {
      stopDragTracking();
      dnd?.dispose();
      graph?.dispose();
    });
    expose({
      snapshot: () => {
        const definition = copy();
        for (const edge of graph?.getEdges() ?? []) {
          const view = graph?.findViewByCell(edge) as EdgeView | undefined;
          if (!view?.sourcePoint || !view.targetPoint) continue;
          setBpmnWaypoints(
            definition,
            edge.id,
            [view.sourcePoint, ...view.routePoints, view.targetPoint].map(
              ({ x, y }) => ({ x, y }),
            ),
          );
        }
        return definition;
      },
      add: (element: BpmnElement) => {
        if (Date.now() >= suppressClickUntil) add(element);
      },
      fit: () => graph?.zoomToFit({ padding: 50, maxScale: 1 }),
      focus: (id: string) => {
        const node = graph?.getCellById(id);
        if (node) {
          graph?.select(node);
          graph?.centerCell(node);
        }
      },
      startDrag: (element: BpmnElement, event: MouseEvent) => {
        if (props.readonly) return;
        stopDragTracking();
        const move = (next: MouseEvent) => {
          if (
            Math.hypot(
              next.clientX - event.clientX,
              next.clientY - event.clientY,
            ) < 5
          )
            return;
          stopDragTracking();
          suppressClickUntil = Date.now() + 500;
          const node = graph?.createNode({
            ...nodeMetadata(element),
            data: { pendingElement: element },
          });
          if (node) dnd?.start(node, next);
        };
        const up = () => {
          stopDragTracking();
        };
        stopDragTracking = () => {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up, { once: true });
      },
    });
    return () => (
      <div
        class="automation-workflow-canvas automation-bpmn-canvas h-full min-h-0 w-full"
        ref={host}
      />
    );
  },
});
