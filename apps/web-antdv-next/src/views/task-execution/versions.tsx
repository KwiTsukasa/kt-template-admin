import { defineComponent } from 'vue';

import { taskApi } from '#/api/task-execution';
import Versions from '#/components/kt-definition-list/Versions';
import { AUTOMATION_PATH } from '#/constants/automation/resources';

export default defineComponent({
  name: 'AutomationTaskVersions',
  setup() {
    return () => (
      <Versions
        api={taskApi}
        basePath={AUTOMATION_PATH.tasks}
        idKey="taskId"
        title="原子任务"
      />
    );
  },
});
