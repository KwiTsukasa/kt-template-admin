import { defineComponent } from 'vue';

import { scheduleApi } from '#/api/task-scheduling/schedule';
import Versions from '#/components/kt-definition-list/Versions';
import { AUTOMATION_PATH } from '#/constants/automation/resources';

export default defineComponent({
  name: 'AutomationScheduleVersions',
  setup() {
    return () => (
      <Versions
        api={scheduleApi}
        basePath={AUTOMATION_PATH.schedules}
        idKey="scheduleId"
        title="调度计划"
      />
    );
  },
});
