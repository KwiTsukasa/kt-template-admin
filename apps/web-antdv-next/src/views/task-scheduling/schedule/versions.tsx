import { defineComponent } from 'vue';
import { scheduleApi } from '#/api/task-scheduling/schedule';
import Versions from '#/components/kt-definition-list/Versions';

export default defineComponent({
  name: 'AutomationScheduleVersions',
  setup() {
    return () => (
      <Versions
        api={scheduleApi}
        idKey="scheduleId"
        basePath="/automation/schedules"
        title="调度计划"
      />
    );
  },
});
