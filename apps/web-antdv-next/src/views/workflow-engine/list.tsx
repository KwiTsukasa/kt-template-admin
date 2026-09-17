import type { BpmnContract, BpmnDefinition } from '#/api/workflow-engine/bpmn';

import { defineComponent } from 'vue';
import { useRouter } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import { workflowApi } from '#/api/workflow-engine';
import DefinitionList from '#/components/kt-definition-list';
import { BPMN_EXTENSION } from '#/constants/automation/bpmn';
import { AUTOMATION_PERMISSION } from '#/constants/automation/resources';
import {
  WORKFLOW_PATH,
  WORKFLOW_PERMISSION,
} from '#/constants/automation/workflow';

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
        api={workflowApi}
        basePath={WORKFLOW_PATH}
        columns={[
          {
            title: '流程结构',
            key: 'structure',
            width: 190,
            render: (_value, record) => {
              const definition = record.definition as BpmnDefinition;
              const contract =
                bpmnExtension<BpmnContract>(
                  bpmnProcess(definition),
                  BPMN_EXTENSION.Contract,
                ) ?? emptyBpmnContract();
              const count = [...indexBpmn(definition).values()].filter(
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
            },
          },
          {
            title: '业务表单',
            key: 'entry',
            width: 160,
            render: (_value, record) => {
              const contract = bpmnExtension<BpmnContract>(
                bpmnProcess(record.definition as BpmnDefinition),
                BPMN_EXTENSION.Contract,
              );
              if (contract?.formRef) return `表单 v${contract.formRef.version}`;
              return '由业务提供参数';
            },
          },
        ]}
        createDefinition={emptyBpmnWorkflow}
        designerLabel="设计流程"
        permission={WORKFLOW_PERMISSION}
        title="工作流"
        toolbarButtons={[
          {
            key: 'records',
            label: '运行记录',
            icon: <IconifyIcon icon="lucide:history" />,
            permissionCodes: [AUTOMATION_PERMISSION.monitorList],
            onClick: async () => {
              await router.push('/automation/executions?kind=workflow');
            },
          },
        ]}
      />
    );
  },
});
