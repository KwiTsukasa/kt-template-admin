import { defineComponent } from 'vue';

import { workflowApi } from '#/api/workflow-engine';
import Versions from '#/components/kt-definition-list/Versions';
import { AUTOMATION_PATH } from '#/constants/automation/resources';

export default defineComponent({
  name: 'AutomationWorkflowVersions',
  setup() {
    return () => (
      <Versions
        api={workflowApi}
        basePath={AUTOMATION_PATH.workflows}
        idKey="workflowId"
        title="工作流"
      />
    );
  },
});
