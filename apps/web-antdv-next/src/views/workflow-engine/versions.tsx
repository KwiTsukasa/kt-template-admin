import { defineComponent } from 'vue';
import { workflowApi } from '#/api/workflow-engine';
import Versions from '#/components/kt-definition-list/Versions';

export default defineComponent({
  name: 'AutomationWorkflowVersions',
  setup() {
    return () => (
      <Versions
        api={workflowApi}
        idKey="workflowId"
        basePath="/automation/workflows"
        title="工作流"
      />
    );
  },
});
