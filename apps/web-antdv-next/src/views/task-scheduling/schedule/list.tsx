import { defineComponent } from 'vue';
import { useRouter } from 'vue-router';

import { emptySchedule, scheduleApi } from '#/api/task-scheduling/schedule';
import DefinitionList from '#/components/kt-definition-list';

export default defineComponent({
  name: 'AutomationSchedules',
  setup() {
    const router = useRouter();
    return () => (
      <DefinitionList
        api={scheduleApi}
        basePath="/automation/schedules"
        createDefinition={emptySchedule}
        designerLabel="配置计划"
        extraActions={[
          {
            key: 'control',
            label: '启停与记录',
            permissionCodes: ['Automation:Schedule:List'],
            onClick: async (row) => {
              await router.push(`/automation/schedules/${row.id}/control`);
            },
          },
        ]}
        permission="Automation:Schedule"
        title="调度计划"
      />
    );
  },
});
