import { defineComponent } from 'vue';

import { emptyRule, ruleApi } from '#/api/rule-engine';
import DefinitionList from '#/components/kt-definition-list';

export default defineComponent({
  name: 'AutomationRules',
  setup() {
    return () => (
      <DefinitionList
        api={ruleApi}
        basePath="/automation/rules"
        createDefinition={emptyRule}
        designerLabel="设计规则"
        permission="Automation:Rule"
        title="规则"
      />
    );
  },
});
