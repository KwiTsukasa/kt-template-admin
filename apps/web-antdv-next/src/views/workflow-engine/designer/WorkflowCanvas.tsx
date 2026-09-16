import type { NodeMetadata } from '@antv/x6';

import type { PropType } from 'vue';

import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowNodeLayout,
  WorkflowNodeRun,
  WorkflowPortSide,
} from '#/api/workflow-engine';

import {
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  toRaw,
  watch,
} from 'vue';

import { cloneDeep } from '@vben/utils';

import {
  Clipboard,
  Dnd,
  Graph,
  History,
  Keyboard,
  MiniMap,
  Selection,
  Snapline,
} from '@antv/x6';

import { loopPortSides, workflowEdgeRouter } from './workflow-edge-routing';
import { arrangeWorkflow, resolveNodeLayout } from './workflow-layout';
import { workflowNodeAttrs, workflowNodeMarkup } from './WorkflowNode';

import './workflow-canvas.scss';

Graph.registerNode(
  'kt-automation-node',
  {
    width: 190,
    height: 76,
    markup: workflowNodeMarkup,
  },
  true,
);
Graph.registerRouter('kt-workflow', workflowEdgeRouter, true);
const edgeConnector = {
  name: 'jumpover',
  args: { type: 'gap', size: 5, radius: 8 },
};
const edgeLine = {
  stroke: 'var(--ant-color-text-tertiary, #64748b)',
  strokeWidth: 1.5,
  targetMarker: { name: 'block', width: 7, height: 6 },
};

/**
 * 从领域节点生成输入输出端口，展示层不增加领域中未声明的分支。
 * @param node - 已有领域节点。
 * @param layout - 节点端口相对于自身的方向。
 * @returns X6 使用的端口定义。
 */
function ports(
  node: WorkflowNode,
  layout: Partial<WorkflowNodeLayout>,
): NodeMetadata['ports'] {
  const items: {
    attrs?: {
      circle?: { fill: string; stroke: string };
      portLabel?: { text: string };
      title?: { text: string };
    };
    group: string;
    id: string;
  }[] = [];
  if (node.type !== 'start')
    items.push({
      id: 'in',
      group: 'input',
      attrs: { title: { text: '进入' } },
    });
  if (node.type === 'loop')
    items.push({
      id: 'repeat',
      group: 'repeat',
      attrs: {
        portLabel: { text: '返回循环' },
        title: { text: '入口：接收本轮循环体的完成连线，再判断是否开始下一轮' },
      },
    });
  if (node.type === 'rule') {
    for (const branch of node.branches) {
      let attrs: (typeof items)[number]['attrs'] = {
        portLabel: { text: String(branch.value) },
      };
      if (typeof branch.value === 'boolean') {
        let color = 'var(--ant-color-error, #ff4d4f)';
        if (branch.value) color = 'var(--ant-color-success, #52c41a)';
        attrs = {
          title: { text: String(branch.value) },
          circle: {
            fill: `color-mix(in srgb, ${color} 20%, transparent)`,
            stroke: color,
          },
        };
      }
      items.push({
        id: branch.port,
        group: 'output',
        attrs,
      });
    }
  } else if (node.type === 'loop') {
    items.push(
      {
        id: 'body',
        group: 'output',
        attrs: {
          portLabel: { text: '执行循环体' },
          title: { text: '出口：每轮从这里进入循环体' },
        },
      },
      {
        id: 'done',
        group: 'done',
        attrs: {
          portLabel: { text: '退出循环' },
          title: { text: '出口：循环完成后从这里继续后续流程' },
        },
      },
    );
  } else if (node.type !== 'end') items.push({ id: 'out', group: 'output' });
  if (node.type === 'loop') {
    const input = items.find((item) => item.id === 'in');
    if (input)
      input.attrs = {
        portLabel: { text: '进入' },
        title: { text: '入口：接收循环外的前置步骤，仅启动第一次循环' },
      };
  }
  const markup = [
    { tagName: 'circle', selector: 'circle' },
    { tagName: 'text', selector: 'portLabel' },
    { tagName: 'title', selector: 'title' },
  ];
  const loopSides = loopPortSides(layout);
  const portText = (side: WorkflowPortSide) => {
    let x = 12;
    let y = -10;
    let textAnchor = 'start';
    if (side === 'left') {
      x = -12;
      textAnchor = 'end';
    }
    if (side === 'bottom') y = 18;
    return {
      x,
      y,
      textAnchor,
      fill: 'var(--ant-color-text-secondary, #475569)',
      fontSize: 11,
      pointerEvents: 'none',
      stroke: 'var(--ant-color-bg-layout, #f5f5f5)',
      strokeWidth: 3,
      paintOrder: 'stroke',
    };
  };
  return {
    groups: {
      input: {
        markup,
        position: layout.inputSide || 'left',
        attrs: {
          circle: {
            r: 5,
            magnet: 'passive',
            stroke: '#94a3b8',
            fill: 'color-mix(in srgb, var(--ant-color-text-secondary, #94a3b8) 20%, transparent)',
          },
          portLabel: portText(layout.inputSide || 'left'),
        },
      },
      output: {
        markup,
        position: layout.outputSide || 'right',
        attrs: {
          circle: {
            r: 5,
            magnet: true,
            stroke: 'var(--ant-color-primary, #2563eb)',
            fill: 'color-mix(in srgb, var(--ant-color-primary, #2563eb) 20%, transparent)',
          },
          portLabel: portText(layout.outputSide || 'right'),
        },
      },
      repeat: {
        markup,
        position: loopSides.repeat,
        attrs: {
          circle: {
            r: 5,
            magnet: 'passive',
            stroke: 'var(--ant-color-text-secondary, #94a3b8)',
            fill: 'color-mix(in srgb, var(--ant-color-text-secondary, #94a3b8) 20%, transparent)',
          },
          portLabel: portText(loopSides.repeat),
        },
      },
      done: {
        markup,
        position: loopSides.done,
        attrs: {
          circle: {
            r: 5,
            magnet: true,
            stroke: 'var(--ant-color-success, #52c41a)',
            fill: 'color-mix(in srgb, var(--ant-color-success, #52c41a) 20%, transparent)',
          },
          portLabel: portText(loopSides.done),
        },
      },
    },
    items,
  };
}

