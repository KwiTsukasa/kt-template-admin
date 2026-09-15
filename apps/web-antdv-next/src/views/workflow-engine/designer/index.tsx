import type {
  DefinitionDocument,
  DefinitionRevision,
} from '#/api/automation/definition';
import type { FormDefinition } from '#/api/form-definition';
import type { RuleDefinition } from '#/api/rule-engine';
import type { TaskCapability } from '#/api/task-execution';
import type { WorkflowIssue, WorkflowNode } from '#/api/workflow-engine';
import { computed, defineComponent, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Page } from '@vben/common-ui';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Tabs,
} from 'antdv-next';
import { formApi } from '#/api/form-definition';
import { ruleApi } from '#/api/rule-engine';
import { getTaskCapabilities, getTaskCapability } from '#/api/task-execution';
import { workflowApi } from '#/api/workflow-engine';
import { useDefinitionEditor } from '#/components/kt-definition-list/useDefinitionEditor';
import DataSchemaEditor from '#/components/kt-dynamic-form/DataSchemaEditor';
import BindingEditor from './BindingEditor';
import WorkflowCanvas from './WorkflowCanvas';

type CanvasApi = {
  addNode: (node: WorkflowNode) => void;
  updateNode: (node: WorkflowNode) => void;
  focus: (id: string) => void;
  undo: () => void;
  redo: () => void;
  fit: () => void;
  removeSelected: () => void;
  copy: () => void;
  paste: () => void;
};

