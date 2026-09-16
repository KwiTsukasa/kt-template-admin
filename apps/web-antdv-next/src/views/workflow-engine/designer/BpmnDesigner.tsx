import type {
  DataField,
  DefinitionDocument,
  DefinitionRevision,
} from '#/api/automation/definition';
import type { FormDefinition } from '#/api/form-definition';
import type { RuleDefinition } from '#/api/rule-engine';
import type { TaskCapability } from '#/api/task-execution';
import type {
  ValueBinding,
  WorkflowIssue,
  WorkflowProcessCapability,
  WorkflowScriptCapability,
} from '#/api/workflow-engine';
import type {
  BpmnContract,
  BpmnDefinition,
  BpmnElement,
  BpmnStep,
} from '#/api/workflow-engine/bpmn';

import {
  computed,
  defineComponent,
  nextTick,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { cloneDeep, downloadFileFromBlob } from '@vben/utils';

import {
  Alert,
  Button,
  Empty,
  Input,
  InputNumber,
  message,
  Select,
  Switch,
  Tabs,
} from 'antdv-next';

import { formApi } from '#/api/form-definition';
import { ruleApi } from '#/api/rule-engine';
import { getTaskCapabilities, getTaskCapability } from '#/api/task-execution';
import { workflowApi } from '#/api/workflow-engine';
import { bpmnNamespace, bpmnWorkflowApi } from '#/api/workflow-engine/bpmn';
import EditorHeader from '#/components/kt-automation/EditorHeader';
import { useDefinitionEditor } from '#/components/kt-definition-list/useDefinitionEditor';

import BindingEditor from './BindingEditor';
import {
  readBpmnCountBinding,
  writeBpmnCountBinding,
} from './bpmn-count-binding';
import { arrangeBpmnScope } from './bpmn-layout';
import {
  bpmnExtension,
  bpmnId,
  bpmnProcess,
  emptyBpmnContract,
  indexBpmn,
  setBpmnExtension,
} from './bpmn-model';
import { removeBpmnElement } from './bpmn-structure';
import BpmnCanvas from './BpmnCanvas';
import BpmnContractEditor from './BpmnContractEditor';
import BpmnExpressionEditor, { bpmnComparison } from './BpmnExpressionEditor';
import BpmnHumanProperties from './BpmnHumanProperties';
import BpmnStructureProperties from './BpmnStructureProperties';
import ScriptSequence from './ScriptSequence';
import ScriptUpload from './ScriptUpload';

const controls = [
  {
    type: 'bpmn:IntermediateThrowEvent',
    label: '触发补偿',
    icon: 'lucide:undo-2',
  },
  { type: 'bpmn:Participant', label: '外部泳池', icon: 'lucide:panel-top' },
  { type: 'bpmn:Lane', label: '泳道', icon: 'lucide:rows-3' },
  {
    type: 'bpmn:BoundaryEvent',
    label: '边界事件',
    icon: 'lucide:circle-dashed',
  },
  { type: 'bpmn:UserTask', label: '人工办理', icon: 'lucide:user-round-check' },
  { type: 'bpmn:StartEvent', label: '开始事件', icon: 'lucide:circle' },
  { type: 'bpmn:EndEvent', label: '结束事件', icon: 'lucide:circle-stop' },
  { type: 'bpmn:ExclusiveGateway', label: '排他网关', icon: 'lucide:diamond' },
  { type: 'bpmn:ParallelGateway', label: '并行网关', icon: 'lucide:git-fork' },
  { type: 'bpmn:ComplexGateway', label: '复杂网关', icon: 'lucide:asterisk' },
  {
    type: 'bpmn:InclusiveGateway',
    label: '包容网关',
    icon: 'lucide:circle-dot',
  },
  {
    type: 'bpmn:BusinessRuleTask',
    label: '规则任务',
    icon: 'lucide:table-properties',
  },
  {
    type: 'bpmn:IntermediateCatchEvent',
    label: '定时等待',
    icon: 'lucide:timer',
  },
  { type: 'bpmn:SubProcess', label: '子流程', icon: 'lucide:square-plus' },
  {
    type: 'bpmn:Transaction',
    label: '事务子流程',
    icon: 'lucide:panels-top-left',
  },
];
type CanvasApi = {
  add: (element: BpmnElement) => void;
  fit: () => void;
  snapshot: () => BpmnDefinition;
  startDrag: (element: BpmnElement, event: MouseEvent) => void;
};

export default defineComponent({
  name: 'BpmnWorkflowDesigner',
  setup() {
    const router = useRouter();
    const { hasAccessByCodes } = useAccess();
    const editor = useDefinitionEditor(
      bpmnWorkflowApi,
      'workflowId',
      '/automation/workflows',
    );
    const canvas = ref<CanvasApi>();
    const scopeId = ref('');
    const search = ref('');
    const selectedId = ref('');
    const issues = ref<WorkflowIssue[]>([]);
    const inspectorTab = ref('node');
    const processes = ref<WorkflowProcessCapability[]>([]);
    const scripts = ref<WorkflowScriptCapability[]>([]);
    const actions = ref<TaskCapability[]>([]);
    const fixedActions = ref<Record<string, TaskCapability>>({});
    const pendingActions = new Set<string>();
    const rules = ref<DefinitionDocument<RuleDefinition>[]>([]);
    const ruleVersions = ref<
      Record<string, DefinitionRevision<RuleDefinition>[]>
    >({});
    const future = ref<string[]>([]);
    const history = ref<string[]>([]);
    const definition = computed(
      () => editor.definition.value as BpmnDefinition | undefined,
    );
    const selected = computed(() => {
      if (!definition.value) return null;
      return indexBpmn(definition.value).get(selectedId.value)?.element ?? null;
    });
    const contract = computed(() => {
      if (!definition.value) return emptyBpmnContract();
      return (
        bpmnExtension<BpmnContract>(
          bpmnProcess(definition.value),
          'kt:Contract',
        ) ?? emptyBpmnContract()
      );
    });
    const process = computed(() =>
      processes.value.find(
        (item) =>
          item.key === contract.value.processRef?.key &&
          item.version === contract.value.processRef?.version,
      ),
    );
    const humanForms = ref<Record<string, FormDefinition>>({});
    const pendingForms = new Set<string>();
    watch(
      definition,
      async (document) => {
        if (!document) return;
        for (const { element } of indexBpmn(document).values()) {
          const human = bpmnExtension<BpmnStep>(element, 'kt:Step');
          if (human?.kind === 'action') {
            const key = `${human.taskRef.id}:${human.taskRef.version}`;
            if (!fixedActions.value[key] && !pendingActions.has(key)) {
              pendingActions.add(key);
              try {
                fixedActions.value[key] = await getTaskCapability(
                  human.taskRef,
                );
              } catch {
                message.error('固定动作版本读取失败');
              } finally {
                pendingActions.delete(key);
              }
            }
          }
          if (human?.kind !== 'human' || !human.formRef) continue;
          const key = `${human.formRef.id}:${human.formRef.version}`;
          if (humanForms.value[key] || pendingForms.has(key)) continue;
          pendingForms.add(key);
          try {
            humanForms.value[key] = await formApi.version(
              human.formRef.id,
              human.formRef.version,
            );
          } catch {
            message.error('人工节点表单读取失败');
          } finally {
            pendingForms.delete(key);
          }
        }
      },
      { immediate: true },
    );
    const step = computed(() => {
      if (!selected.value) return null;
      return bpmnExtension<BpmnStep>(selected.value, 'kt:Step');
    });
    const descriptor = computed(() => {
      const current = step.value;
      if (!current || current.kind === 'rule' || current.kind === 'human')
        return null;
      if (current.kind === 'action')
        return (
          fixedActions.value[
            `${current.taskRef.id}:${current.taskRef.version}`
          ] ??
          actions.value.find(
            (item) =>
              item.id === current.taskRef.id &&
              item.version === current.taskRef.version,
          ) ??
          null
        );
      return (
        process.value?.steps.find((item) => item.key === current.stepKey) ??
        null
      );
    });
    const outputSources = computed(() => {
      if (!definition.value) return [];
      return [...indexBpmn(definition.value).values()].flatMap(
        ({ element }) => {
          const binding = bpmnExtension<BpmnStep>(element, 'kt:Step');
          if (
            !binding ||
            (element.id === selectedId.value && !element.loopCharacteristics)
          )
            return [];
          if (binding.kind === 'human') {
            let schema: FormDefinition['dataSchema'] | undefined = {
              fields: [
                {
                  key: 'confirmed',
                  label: '已确认',
                  type: 'boolean',
                  required: true,
                },
              ],
            };
            if (binding.formRef)
              schema =
                humanForms.value[
                  `${binding.formRef.id}:${binding.formRef.version}`
                ]?.dataSchema;
            if (!schema) return [];
            if (binding.businessKey) {
              const capability = process.value?.humanSteps?.find(
                (item) => item.key === binding.businessKey,
              );
              if (capability)
                schema = {
                  fields: [...schema.fields, ...capability.outputSchema.fields],
                };
            }
            return [
              {
                nodeId: element.id ?? '',
                name: element.name ?? element.id ?? '',
                schema,
              },
            ];
          }
          if (binding.kind === 'rule')
            return [
              {
                nodeId: element.id ?? '',
                name: element.name ?? element.id ?? '',
                schema: {
                  fields: [
                    {
                      key: 'result',
                      label: '判断结果',
                      type: 'boolean' as const,
                      required: true,
                    },
                  ],
                },
              },
            ];
          if (binding.kind === 'action') {
            const action =
              fixedActions.value[
                `${binding.taskRef.id}:${binding.taskRef.version}`
              ] ??
              actions.value.find(
                (item) =>
                  item.id === binding.taskRef.id &&
                  item.version === binding.taskRef.version,
              );
            if (!action) return [];
            return [
              {
                nodeId: element.id ?? '',
                name: element.name ?? '',
                schema: action.outputSchema,
              },
            ];
          }
          const output = process.value?.steps.find(
            (item) => item.key === binding.stepKey,
          )?.outputSchema;
          if (!output) return [];
          return [
            {
              nodeId: element.id ?? '',
              name: element.name ?? element.id ?? '',
              schema: output,
            },
          ];
        },
      );
    });
    const expressionFields = computed(() => [
      ...contract.value.inputSchema.fields.map((field) => ({
        ...field,
        key: `input.${field.key}`,
        label: `流程输入 / ${field.label}`,
      })),
      ...outputSources.value.flatMap((source) =>
        source.schema.fields.map((field) => ({
          ...field,
          key: `outputs.${source.nodeId}.${field.key}`,
          label: `${source.name} / ${field.label}`,
        })),
      ),
    ]);
    const commit = (next: BpmnDefinition) => {
      if (definition.value)
        history.value = [
          ...history.value.slice(-49),
          JSON.stringify(definition.value),
        ];
      future.value = [];
      editor.definition.value = next;
      issues.value = [];
    };
    const edit = (change: (draft: BpmnDefinition) => void) => {
      if (!definition.value) return;
      const next = cloneDeep(definition.value);
      change(next);
      commit(next);
    };
    const editElement = (change: (element: BpmnElement) => void) =>
      edit((draft) => {
        const element = indexBpmn(draft).get(selectedId.value)?.element;
        if (element) change(element);
      });
    const setContract = (value: BpmnContract) =>
      edit((draft) =>
        setBpmnExtension(bpmnProcess(draft), 'kt:Contract', value),
      );
    const undo = () => {
      const previous = history.value.pop();
      if (previous && definition.value) {
        future.value.push(JSON.stringify(definition.value));
        editor.definition.value = JSON.parse(previous);
      }
    };
    const redo = () => {
      const next = future.value.pop();
      if (next && definition.value) {
        history.value.push(JSON.stringify(definition.value));
        editor.definition.value = JSON.parse(next);
      }
    };
    const create = (type: string, name: string): BpmnElement => {
      const element: BpmnElement = {
        $type: type,
        id: bpmnId(type.slice(5)),
        name,
      };
      if (type === 'bpmn:UserTask')
        setBpmnExtension(element, 'kt:Step', {
          kind: 'human',
          formRef: null,
          writableFields: [],
          input: {},
        });
      if (type === 'bpmn:BusinessRuleTask')
        element.implementation = `${bpmnNamespace}/step`;
      if (type === 'bpmn:ComplexGateway')
        element.activationCondition = {
          $type: 'bpmn:FormalExpression',
          language: `${bpmnNamespace}/expression`,
          body: JSON.stringify({ value: false }),
        };
      if (type === 'bpmn:IntermediateThrowEvent')
        element.eventDefinitions = [
          { $type: 'bpmn:CompensateEventDefinition', id: bpmnId('Compensate') },
        ];
      if (['bpmn:SubProcess', 'bpmn:Transaction'].includes(type))
        element.flowElements = [];
      if (['bpmn:BoundaryEvent', 'bpmn:IntermediateCatchEvent'].includes(type))
        element.eventDefinitions = [
          {
            $type: 'bpmn:TimerEventDefinition',
            id: bpmnId('Timer'),
            timeDuration: { $type: 'bpmn:FormalExpression', body: 'PT60S' },
          },
        ];
      return element;
    };
    const business = (key: string, name: string) => {
      const element = create('bpmn:ServiceTask', name);
      element.implementation = `${bpmnNamespace}/step`;
      setBpmnExtension(element, 'kt:Step', {
        kind: 'business',
        stepKey: key,
        input: {},
        scripts: [],
      });
      return element;
    };
    const actionNode = (action: TaskCapability) => {
      const element = create('bpmn:ServiceTask', action.name);
      element.implementation = `${bpmnNamespace}/step`;
      setBpmnExtension(element, 'kt:Step', {
        kind: 'action',
        taskRef: { id: action.id, version: action.version },
        input: {},
      });
      fixedActions.value[`${action.id}:${action.version}`] = action;
      return element;
    };
    const remove = () =>
      edit((draft) => {
        removeBpmnElement(draft, selectedId.value);
        selectedId.value = '';
      });
    const arrange = (vertical: boolean) =>
      edit((draft) => arrangeBpmnScope(draft, scopeId.value, vertical));
    const syncCanvas = async () => {
      await nextTick();
      const snapshot = canvas.value?.snapshot();
      if (snapshot) editor.definition.value = snapshot;
    };
    const save = async () => {
      await syncCanvas();
      return editor.save();
    };
    const validate = async () => {
      await syncCanvas();
      if (!definition.value) return false;
      const result = await bpmnWorkflowApi.validate(definition.value);
      issues.value = result.issues;
      if (result.valid) message.success('流程检查通过');
      return result.valid;
    };
    const publish = async () => {
      if (await validate()) await editor.publish();
    };
    const exportFile = async () => {
      await syncCanvas();
      if (definition.value)
        downloadFileFromBlob({
          source: await bpmnWorkflowApi.export(definition.value),
          fileName: `${editor.name.value || 'workflow'}.bpmn`,
        });
    };
    onMounted(async () => {
      const results = await Promise.allSettled([
        workflowApi.processes(),
        workflowApi.scripts(),
        ruleApi.page({ pageSize: 100 }),
        getTaskCapabilities(),
      ]);
      if (results[0].status === 'fulfilled') processes.value = results[0].value;
      if (results[1].status === 'fulfilled') scripts.value = results[1].value;
      if (results[2].status === 'fulfilled')
        rules.value = results[2].value.list.filter(
          (item) => item.publishedVersion,
        );
      if (results[3].status === 'fulfilled') actions.value = results[3].value;
      if (results.some((result) => result.status === 'rejected'))
        message.error('部分流程能力目录加载失败');
    });
    const chooseRule = async (id: string) => {
      const selected = selectedId.value;
      const versions = await ruleApi.versions(id);
      ruleVersions.value[id] = versions;
      const revision = versions[0];
      if (selected !== selectedId.value || !revision) return;
      editElement((item) =>
        setBpmnExtension(item, 'kt:Step', {
          kind: 'rule',
          ruleRef: { id, version: revision.version },
          input: {},
        }),
      );
    };
    watch(
      () => step.value,
      async (current) => {
        if (current?.kind !== 'rule' || ruleVersions.value[current.ruleRef.id])
          return;
        ruleVersions.value[current.ruleRef.id] = await ruleApi.versions(
          current.ruleRef.id,
        );
      },
      { immediate: true },
    );
    const properties = () => {
      const element = selected.value;
      if (!element) return <Empty description="选择节点或连线" />;
      const activity = /(?:Task|Activity|Process|Transaction)$/.test(
        element.$type,
      );
      const source =
        definition.value &&
        indexBpmn(definition.value).get(element.sourceRef?.$ref)?.element;
      const defaultFlow = source?.default?.$ref === element.id;
      const conditionFields: DataField[] = [...expressionFields.value];
      let gateway = source;
      if (element.$type === 'bpmn:ComplexGateway') gateway = element;
      if (gateway?.$type === 'bpmn:ComplexGateway' && definition.value) {
        const index = indexBpmn(definition.value);
        conditionFields.push({
          key: 'content.waitingForStart',
          label: '网关 / 等待激活',
          type: 'boolean',
          required: true,
        });
        for (const { element: flow } of index.values()) {
          if (
            flow.$type !== 'bpmn:SequenceFlow' ||
            flow.targetRef?.$ref !== gateway.id
          )
            continue;
          const origin = index.get(flow.sourceRef?.$ref)?.element;
          conditionFields.push({
            key: `content.activationCount.${flow.id}`,
            label: `入口令牌 / ${origin?.name || flow.name || flow.id}`,
            type: 'integer',
            required: true,
          });
        }
      }
      const ruleStep = step.value;
      let ruleDefinition: RuleDefinition | undefined;
      if (ruleStep?.kind === 'rule')
        ruleDefinition = ruleVersions.value[ruleStep.ruleRef.id]?.find(
          (revision) => revision.version === ruleStep.ruleRef.version,
        )?.definition;
      return (
        <div class="space-y-4">
          <label class="block space-y-2">
            <span>名称</span>
            <Input
              onChange={(event) =>
                editElement((item) => {
                  item.name = event.target.value ?? '';
                })
              }
              value={element.name ?? ''}
            />
          </label>
          {definition.value && (
            <BpmnStructureProperties
              definition={definition.value}
              element={element}
              onChange={commit}
            />
          )}
          {element.$type === 'bpmn:ComplexGateway' && (
            <div class="space-y-2">
              <span>激活条件</span>
              <BpmnExpressionEditor
                fields={conditionFields}
                onChange={(value) =>
                  editElement((item) => {
                    item.activationCondition = {
                      $type: 'bpmn:FormalExpression',
                      language: `${bpmnNamespace}/expression`,
                      body: JSON.stringify(value),
                    };
                  })
                }
                value={JSON.parse(
                  element.activationCondition?.body ?? '{"value":false}',
                )}
              />
            </div>
          )}
          {element.$type === 'bpmn:SequenceFlow' &&
            source &&
            [
              'bpmn:ComplexGateway',
              'bpmn:ExclusiveGateway',
              'bpmn:InclusiveGateway',
            ].includes(source.$type) && (
              <>
                <label class="flex items-center justify-between">
                  <span>默认路径</span>
                  <Switch
                    checked={defaultFlow}
                    onChange={(value) =>
                      edit((draft) => {
                        const index = indexBpmn(draft);
                        const gateway = index.get(source.id ?? '')?.element;
                        const flow = index.get(element.id ?? '')?.element;
                        if (!gateway || !flow) return;
                        if (value) {
                          gateway.default = { $ref: element.id };
                          delete flow.conditionExpression;
                        } else {
                          delete gateway.default;
                        }
                      })
                    }
                  />
                </label>
                {!defaultFlow && !element.conditionExpression && (
                  <Button
                    onClick={() =>
                      editElement((item) => {
                        item.conditionExpression = {
                          $type: 'bpmn:FormalExpression',
                          language: `${bpmnNamespace}/expression`,
                          body: JSON.stringify(
                            bpmnComparison(conditionFields[0]),
                          ),
                        };
                      })
                    }
                  >
                    添加条件
                  </Button>
                )}
                {!defaultFlow && element.conditionExpression && (
                  <>
                    <BpmnExpressionEditor
                      fields={conditionFields}
                      onChange={(value) =>
                        editElement((item) => {
                          item.conditionExpression = {
                            $type: 'bpmn:FormalExpression',
                            language: `${bpmnNamespace}/expression`,
                            body: JSON.stringify(value),
                          };
                        })
                      }
                      value={JSON.parse(element.conditionExpression.body)}
                    />
                    <Button
                      danger
                      onClick={() =>
                        editElement((item) => {
                          delete item.conditionExpression;
                        })
                      }
                    >
                      删除条件
                    </Button>
                  </>
                )}
              </>
            )}
          {element.$type === 'bpmn:BusinessRuleTask' && (
            <>
              <Select
                class="w-full"
                onChange={(id) => void chooseRule(String(id))}
                options={rules.value.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                placeholder="选择已发布规则"
                value={
                  (ruleStep?.kind === 'rule' && ruleStep.ruleRef.id) ||
                  undefined
                }
              />
              {ruleStep?.kind === 'rule' && (
                <>
                  <Select
                    class="w-full"
                    onChange={(version) =>
                      editElement((item) =>
                        setBpmnExtension(item, 'kt:Step', {
                          ...ruleStep,
                          ruleRef: {
                            ...ruleStep.ruleRef,
                            version: Number(version),
                          },
                          input: {},
                        }),
                      )
                    }
                    options={(
                      ruleVersions.value[ruleStep.ruleRef.id] ?? [
                        { version: ruleStep.ruleRef.version },
                      ]
                    ).map((item) => ({
                      value: item.version,
                      label: `版本 ${item.version}`,
                    }))}
                    value={ruleStep.ruleRef.version}
                  />
                  {ruleDefinition && (
                    <BindingEditor
                      fields={ruleDefinition.factSchema.fields}
                      inputSchema={contract.value.inputSchema}
                      iterationAvailable={Boolean(element.loopCharacteristics)}
                      onChange={(input) =>
                        editElement((item) =>
                          setBpmnExtension(item, 'kt:Step', {
                            ...ruleStep,
                            input,
                          }),
                        )
                      }
                      outputs={outputSources.value}
                      values={ruleStep.input}
                    />
                  )}
                </>
              )}
            </>
          )}
          {element.$type === 'bpmn:EndEvent' && (
            <label class="block space-y-2">
              <span>结束类型</span>
              <Select
                class="w-full"
                onChange={(value) =>
                  editElement((item) => {
                    item.eventDefinitions = [];
                    if (value !== 'none')
                      item.eventDefinitions.push({
                        $type: String(value),
                        id: bpmnId('EventDefinition'),
                      });
                  })
                }
                options={[
                  { value: 'none', label: '普通结束' },
                  { value: 'bpmn:ErrorEventDefinition', label: '错误结束' },
                  { value: 'bpmn:TerminateEventDefinition', label: '终止结束' },
                  { value: 'bpmn:CancelEventDefinition', label: '取消事务' },
                ]}
                value={element.eventDefinitions?.[0]?.$type ?? 'none'}
              />
            </label>
          )}
          {element.eventDefinitions?.[0]?.$type ===
            'bpmn:TimerEventDefinition' && (
            <label class="block space-y-2">
              <span>等待秒数</span>
              <InputNumber
                class="w-full"
                min={1}
                onChange={(value) =>
                  editElement((item) => {
                    item.eventDefinitions[0].timeDuration.body = `PT${Number(value) || 1}S`;
                  })
                }
                value={
                  Number(
                    String(
                      element.eventDefinitions[0].timeDuration.body,
                    ).replaceAll(/^PT|S$/g, ''),
                  ) || 60
                }
              />
            </label>
          )}
          {activity && (
            <label class="block space-y-2">
              <span>循环</span>
              <Select
                class="w-full"
                onChange={(value) =>
                  editElement((item) => {
                    delete item.loopCharacteristics;
                    if (value === 'bpmn:StandardLoopCharacteristics')
                      item.loopCharacteristics = {
                        $type: value,
                        testBefore: false,
                        loopMaximum: 3,
                        loopCondition: {
                          $type: 'bpmn:FormalExpression',
                          language: `${bpmnNamespace}/expression`,
                          body: '{"value":true}',
                        },
                      };
                    if (value === 'bpmn:MultiInstanceLoopCharacteristics')
                      item.loopCharacteristics = {
                        $type: value,
                        isSequential: false,
                        loopCardinality: {
                          $type: 'bpmn:FormalExpression',
                          body: '3',
                        },
                      };
                  })
                }
                options={[
                  { value: 'none', label: '不循环' },
                  {
                    value: 'bpmn:StandardLoopCharacteristics',
                    label: '标准循环',
                  },
                  {
                    value: 'bpmn:MultiInstanceLoopCharacteristics',
                    label: '多实例',
                  },
                ]}
                value={element.loopCharacteristics?.$type ?? 'none'}
              />
            </label>
          )}
          {element.loopCharacteristics?.$type ===
            'bpmn:StandardLoopCharacteristics' && (
            <>
              <BpmnExpressionEditor
                fields={expressionFields.value}
                onChange={(value) =>
                  editElement((item) => {
                    item.loopCharacteristics.loopCondition.body =
                      JSON.stringify(value);
                  })
                }
                value={JSON.parse(
                  element.loopCharacteristics.loopCondition.body,
                )}
              />
              <label class="block space-y-2">
                <span>最大次数</span>
                <InputNumber
                  class="w-full"
                  max={10_000}
                  min={1}
                  onChange={(value) =>
                    editElement((item) => {
                      item.loopCharacteristics.loopMaximum = Number(value) || 1;
                    })
                  }
                  value={element.loopCharacteristics.loopMaximum}
                />
              </label>
              <label class="flex items-center justify-between">
                <span>执行前判断</span>
                <Switch
                  checked={element.loopCharacteristics.testBefore}
                  onChange={(value) =>
                    editElement((item) => {
                      item.loopCharacteristics.testBefore = value;
                    })
                  }
                />
              </label>
            </>
          )}
          {element.loopCharacteristics?.$type ===
            'bpmn:MultiInstanceLoopCharacteristics' && (
            <>
              <BindingEditor
                fields={[
                  {
                    key: 'count',
                    label: '实例数量',
                    type: 'integer',
                    required: true,
                    min: 0,
                    max: 1000,
                  },
                ]}
                inputSchema={contract.value.inputSchema}
                onChange={(values) =>
                  editElement((item) => {
                    const body = writeBpmnCountBinding(values.count);
                    item.loopCharacteristics.loopCardinality.body = body ?? '';
                  })
                }
                outputs={outputSources.value.filter(
                  (source) => source.nodeId !== element.id,
                )}
                values={((): Record<string, ValueBinding> => {
                  const count = readBpmnCountBinding(
                    element.loopCharacteristics.loopCardinality.body,
                  );
                  if (count) return { count };
                  return {};
                })()}
              />
              <label class="flex items-center justify-between">
                <span>顺序执行</span>
                <Switch
                  checked={element.loopCharacteristics.isSequential}
                  onChange={(value) =>
                    editElement((item) => {
                      item.loopCharacteristics.isSequential = value;
                    })
                  }
                />
              </label>
            </>
          )}
          {['bpmn:SubProcess', 'bpmn:Transaction'].includes(element.$type) && (
            <Button
              block
              onClick={() => {
                scopeId.value = element.id ?? '';
                selectedId.value = '';
              }}
            >
              进入子流程
            </Button>
          )}
          {step.value?.kind === 'human' && (
            <BpmnHumanProperties
              businessSteps={process.value?.humanSteps ?? []}
              inputSchema={contract.value.inputSchema}
              iterationAvailable={Boolean(element.loopCharacteristics)}
              onChange={(value) =>
                editElement((item) => setBpmnExtension(item, 'kt:Step', value))
              }
              outputs={outputSources.value}
              value={step.value}
            />
          )}
          {step.value &&
            step.value.kind !== 'rule' &&
            step.value.kind !== 'human' &&
            descriptor.value && (
              <>
                <BindingEditor
                  fields={descriptor.value.inputSchema.fields}
                  inputSchema={contract.value.inputSchema}
                  iterationAvailable={Boolean(element.loopCharacteristics)}
                  onChange={(input) =>
                    editElement((item) =>
                      setBpmnExtension(item, 'kt:Step', {
                        ...step.value,
                        input,
                      }),
                    )
                  }
                  outputs={outputSources.value}
                  values={step.value.input}
                />
                {step.value.kind !== 'action' && (
                  <ScriptSequence
                    catalog={scripts.value}
                    inputSchema={contract.value.inputSchema}
                    iterationAvailable={Boolean(element.loopCharacteristics)}
                    onChange={(scripts) =>
                      editElement((item) =>
                        setBpmnExtension(item, 'kt:Step', {
                          ...step.value,
                          scripts,
                        }),
                      )
                    }
                    outputs={outputSources.value}
                    preparedSchema={descriptor.value.inputSchema}
                    processKey={process.value?.key ?? ''}
                    stepKey={step.value.stepKey}
                    values={step.value.scripts}
                  />
                )}
              </>
            )}
        </div>
      );
    };
    return () => (
      <Page autoContentHeight contentClass="automation-designer-viewport">
        <div class="automation-page automation-page--designer">
          <EditorHeader
            dirty={editor.dirty.value}
            label="工作流管理"
            loading={editor.loading.value}
            name={editor.name.value}
            onBack={editor.back}
            onNameChange={(value) => {
              editor.name.value = value;
            }}
            onPublish={publish}
            onSave={save}
            permission="Automation:Workflow"
            publishedVersion={
              editor.document.value?.publishedVersion ?? undefined
            }
            revision={editor.document.value?.revision}
          >
            <Button onClick={exportFile}>导出 BPMN</Button>
            <Button onClick={validate}>检查流程</Button>
          </EditorHeader>
          {editor.error.value && (
            <Alert message={editor.error.value} type="error" />
          )}
          {definition.value && (
            <div class="automation-studio">
              <aside class="automation-studio__library">
                <section class="automation-studio__panel automation-studio__library-card">
                  <div class="automation-studio__panel-heading">
                    <strong>流程控制</strong>
                  </div>
                  <div class="automation-studio__panel-body">
                    <div class="automation-palette">
                      {controls.map((control) => (
                        <button
                          class="automation-palette__item"
                          disabled={
                            !!scopeId.value &&
                            control.type === 'bpmn:Participant'
                          }
                          key={control.type}
                          onClick={() =>
                            canvas.value?.add(
                              create(control.type, control.label),
                            )
                          }
                          onMousedown={(event) => {
                            if (event.button === 0)
                              canvas.value?.startDrag(
                                create(control.type, control.label),
                                event,
                              );
                          }}
                        >
                          <IconifyIcon icon={control.icon} />
                          <span>{control.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
                <section class="automation-studio__panel automation-studio__library-card automation-studio__library-card--actions">
                  <div class="automation-studio__panel-heading">
                    <strong>业务动作</strong>
                    <Button
                      disabled={!hasAccessByCodes(['Automation:Task:List'])}
                      onClick={() => router.push('/automation/tasks')}
                      size="small"
                      type="text"
                    >
                      管理动作
                    </Button>
                  </div>
                  <div class="automation-studio__panel-body">
                    <Select
                      class="mb-3 w-full"
                      disabled={[...indexBpmn(definition.value).values()].some(
                        ({ element }) => {
                          const configured = bpmnExtension<BpmnStep>(
                            element,
                            'kt:Step',
                          );
                          if (!configured) return false;
                          if (configured.kind === 'human')
                            return !!configured.businessKey;
                          return (
                            configured.kind === 'business' ||
                            configured.kind === 'script'
                          );
                        },
                      )}
                      onChange={(key) => {
                        const selected = processes.value.find(
                          (item) => `${item.key}@${item.version}` === key,
                        );
                        if (selected)
                          setContract({
                            ...contract.value,
                            processRef: {
                              key: selected.key,
                              version: selected.version,
                            },
                            inputSchema: selected.inputSchema,
                            outputSchema: selected.outputSchema,
                            output: {},
                            formRef: null,
                            formMapping: {},
                          });
                      }}
                      options={processes.value.map((item) => ({
                        value: `${item.key}@${item.version}`,
                        label: `${item.name} · v${item.version}`,
                      }))}
                      placeholder="选择业务"
                      value={
                        process.value &&
                        `${process.value.key}@${process.value.version}`
                      }
                    />
                    <ScriptUpload
                      onUploaded={(script) => {
                        scripts.value.push(script);
                      }}
                    />
                    <Input
                      class="my-3"
                      onChange={(event) => {
                        search.value = event.target.value ?? '';
                      }}
                      placeholder="搜索业务动作"
                      value={search.value}
                    />
                    <div class="automation-action-library">
                      {actions.value
                        .filter((item) => item.name.includes(search.value))
                        .map((item) => (
                          <button
                            class="automation-action-library__item"
                            disabled={!item.available}
                            key={`${item.id}:${item.version}`}
                            onClick={() => canvas.value?.add(actionNode(item))}
                            onMousedown={(event) => {
                              if (event.button === 0 && item.available)
                                canvas.value?.startDrag(
                                  actionNode(item),
                                  event,
                                );
                            }}
                          >
                            <IconifyIcon icon="lucide:box" />
                            <strong>{item.name}</strong>
                            <IconifyIcon icon="lucide:plus" />
                          </button>
                        ))}
                      {(process.value?.steps ?? [])
                        .filter((item) => item.name.includes(search.value))
                        .map((item) => (
                          <button
                            class="automation-action-library__item"
                            key={item.key}
                            onClick={() =>
                              canvas.value?.add(business(item.key, item.name))
                            }
                            onMousedown={(event) => {
                              if (event.button === 0)
                                canvas.value?.startDrag(
                                  business(item.key, item.name),
                                  event,
                                );
                            }}
                          >
                            <IconifyIcon icon="lucide:blocks" />
                            <strong>{item.name}</strong>
                            <IconifyIcon icon="lucide:plus" />
                          </button>
                        ))}
                    </div>
                  </div>
                </section>
              </aside>
              <main class="automation-studio__canvas">
                <div class="automation-studio__toolbar">
                  <div class="automation-studio__tools">
                    <Button
                      disabled={history.value.length === 0}
                      onClick={undo}
                      type="text"
                    >
                      撤销
                    </Button>
                    <Button
                      disabled={future.value.length === 0}
                      onClick={redo}
                      type="text"
                    >
                      重做
                    </Button>
                    <Button
                      disabled={!selectedId.value}
                      onClick={remove}
                      type="text"
                    >
                      删除
                    </Button>
                    <Button onClick={() => arrange(false)} type="text">
                      横向排布
                    </Button>
                    <Button onClick={() => arrange(true)} type="text">
                      纵向排布
                    </Button>
                    {scopeId.value && (
                      <Button
                        onClick={() => {
                          scopeId.value = '';
                          selectedId.value = '';
                        }}
                        type="text"
                      >
                        返回主流程
                      </Button>
                    )}
                  </div>
                  <Button onClick={() => canvas.value?.fit()} type="text">
                    适应画布
                  </Button>
                </div>
                <BpmnCanvas
                  definition={definition.value}
                  onChange={commit}
                  onError={(text) => message.warning(text)}
                  onOpenScope={(id) => {
                    scopeId.value = id;
                    selectedId.value = '';
                  }}
                  onSelect={(id) => {
                    selectedId.value = id;
                  }}
                  ref={canvas}
                  scopeId={scopeId.value}
                  selectedId={selectedId.value}
                />
                {issues.value.length > 0 && (
                  <section class="automation-validation">
                    {issues.value.map((issue, index) => (
                      <button
                        class="automation-validation__issue"
                        key={index}
                        onClick={() => {
                          selectedId.value = issue.nodeId ?? issue.edgeId ?? '';
                        }}
                      >
                        {issue.message}
                      </button>
                    ))}
                  </section>
                )}
              </main>
              <aside class="automation-studio__panel automation-studio__inspector">
                <div class="automation-studio__panel-body">
                  <Tabs
                    activeKey={inspectorTab.value}
                    items={[
                      {
                        key: 'node',
                        label: '节点设置',
                      },
                      {
                        key: 'contract',
                        label: '流程输入与结果',
                      },
                    ]}
                    onChange={(key) => {
                      inspectorTab.value = String(key);
                    }}
                  />
                  {inspectorTab.value === 'node' && properties()}
                  {inspectorTab.value === 'contract' && (
                    <BpmnContractEditor
                      onChange={setContract}
                      outputs={outputSources.value}
                      process={process.value}
                      value={contract.value}
                    />
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </Page>
    );
  },
});