export default defineComponent({
  name: 'AutomationWorkflowCanvas',
  props: {
    definition: {
      type: Object as PropType<WorkflowDefinition>,
      required: true,
    },
    readonly: Boolean,
    nodeStates: {
      type: Array as PropType<WorkflowNodeRun[]>,
      default: () => [],
    },
  },
  emits: {
    change: (_definition: WorkflowDefinition) => true,
    select: (_nodeId: null | string) => true,
  },
  setup(props, { emit, expose }) {
    const container = ref<HTMLElement>();
    const minimap = ref<HTMLElement>();
    let graph: Graph | undefined;
    let dnd: Dnd | undefined;
    let dragNodes: WorkflowNode[] = [];
    let loading = false;
    let emitted = '';
    let direction: 'horizontal' | 'vertical' = 'horizontal';
    let cancelPendingDrag: (() => void) | undefined;

    const presentation = (
      node: WorkflowNode,
      layout: Partial<WorkflowNodeLayout> = {},
    ) => {
      const resolved = resolveNodeLayout(layout, direction);
      return {
        ...resolved,
        shape: 'kt-automation-node',
        presentation: resolved,
        ports: ports(node, resolved),
        attrs: workflowNodeAttrs(node, resolved),
      };
    };

    const sync = () => {
      if (!graph || loading || props.readonly) return;
      for (const node of graph.getNodes())
        node.attr(
          workflowNodeAttrs(
            node.getData<WorkflowNode>(),
            resolveNodeLayout({
              ...node.getProp<WorkflowNodeLayout>('presentation'),
              ...node.size(),
            }),
          ) || {},
        );
      const previous = cloneDeep(props.definition);
      previous.graph.nodes = graph
        .getNodes()
        .map((node) => ({ ...node.getData<WorkflowNode>(), id: node.id }));
      previous.graph.edges = graph.getEdges().flatMap((edge) => {
        const source = edge.getSourceCellId();
        const target = edge.getTargetCellId();
        if (!source || !target) return [];
        return [
          {
            id: edge.id,
            source,
            target,
            sourcePort: edge.getSourcePortId() || '',
            targetPort: edge.getTargetPortId() || '',
          },
        ];
      });
      previous.layout.nodes = Object.fromEntries(
        graph.getNodes().map((node) => [
          node.id,
          {
            ...node.getProp<WorkflowNodeLayout>('presentation'),
            ...node.position(),
            ...node.size(),
          },
        ]),
      );
      previous.layout.direction = direction;
      previous.layout.edges = Object.fromEntries(
        graph.getEdges().map((edge) => [
          edge.id,
          {
            vertices: edge
              .getVertices()
              .map((point) => ({ x: point.x, y: point.y })),
          },
        ]),
      );
      const translation = graph.translate();
      previous.layout.viewport = {
        x: translation.tx,
        y: translation.ty,
        zoom: graph.zoom(),
      };
      emitted = JSON.stringify(previous);
      emit('change', previous);
    };
    const showExecution = () => {
      if (!graph || !props.readonly) return;
      const states = new Map(
        props.nodeStates.map((state) => [state.nodeId, state]),
      );
      for (const node of graph.getNodes()) {
        node.setProp(
          'executionStatus',
          states.get(node.id)?.status || 'pending',
        );
        node.attr(
          workflowNodeAttrs(
            node.getData<WorkflowNode>(),
            resolveNodeLayout(node.getProp('presentation')),
            states.get(node.id)?.status || 'pending',
          ) || {},
        );
      }
      for (const edge of graph.getEdges()) {
        const source = states.get(edge.getSourceCellId());
        let stroke = '#cbd5e1';
        if (
          source?.status === 'succeeded' &&
          source.selectedPorts.includes(edge.getSourcePortId() || '')
        )
          stroke = '#16a34a';
        edge.attr('line/stroke', stroke);
      }
    };
    const load = () => {
      if (!graph) return;
      loading = true;
      const definition = toRaw(props.definition);
      direction = definition.layout.direction || 'horizontal';
      graph.fromJSON({
        nodes: definition.graph.nodes.map((node, index) => {
          let position = { x: 80 + index * 220, y: 160 };
          const savedPosition = definition.layout.nodes[node.id];
          if (savedPosition) position = savedPosition;
          return {
            id: node.id,
            ...presentation(node, position),
            data: cloneDeep(node),
          };
        }),
        edges: definition.graph.edges.map((edge) => ({
          id: edge.id,
          source: { cell: edge.source, port: edge.sourcePort },
          target: { cell: edge.target, port: edge.targetPort },
          router: 'kt-workflow',
          connector: edgeConnector,
          vertices: definition.layout.edges[edge.id]?.vertices || [],
          attrs: { line: edgeLine },
        })),
      });
      graph.zoomTo(definition.layout.viewport.zoom);
      graph.translate(
        definition.layout.viewport.x,
        definition.layout.viewport.y,
      );
      graph.cleanHistory();
      loading = false;
      showExecution();
    };
    const removeSelected = () => {
      if (!graph || props.readonly) return;
      const selected = graph.getSelectedCells().filter((cell) => {
        if (cell.isEdge()) return true;
        const node = cell.getData<WorkflowNode>();
        return node.type !== 'start';
      });
      graph.removeCells(selected);
      emit('select', null);
      sync();
    };
    const copy = () => {
      if (!graph) return;
      graph.copy(
        graph.getSelectedCells().filter((cell) => {
          if (cell.isEdge()) return true;
          const data = cell.getData<WorkflowNode>();
          return data.type !== 'start';
        }),
      );
    };
    const paste = () => {
      if (!graph || props.readonly) return;
      loading = true;
      graph.model.startBatch('paste');
      try {
        const cells = graph.paste({ offset: 32 });
        const identities = new Map(
          cells
            .filter((cell) => cell.isNode())
            .map((cell) => [cell.getData<WorkflowNode>().id, cell.id]),
        );
        for (const cell of cells) {
          if (!cell.isNode()) continue;
          const node = cloneDeep(cell.getData<WorkflowNode>());
          node.id = cell.id;
          if (node.type === 'fork')
            node.joinId = identities.get(node.joinId) || node.joinId;
          if (node.type === 'join')
            node.forkId = identities.get(node.forkId) || node.forkId;
          let bindings = {};
          if (node.type === 'task') bindings = node.input;
          if (node.type === 'business') bindings = node.input;
          if (node.type === 'rule') bindings = node.facts;
          if (node.type === 'loop' && node.condition)
            bindings = node.condition.facts;
          for (const binding of Object.values(
            bindings,
          ) as import('#/api/workflow-engine').ValueBinding[]) {
            if (binding.type === 'node')
              binding.nodeId = identities.get(binding.nodeId) || binding.nodeId;
          }
          if (node.type === 'business')
            for (const script of node.scripts)
              for (const binding of Object.values(script.params))
                if (binding.type === 'node')
                  binding.nodeId =
                    identities.get(binding.nodeId) || binding.nodeId;
          cell.setData(node, { overwrite: true });
        }
        graph.resetSelection(cells);
      } finally {
        graph.model.stopBatch('paste');
        loading = false;
      }
      sync();
    };
    onMounted(() => {
      if (!container.value || !minimap.value) return;
      graph = new Graph({
        container: container.value,
        autoResize: true,
        interacting: () => !props.readonly,
        grid: { visible: true, size: 16 },
        background: { color: 'var(--ant-color-bg-layout, #f4f6fa)' },
        panning: true,
        mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'] },
        scaling: { min: 0.1, max: 4 },
        connecting: {
          allowBlank: false,
          allowLoop: false,
          allowEdge: false,
          allowMulti: 'withPort',
          snap: true,
          validateConnection: ({ sourcePort, targetPort, targetCell }) =>
            !props.readonly &&
            Boolean(
              sourcePort &&
              !['in', 'repeat'].includes(sourcePort) &&
              (targetPort === 'in' ||
                (targetPort === 'repeat' &&
                  targetCell?.getData<WorkflowNode>().type === 'loop')),
            ),
          createEdge: () => {
            if (!graph) throw new Error('画布尚未初始化');
            return graph.createEdge({
              id: `edge_${crypto.randomUUID()}`,
              router: 'kt-workflow',
              connector: edgeConnector,
              attrs: { line: edgeLine },
            });
          },
        },
      });
      graph
        .use(
          new History({
            enabled: !props.readonly,
            beforeAddCommand: (event) => event !== 'cell:change:attrs',
          }),
        )
        .use(
          new Clipboard({ enabled: !props.readonly, useLocalStorage: false }),
        )
        .use(new Keyboard({ enabled: !props.readonly }))
        .use(
          new Selection({
            enabled: true,
            rubberband: true,
            showNodeSelectionBox: false,
            showEdgeSelectionBox: false,
          }),
        )
        .use(new Snapline({ enabled: !props.readonly }))
        .use(
          new MiniMap({ container: minimap.value, width: 160, height: 100 }),
        );
      dnd = new Dnd({
        target: graph,
        scaled: true,
        getDragNode: (node) => node.clone({ keepId: true }),
        getDropNode: (_node, { sourceNode }) =>
          sourceNode.clone({ keepId: true }),
        validateNode: () => !props.readonly,
      });
      graph.on('node:added', ({ node, options }) => {
        if (!options.stencil || !graph || dragNodes[0]?.id !== node.id) return;
        const origin = node.position();
        for (const [index, companion] of dragNodes.slice(1).entries())
          graph.addNode({
            id: companion.id,
            ...presentation(companion, {
              x: origin.x + (index + 1) * 260,
              y: origin.y,
            }),
            data: cloneDeep(companion),
          });
        dragNodes = [];
        graph.resetSelection([node]);
        sync();
      });
      graph.on('selection:changed', ({ selected }) => {
        if (!props.readonly)
          for (const edge of graph?.getEdges() || []) {
            edge.removeTools();
            if (selected.some((cell) => cell.id === edge.id))
              edge.addTools([
                {
                  name: 'source-arrowhead',
                  args: {
                    attrs: {
                      fill: '#6366f1',
                      stroke: '#fff',
                      'stroke-width': 2,
                    },
                  },
                },
                {
                  name: 'target-arrowhead',
                  args: {
                    attrs: {
                      fill: '#6366f1',
                      stroke: '#fff',
                      'stroke-width': 2,
                    },
                  },
                },
              ]);
          }
        const nodes = selected.filter((cell) => cell.isNode());
        const selectedNode = nodes[0];
        if (nodes.length === 1 && selectedNode) emit('select', selectedNode.id);
        else emit('select', null);
      });
      for (const event of [
        'cell:added',
        'cell:removed',
        'cell:change:data',
        'node:change:position',
        'node:change:size',
        'cell:change:presentation',
        'edge:connected',
        'edge:change:vertices',
        'history:undo',
        'history:redo',
        'translate',
        'scale',
      ])
        graph.on(event, sync);
      graph.bindKey(['backspace', 'delete'], () => {
        removeSelected();
        return false;
      });
      graph.bindKey(['ctrl+z', 'meta+z'], () => {
        graph?.undo();
        return false;
      });
      graph.bindKey(['ctrl+shift+z', 'meta+shift+z'], () => {
        graph?.redo();
        return false;
      });
      graph.bindKey(['ctrl+c', 'meta+c'], () => {
        copy();
        return false;
      });
      graph.bindKey(['ctrl+v', 'meta+v'], () => {
        paste();
        return false;
      });
      load();
    });
    watch(
      () => props.definition,
      (definition) => {
        if (JSON.stringify(definition) !== emitted) load();
      },
    );
    watch(() => props.nodeStates, showExecution, { deep: true });
    onBeforeUnmount(() => {
      cancelPendingDrag?.();
      dnd?.dispose();
      graph?.dispose();
      graph = undefined;
    });
    const updateLayouts = (
      layouts: Record<string, Partial<WorkflowNodeLayout>>,
    ) => {
      if (!graph || props.readonly) return;
      loading = true;
      graph.model.startBatch('layout');
      try {
        for (const [id, changes] of Object.entries(layouts)) {
          const cell = graph.getCellById(id);
          if (!cell?.isNode()) continue;
          const layout = resolveNodeLayout(
            {
              ...cell.getProp<WorkflowNodeLayout>('presentation'),
              ...cell.position(),
              ...cell.size(),
              ...changes,
            },
            direction,
          );
          cell.setProp('presentation', layout);
          cell.position(layout.x, layout.y);
          cell.resize(layout.width, layout.height);
          cell.setProp('ports', ports(cell.getData<WorkflowNode>(), layout));
          cell.attr(
            workflowNodeAttrs(cell.getData<WorkflowNode>(), layout) || {},
          );
        }
      } finally {
        graph.model.stopBatch('layout');
        loading = false;
      }
      sync();
    };
    expose({
      updateLayout: (id: string, changes: Partial<WorkflowNodeLayout>) =>
        updateLayouts({ [id]: changes }),
      arrange: (value: 'horizontal' | 'vertical') => {
        if (!graph || props.readonly) return;
        direction = value;
        updateLayouts(
          arrangeWorkflow(
            props.definition.graph,
            props.definition.layout.nodes,
            value,
          ),
        );
        graph.zoomToFit({ padding: 64, maxScale: 1 });
      },
      startDrag: (nodes: WorkflowNode[], event: MouseEvent) => {
        const node = nodes[0];
        if (!graph || !dnd || !node || props.readonly || event.button !== 0)
          return;
        cancelPendingDrag?.();
        const origin = { x: event.clientX, y: event.clientY };
        const cleanup = () => {
          document.removeEventListener('mousemove', begin);
          document.removeEventListener('mouseup', cleanup);
          cancelPendingDrag = undefined;
        };
        const begin = (move: MouseEvent) => {
          if (Math.hypot(move.clientX - origin.x, move.clientY - origin.y) < 6)
            return;
          cleanup();
          if (!graph || !dnd) return;
          dragNodes = cloneDeep(nodes);
          dnd.start(
            graph.createNode({
              id: node.id,
              ...presentation(node),
              data: cloneDeep(node),
            }),
            move,
          );
        };
        document.addEventListener('mousemove', begin);
        document.addEventListener('mouseup', cleanup);
        cancelPendingDrag = cleanup;
      },
      addNode: (node: WorkflowNode) => {
        if (!graph) return;
        graph.addNode({
          id: node.id,
          ...presentation(node, {
            x: 150 + graph.getNodes().length * 20,
            y: 100 + graph.getNodes().length * 15,
          }),
          data: cloneDeep(node),
        });
      },
      updateNode: (node: WorkflowNode) => {
        const cell = graph?.getCellById(node.id);
        if (!graph || !cell?.isNode()) return;
        loading = true;
        graph.model.startBatch('update');
        try {
          cell.setData(cloneDeep(node), { overwrite: true });
          cell.attr(
            workflowNodeAttrs(
              node,
              resolveNodeLayout(cell.getProp('presentation')),
            ) || {},
          );
          cell.setProp(
            'ports',
            ports(node, cell.getProp<WorkflowNodeLayout>('presentation') || {}),
          );
        } finally {
          graph.model.stopBatch('update');
          loading = false;
        }
        sync();
      },
      focus: (id: string) => {
        const cell = graph?.getCellById(id);
        if (!cell || !graph) return;
        graph.resetSelection([cell]);
        graph.centerCell(cell);
        if (cell.isNode()) emit('select', cell.id);
      },
      undo: () => graph?.undo(),
      redo: () => graph?.redo(),
      fit: () => graph?.zoomToFit({ padding: 40, maxScale: 1 }),
      removeSelected,
      copy,
      paste,
    });
    return () => (
      <div class="automation-workflow-canvas">
        <div class="automation-workflow-canvas__surface" ref={container} />
        <div class="automation-workflow-canvas__minimap" ref={minimap} />
      </div>
    );
  },
});
