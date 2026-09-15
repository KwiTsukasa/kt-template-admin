import { defineComponent } from 'vue';

import { triggerApi } from '#/api/trigger-engine';
import Versions from '#/components/kt-definition-list/Versions';

export default defineComponent({
  name: 'AutomationTriggerVersions',
  setup() {
    return () => (
      <Versions
        api={triggerApi}
        basePath="/automation/triggers"
        idKey="triggerId"
        title="触发器"
      />
    );
  },
});
