import { defineComponent } from 'vue';

import { triggerApi } from '#/api/trigger-engine';
import Versions from '#/components/kt-definition-list/Versions';
import { AUTOMATION_PATH } from '#/constants/automation/resources';

export default defineComponent({
  name: 'AutomationTriggerVersions',
  setup() {
    return () => (
      <Versions
        api={triggerApi}
        basePath={AUTOMATION_PATH.triggers}
        idKey="triggerId"
        title="触发器"
      />
    );
  },
});
