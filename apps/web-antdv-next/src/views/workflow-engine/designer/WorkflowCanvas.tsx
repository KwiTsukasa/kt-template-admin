import type { NodeMetadata } from '@antv/x6';

import type { PropType } from 'vue';

import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowNodeRun,
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
  Graph,
  History,
  Keyboard,
  MiniMap,
  Selection,
  Snapline,
} from '@antv/x6';
import { getTeleport, register } from '@antv/x6-vue-shape';

import WorkflowNodeView from './WorkflowNode';

import './workflow-canvas.scss';

register({
  shape: 'kt-automation-node',
  width: 190,
  height: 76,
  component: WorkflowNodeView,
});
const TeleportContainer = getTeleport();

/**
 * 从领域节点生成输入输出端口，展示层不增加领域中未声明的分支。
 * @param node - 已有领域节点。
 * @returns X6 使用的端口定义。
 */
function ports(node: WorkflowNode): NodeMetadata['ports'] {
  const items: {
    attrs?: { text: { text: string } };
    group: string;
    id: string;
  }[] = [];
  if (node.type !== 'start') items.push({ id: 'in', group: 'input' });
  if (node.type === 'rule')
    for (const branch of node.branches)
      items.push({
        id: branch.port,
        group: 'output',
        attrs: { text: { text: String(branch.value) } },
      });
  else if (node.type !== 'end') items.push({ id: 'out', group: 'output' });
  return {
    groups: {
      input: {
        position: 'left',
        attrs: {
          circle: { r: 5, magnet: 'passive', stroke: '#64748b', fill: '#fff' },
        },
      },
      output: {
        position: 'right',
        attrs: {
          circle: { r: 5, magnet: true, stroke: '#2563eb', fill: '#fff' },
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
    let loading = false;
    let emitted = '';

    const sync = () => {
      if (!graph || loading || props.readonly) return;
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
        graph.getNodes().map((node) => [node.id, node.position()]),
      );
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
      for (const node of graph.getNodes())
        node.setProp(
          'executionStatus',
          states.get(node.id)?.status || 'pending',
        );
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
      graph.fromJSON({
        nodes: definition.graph.nodes.map((node, index) => {
          let position = { x: 80 + index * 220, y: 160 };
          const savedPosition = definition.layout.nodes[node.id];
          if (savedPosition) position = savedPosition;
          return {
            id: node.id,
            shape: 'kt-automation-node',
            ...position,
            data: cloneDeep(node),
            ports: ports(node),
          };
        }),
        edges: definition.graph.edges.map((edge) => ({
          id: edge.id,
          source: { cell: edge.source, port: edge.sourcePort },
          target: { cell: edge.target, port: edge.targetPort },
          router: 'manhattan',
          connector: 'rounded',
          vertices: definition.layout.edges[edge.id]?.vertices || [],
          attrs: { line: { stroke: '#64748b', targetMarker: 'block' } },
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
        return node.type !== 'start' && node.type !== 'end';
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
          return data.type !== 'start' && data.type !== 'end';
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
          if (node.type === 'rule') bindings = node.facts;
          for (const binding of Object.values(
            bindings,
          ) as import('#/api/workflow-engine').ValueBinding[]) {
            if (binding.type === 'node')
              binding.nodeId = identities.get(binding.nodeId) || binding.nodeId;
          }
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
          validateConnection: ({ sourcePort, targetPort }) =>
            !props.readonly &&
            Boolean(sourcePort && sourcePort !== 'in' && targetPort === 'in'),
          createEdge: () => {
            if (!graph) throw new Error('画布尚未初始化');
            return graph.createEdge({
              id: `edge_${crypto.randomUUID()}`,
              router: 'manhattan',
              connector: 'rounded',
              attrs: { line: { stroke: '#64748b', targetMarker: 'block' } },
            });
          },
        },
      });
      graph
        .use(new History({ enabled: !props.readonly }))
        .use(
          new Clipboard({ enabled: !props.readonly, useLocalStorage: false }),
        )
        .use(new Keyboard({ enabled: !props.readonly }))
        .use(
          new Selection({
            enabled: true,
            rubberband: true,
            showNodeSelectionBox: true,
          }),
        )
        .use(new Snapline({ enabled: !props.readonly }))
        .use(
          new MiniMap({ container: minimap.value, width: 160, height: 100 }),
        );
      graph.on('selection:changed', ({ selected }) => {
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
      graph?.dispose();
      graph = undefined;
    });
    expose({
      addNode: (node: WorkflowNode) => {
        if (!graph) return;
        graph.addNode({
          id: node.id,
          shape: 'kt-automation-node',
          x: 150 + graph.getNodes().length * 20,
          y: 100 + graph.getNodes().length * 15,
          data: cloneDeep(node),
          ports: ports(node),
        });
      },
      updateNode: (node: WorkflowNode) => {
        const cell = graph?.getCellById(node.id);
        if (!cell?.isNode()) return;
        cell.setData(cloneDeep(node), { overwrite: true });
        cell.setProp('ports', ports(node));
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
        <TeleportContainer />
      </div>
    );
  },
});
