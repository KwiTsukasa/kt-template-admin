import { defineComponent } from 'vue';
import { taskApi } from '#/api/task-execution';
import Versions from '#/components/kt-definition-list/Versions';

export default defineComponent({
  name: 'AutomationTaskVersions',
  setup() {
    return () => (
      <Versions
        api={taskApi}
        idKey="taskId"
        basePath="/automation/tasks"
        title="原子任务"
      />
    );
  },
});
