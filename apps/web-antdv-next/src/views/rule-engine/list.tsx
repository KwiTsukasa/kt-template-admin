import { defineComponent } from 'vue';
import { emptyRule, ruleApi } from '#/api/rule-engine';
import DefinitionList from '#/components/kt-definition-list';

export default defineComponent({
  name: 'AutomationRules',
  setup() {
    return () => <DefinitionList title="规则" basePath="/automation/rules" permission="Automation:Rule" api={ruleApi} createDefinition={emptyRule} designerLabel="设计规则" />;
  },
});
