import { defineComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { emptyWorkflow, workflowApi } from '#/api/workflow-engine';
import DefinitionList from '#/components/kt-definition-list';

export default defineComponent({
  name: 'AutomationWorkflows',
  setup() {
    const router = useRouter();
    const route = useRoute();
    return () => (
      <DefinitionList
        api={workflowApi}
        basePath="/automation/workflows"
        createDefinition={emptyWorkflow}
        designerLabel="设计流程"
        extraActions={[
          {
            key: 'start',
            label: '发起',
            permissionCodes: ['Automation:Workflow:Run'],
            disabled: (row) => !row.publishedVersion,
            disabledReason: '请先发布工作流版本',
            onClick: async (row) => {
              await router.push({
                path: `/automation/workflows/${row.id}/start`,
                query: { returnTo: route.fullPath },
              });
            },
          },
        ]}
        permission="Automation:Workflow"
        title="工作流"
      />
    );
  },
});
