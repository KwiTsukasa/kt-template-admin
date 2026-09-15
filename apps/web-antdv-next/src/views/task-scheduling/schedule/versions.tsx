import { defineComponent } from 'vue';

import { scheduleApi } from '#/api/task-scheduling/schedule';
import Versions from '#/components/kt-definition-list/Versions';

export default defineComponent({
  name: 'AutomationScheduleVersions',
  setup() {
    return () => (
      <Versions
        api={scheduleApi}
        basePath="/automation/schedules"
        idKey="scheduleId"
        title="调度计划"
      />
    );
  },
});
