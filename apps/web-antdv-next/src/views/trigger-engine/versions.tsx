import { defineComponent } from 'vue';
import { triggerApi } from '#/api/trigger-engine';
import Versions from '#/components/kt-definition-list/Versions';

export default defineComponent({
  name: 'AutomationTriggerVersions',
  setup() {
    return () => (
      <Versions
        api={triggerApi}
        idKey="triggerId"
        basePath="/automation/triggers"
        title="触发器"
      />
    );
  },
});
