import { defineComponent } from 'vue';
import { useRouter } from 'vue-router';
import { emptyTrigger, triggerApi } from '#/api/trigger-engine';
import DefinitionList from '#/components/kt-definition-list';

export default defineComponent({
  name: 'AutomationTriggers',
  setup() {
    const router = useRouter();
    return () => (
      <DefinitionList
        title="触发器"
        basePath="/automation/triggers"
        permission="Automation:Trigger"
        api={triggerApi}
        createDefinition={emptyTrigger}
        designerLabel="配置触发器"
        extraActions={[
          {
            key: 'activity',
            label: '触发记录',
            permissionCodes: ['Automation:Trigger:List'],
            onClick: async (row) => {
              await router.push(`/automation/triggers/${row.id}/activity`);
            },
          },
        ]}
      />
    );
  },
});
