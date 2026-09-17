import { defineComponent } from 'vue';

import { ruleApi } from '#/api/rule-engine';
import Versions from '#/components/kt-definition-list/Versions';
import { AUTOMATION_PATH } from '#/constants/automation/resources';

export default defineComponent({
  name: 'AutomationRuleVersions',
  setup() {
    return () => (
      <Versions
        api={ruleApi}
        basePath={AUTOMATION_PATH.rules}
        idKey="ruleId"
        title="规则"
      />
    );
  },
});
