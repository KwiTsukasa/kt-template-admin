import { defineComponent } from 'vue';

import { ruleApi } from '#/api/rule-engine';
import Versions from '#/components/kt-definition-list/Versions';

export default defineComponent({
  name: 'AutomationRuleVersions',
  setup() {
    return () => (
      <Versions
        api={ruleApi}
        basePath="/automation/rules"
        idKey="ruleId"
        title="规则"
      />
    );
  },
});