export default defineComponent({
  name: 'AutomationWorkflowDesigner',
  setup() {
    const router = useRouter();
    const editor = useDefinitionEditor(
      workflowApi,
      'workflowId',
      '/automation/workflows',
    );
    const canvas = ref<CanvasApi>();
    const selectedId = ref<string | null>(null);
    const selected = computed(() =>
      editor.definition.value?.graph.nodes.find(
        (node) => node.id === selectedId.value,
      ),
    );
    const tasks = ref<TaskCapability[]>([]);
    const rules = ref<DefinitionDocument<RuleDefinition>[]>([]);
    const forms = ref<DefinitionDocument<FormDefinition>[]>([]);
    const ruleVersions = ref<DefinitionRevision<RuleDefinition>[]>([]);
    const formVersions = ref<DefinitionRevision<FormDefinition>[]>([]);
    const issues = ref<WorkflowIssue[]>([]);
    const validated = ref(false);
    const tab = ref('node');
    const catalogError = ref('');
    onMounted(async () => {
      const results = await Promise.allSettled([
        getTaskCapabilities(),
        ruleApi.page({ pageSize: 100 }),
        formApi.page({ pageSize: 100 }),
      ]);
      if (results[0].status === 'fulfilled') {
        const combined = [...results[0].value, ...tasks.value];
        tasks.value = [
          ...new Map(
            combined.map((task) => [`${task.id}@${task.version}`, task]),
          ).values(),
        ];
      } else catalogError.value = '原子任务能力目录暂不可用';
      if (results[1].status === 'fulfilled')
        rules.value = results[1].value.list.filter(
          (rule) => rule.publishedVersion,
        );
      if (results[2].status === 'fulfilled')
        forms.value = results[2].value.list.filter(
          (form) => form.publishedVersion,
        );
    });
    watch(
      () =>
        editor.definition.value?.graph.nodes
          .filter((node) => node.type === 'task')
          .map((node) => node.taskRef),
      async (references) => {
        const pending = (references || []).filter(
          (reference) =>
            !tasks.value.some(
              (task) =>
                task.id === reference.id && task.version === reference.version,
            ),
        );
        const results = await Promise.allSettled(
          pending.map(getTaskCapability),
        );
        for (const result of results)
          if (
            result.status === 'fulfilled' &&
            !tasks.value.some(
              (task) =>
                task.id === result.value.id &&
                task.version === result.value.version,
            )
          )
            tasks.value.push(result.value);
      },
      { immediate: true, deep: true },
    );
    watch(
      () => editor.definition.value?.graph.formRef?.id,
      async (id) => {
        formVersions.value = [];
        if (!id) return;
        const versions = await formApi.versions(id);
        if (editor.definition.value?.graph.formRef?.id === id)
          formVersions.value = versions;
      },
      { immediate: true },
    );
    watch(
      () => editor.definition.value,
      () => {
        validated.value = false;
      },
      { deep: true },
    );
    const addNode = async (type: 'task' | 'rule' | 'wait' | 'fork') => {
      const id = `node_${crypto.randomUUID()}`;
      if (type === 'wait')
        canvas.value?.addNode({
          id,
          name: '等待',
          type: 'wait',
          durationMs: 60000,
        });
      if (type === 'task') {
        const task = tasks.value.find((task) => task.available);
        if (!task) return;
        canvas.value?.addNode({
          id,
          name: task.name,
          type: 'task',
          taskRef: { id: task.id, version: task.version },
          input: {},
        });
      }
      if (type === 'rule') {
        const rule = rules.value[0];
        if (!rule) return;
        const versions = await ruleApi.versions(rule.id);
        const version = versions[0];
        if (!version) return;
        const branches = ruleBranches(version.definition);
        canvas.value?.addNode({
          id,
          name: rule.name,
          type: 'rule',
          ruleRef: { id: rule.id, version: version.version },
          facts: {},
          branches,
        });
      }
      if (type === 'fork') {
        const joinId = `node_${crypto.randomUUID()}`;
        canvas.value?.addNode({ id, name: '并行分支', type: 'fork', joinId });
        canvas.value?.addNode({
          id: joinId,
          name: '全部汇合',
          type: 'join',
          forkId: id,
        });
      }
      await selectNode(id);
    };
    const ruleBranches = (definition: RuleDefinition) => {
      if (definition.mode === 'condition')
        return [
          { port: 'matched', value: true },
          { port: 'unmatched', value: false },
        ];
      const values = [
        ...new Map(
          [
            definition.defaultResult,
            ...definition.rows.map((row) => row.result),
          ].map((value) => [JSON.stringify(value), value]),
        ).values(),
      ];
      return values.map((value, index) => ({
        port: `result_${index + 1}`,
        value,
      }));
    };
    const selectNode = async (id: string | null) => {
      selectedId.value = id;
      tab.value = 'node';
      ruleVersions.value = [];
      const node = selected.value;
      if (node?.type === 'rule')
        ruleVersions.value = await ruleApi.versions(node.ruleRef.id);
    };
    const validate = async () => {
      if (!editor.definition.value) return;
      const snapshot = JSON.stringify(editor.definition.value);
      const result = await workflowApi.validate(JSON.parse(snapshot));
      if (snapshot !== JSON.stringify(editor.definition.value)) {
        message.info('画布已变化，请重新校验');
        return;
      }
      validated.value = true;
      issues.value = result.issues;
      if (result.valid) message.success('图结构与版本引用校验通过');
    };
    const outputSources = computed(() =>
      (editor.definition.value?.graph.nodes || []).flatMap((node) => {
        if (node.type !== 'task') return [];
        if (tab.value === 'node' && selectedId.value) {
          const ancestors = new Set<string>();
          const pending = [selectedId.value];
          while (pending.length) {
            const id = pending.pop()!;
            for (const edge of editor.definition.value?.graph.edges || []) {
              if (edge.target !== id || ancestors.has(edge.source)) continue;
              ancestors.add(edge.source);
              pending.push(edge.source);
            }
          }
          if (!ancestors.has(node.id) || node.id === selectedId.value)
            return [];
        }
        const task = tasks.value.find(
          (task) =>
            task.id === node.taskRef.id &&
            task.version === node.taskRef.version,
        );
        if (!task) return [];
        return [
          { nodeId: node.id, name: node.name, schema: task.outputSchema },
        ];
      }),
    );
    const nodeInspector = () => {
      const node = selected.value;
      const definition = editor.definition.value;
      if (!node || !definition) return <Empty description="选择节点查看属性" />;
      let properties = null;
      if (node.type === 'wait')
        properties = (
          <label class="block">
            等待秒数
            <InputNumber
              class="w-full"
              min={1}
              max={2592000}
              value={node.durationMs / 1000}
              onChange={(value) =>
                canvas.value?.updateNode({
                  ...node,
                  durationMs: Number(value) * 1000,
                })
              }
            />
          </label>
        );
      if (node.type === 'fork')
        properties = (
          <Alert
            type="info"
            message={`所有分支必须在 ${node.joinId} 汇合，等待所有活动分支完成。`}
          />
        );
      if (node.type === 'join')
        properties = (
          <Alert type="info" message={`配对并行节点：${node.forkId}`} />
        );
      if (node.type === 'task') {
        const task = tasks.value.find(
          (task) =>
            task.id === node.taskRef.id &&
            task.version === node.taskRef.version,
        );
        properties = (
          <div class="space-y-4">
            <label class="block">
              执行动作
              <Select
                class="w-full"
                value={`${node.taskRef.id}@${node.taskRef.version}`}
                options={tasks.value.map((task) => ({
                  label: `${task.name} · v${task.version}`,
                  value: `${task.id}@${task.version}`,
                }))}
                onChange={(value) => {
                  const [id, version] = String(value).split('@');
                  if (id)
                    canvas.value?.updateNode({
                      ...node,
                      taskRef: { id, version: Number(version) },
                      input: {},
                    });
                }}
              />
            </label>
            {task && (
              <BindingEditor
                fields={task.inputSchema.fields}
                values={node.input}
                inputSchema={definition.graph.inputSchema}
                outputs={outputSources.value}
                onChange={(input) =>
                  canvas.value?.updateNode({ ...node, input })
                }
              />
            )}
          </div>
        );
      }
      if (node.type === 'rule') {
        const version = ruleVersions.value.find(
          (item) => item.version === node.ruleRef.version,
        );
        properties = (
          <div class="space-y-4">
            <label class="block">
              规则
              <Select
                class="w-full"
                value={node.ruleRef.id}
                options={rules.value.map((rule) => ({
                  label: rule.name,
                  value: rule.id,
                }))}
                onChange={async (id) => {
                  ruleVersions.value = await ruleApi.versions(String(id));
                  const revision = ruleVersions.value[0];
                  if (revision)
                    canvas.value?.updateNode({
                      ...node,
                      ruleRef: { id: String(id), version: revision.version },
                      facts: {},
                      branches: ruleBranches(revision.definition),
                    });
                }}
              />
            </label>
            <label class="block">
              固定版本
              <Select
                class="w-full"
                value={node.ruleRef.version}
                options={ruleVersions.value.map((version) => ({
                  label: `版本 ${version.version}`,
                  value: version.version,
                }))}
                onChange={(value) => {
                  const revision = ruleVersions.value.find(
                    (item) => item.version === Number(value),
                  );
                  if (revision)
                    canvas.value?.updateNode({
                      ...node,
                      ruleRef: { ...node.ruleRef, version: revision.version },
                      branches: ruleBranches(revision.definition),
                    });
                }}
              />
            </label>
            {version && (
              <BindingEditor
                fields={version.definition.factSchema.fields}
                values={node.facts}
                inputSchema={definition.graph.inputSchema}
                outputs={outputSources.value}
                onChange={(facts) =>
                  canvas.value?.updateNode({ ...node, facts })
                }
              />
            )}
            <div>
              {node.branches.map((branch) => (
                <div key={branch.port}>
                  {branch.port} → {String(branch.value)}
                </div>
              ))}
            </div>
          </div>
        );
      }
      return (
        <div class="space-y-4">
          <label class="block">
            节点名称
            <Input
              value={node.name}
              onChange={(event) =>
                canvas.value?.updateNode({
                  ...node,
                  name: event.target.value || '',
                })
              }
            />
          </label>
          <div class="break-all text-xs text-muted-foreground">{node.id}</div>
          {properties}
        </div>
      );
    };
    const bindFormVersion = async (id: string, version: number) => {
      const definition = editor.definition.value;
      if (!definition) return;
      const form = await formApi.version(id, version);
      if (editor.definition.value !== definition) return;
      definition.graph.formRef = { id, version };
      definition.graph.inputSchema = JSON.parse(
        JSON.stringify(form.dataSchema),
      );
      definition.graph.formMapping = Object.fromEntries(
        form.dataSchema.fields.map((field) => [field.key, field.key]),
      );
    };
    const processInspector = () => {
      const definition = editor.definition.value;
      if (!definition) return null;
      const versionOptions = formVersions.value.map((version) => ({
        label: `版本 ${version.version}`,
        value: version.version,
      }));
      if (
        definition.graph.formRef &&
        !versionOptions.some(
          (option) => option.value === definition.graph.formRef?.version,
        )
      )
        versionOptions.push({
          label: `固定版本 ${definition.graph.formRef.version}`,
          value: definition.graph.formRef.version,
        });
      return (
        <div class="space-y-4">
          <label class="block">
            流程总期限（秒）
            <InputNumber
              class="w-full"
              min={1}
              max={2678400}
              value={definition.graph.timeoutMs / 1000}
              onChange={(value) => {
                definition.graph.timeoutMs = Number(value) * 1000;
              }}
            />
          </label>
          <label class="block">
            发起表单
            <Select
              class="w-full"
              allowClear
              placeholder="无人工表单"
              value={definition.graph.formRef?.id}
              options={forms.value.map((form) => ({
                label: form.name,
                value: form.id,
              }))}
              onChange={async (value) => {
                if (!value) {
                  definition.graph.formRef = null;
                  definition.graph.formMapping = {};
                  formVersions.value = [];
                  return;
                }
                formVersions.value = await formApi.versions(String(value));
                const form = formVersions.value[0];
                if (!form) return;
                await bindFormVersion(String(value), form.version);
              }}
            />
          </label>
          {definition.graph.formRef && (
            <label class="block">
              表单固定版本
              <Select
                class="w-full"
                value={definition.graph.formRef.version}
                options={versionOptions}
                onChange={(value) => {
                  if (definition.graph.formRef)
                    void bindFormVersion(
                      definition.graph.formRef.id,
                      Number(value),
                    );
                }}
              />
            </label>
          )}
          <span class="text-muted-foreground">
            表单版本固定到流程发布版本，实例值独立保存。
          </span>
          <Card size="small" title="流程输入">
            {definition.graph.formRef && (
              <div>
                {definition.graph.inputSchema.fields.map((field) => (
                  <div key={field.key}>
                    {field.label} · {field.type}
                  </div>
                ))}
                <Button
                  type="link"
                  onClick={() =>
                    router.push(
                      `/automation/forms/${definition.graph.formRef?.id}/designer`,
                    )
                  }
                >
                  打开独立表单设计
                </Button>
              </div>
            )}
            {!definition.graph.formRef && (
              <DataSchemaEditor
                schema={definition.graph.inputSchema}
                onChange={(schema) => {
                  definition.graph.inputSchema = schema;
                }}
              />
            )}
          </Card>
          <Card size="small" title="流程输出">
            <DataSchemaEditor
              schema={definition.graph.outputSchema}
              onChange={(schema) => {
                definition.graph.outputSchema = schema;
                const fields = new Set(schema.fields.map((field) => field.key));
                definition.graph.output = Object.fromEntries(
                  Object.entries(definition.graph.output).filter(([key]) =>
                    fields.has(key),
                  ),
                );
              }}
            />
            <div class="mt-4">
              <BindingEditor
                fields={definition.graph.outputSchema.fields}
                values={definition.graph.output}
                inputSchema={definition.graph.inputSchema}
                outputs={outputSources.value}
                onChange={(output) => {
                  definition.graph.output = output;
                }}
              />
            </div>
          </Card>
        </div>
      );
    };
    return () => (
      <Page>
        <div class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <Space>
              <Button onClick={editor.back}>返回工作流管理</Button>
              <Input
                style={{ width: '230px' }}
                value={editor.name.value}
                onChange={(event) => {
                  editor.name.value = event.target.value || '';
                }}
              />
              <span>草稿 {editor.document.value?.revision}</span>
            </Space>
            <Space>
              <Button loading={editor.loading.value} onClick={editor.save}>
                保存
              </Button>
              <Button onClick={validate}>校验</Button>
              <Button
                type="primary"
                loading={editor.loading.value}
                onClick={editor.publish}
              >
                发布
              </Button>
              <Button
                disabled={!editor.document.value?.publishedVersion}
                onClick={() =>
                  router.push(
                    `/automation/workflows/${editor.document.value?.id}/start`,
                  )
                }
              >
                运行已发布版本
              </Button>
            </Space>
          </div>
          {editor.error.value && (
            <Alert type="error" message={editor.error.value} />
          )}
          <div class="grid gap-4 xl:grid-cols-[150px_minmax(0,1fr)_320px]">
            <Card title="节点库">
              <div class="space-y-2">
                <Button
                  block
                  disabled={!tasks.value.some((task) => task.available)}
                  onClick={() => addNode('task')}
                >
                  执行任务
                </Button>
                <Button
                  block
                  disabled={!rules.value.length}
                  onClick={() => addNode('rule')}
                >
                  规则分支
                </Button>
                <Button block onClick={() => addNode('fork')}>
                  并行与汇合
                </Button>
                <Button block onClick={() => addNode('wait')}>
                  等待
                </Button>
                {catalogError.value && (
                  <Alert type="warning" message={catalogError.value} />
                )}
              </div>
            </Card>
            <div class="min-w-0 space-y-2">
              <Space>
                <Button onClick={() => canvas.value?.undo()}>撤销</Button>
                <Button onClick={() => canvas.value?.redo()}>重做</Button>
                <Button onClick={() => canvas.value?.copy()}>复制</Button>
                <Button onClick={() => canvas.value?.paste()}>粘贴</Button>
                <Button onClick={() => canvas.value?.fit()}>适应画布</Button>
                <Button onClick={() => canvas.value?.removeSelected()}>
                  删除选中
                </Button>
              </Space>
              {editor.definition.value && (
                <WorkflowCanvas
                  ref={canvas}
                  definition={editor.definition.value}
                  onChange={(definition) => {
                    editor.definition.value = definition;
                    validated.value = false;
                  }}
                  onSelect={selectNode}
                />
              )}
            </div>
            <Card>
              <Tabs
                activeKey={tab.value}
                onChange={(key) => {
                  tab.value = String(key);
                }}
                items={[
                  { key: 'node', label: '节点属性', content: nodeInspector },
                  {
                    key: 'process',
                    label: '流程设置',
                    content: processInspector,
                  },
                ]}
              />
            </Card>
          </div>
          <Card size="small" title="图校验">
            {validated.value && !issues.value.length && (
              <Alert type="success" message="图结构与版本依赖校验通过" />
            )}
            {issues.value.map((issue, index) => (
              <div key={index} class="flex gap-2 py-1">
                <Button
                  type="link"
                  onClick={() => {
                    const id = issue.nodeId || issue.edgeId;
                    if (id) canvas.value?.focus(id);
                  }}
                >
                  {issue.nodeId || issue.edgeId || '流程'}
                </Button>
                <span>{issue.message}</span>
              </div>
            ))}
          </Card>
        </div>
      </Page>
    );
  },
});
