import type { WorkflowDefinition } from '#/api/workflow-engine';
import type { BpmnContract } from '#/api/workflow-engine/bpmn';

import { defineComponent } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import {
  isBpmnDefinition,
  workflowDocumentApi,
} from '#/api/workflow-engine/bpmn';
import DefinitionList from '#/components/kt-definition-list';

import {
  bpmnExtension,
  bpmnProcess,
  emptyBpmnContract,
  emptyBpmnWorkflow,
  indexBpmn,
} from './designer/bpmn-model';

export default defineComponent({
  name: 'AutomationWorkflows',
  setup() {
    const router = useRouter();
    return () => (
      <DefinitionList
        api={workflowDocumentApi}
        basePath="/automation/workflows"
        columns={[
          {
            title: '流程结构',
            key: 'structure',
            width: 190,
            render: (_value, record) => {
              if (isBpmnDefinition(record.definition)) {
                const contract =
                  bpmnExtension<BpmnContract>(
                    bpmnProcess(record.definition),
                    'kt:Contract',
                  ) ?? emptyBpmnContract();
                const count = [...indexBpmn(record.definition).values()].filter(
                  ({ element }) => element.$type.endsWith('Task'),
                ).length;
                return (
                  <div class="automation-definition-meta">
                    <span>{count} 个任务活动</span>
                    <small>
                      {contract.inputSchema.fields.length} 项输入 ·{' '}
                      {contract.outputSchema.fields.length} 项结果
                    </small>
                  </div>
                );
              }
              const graph = (record.definition as WorkflowDefinition).graph;
              return (
                <div class="automation-definition-meta">
                  <span>
                    {
                      graph.nodes.filter(
                        (node) => !['end', 'start'].includes(node.type),
                      ).length
                    }{' '}
                    个业务步骤
                  </span>
                  <small>
                    {graph.inputSchema.fields.length} 项输入 ·{' '}
                    {graph.outputSchema.fields.length} 项结果
                  </small>
                </div>
              );
            },
          },
          {
            title: '业务表单',
            key: 'entry',
            width: 160,
            render: (_value, record) => {
              if (isBpmnDefinition(record.definition)) {
                const contract = bpmnExtension<BpmnContract>(
                  bpmnProcess(record.definition),
                  'kt:Contract',
                );
                if (contract?.formRef)
                  return `表单 v${contract.formRef.version}`;
                return '由业务提供参数';
              }
              const graph = (record.definition as WorkflowDefinition).graph;
              if (graph.formRef) return `表单 v${graph.formRef.version}`;
              return '由业务提供参数';
            },
          },
        ]}
        createDefinition={emptyBpmnWorkflow}
        description="设计和发布流程，由对应业务绑定版本并在业务操作中发起。"
        designerLabel="设计流程"
        permission="Automation:Workflow"
        title="工作流"
        toolbarButtons={[
          {
            key: 'records',
            label: '运行记录',
            icon: <IconifyIcon icon="lucide:history" />,
            permissionCodes: ['Automation:Monitor:List'],
            onClick: async () => {
              await router.push('/automation/executions?kind=workflow');
            },
          },
        ]}
      />
    );
  },
});
