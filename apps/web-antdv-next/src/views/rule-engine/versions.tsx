import { defineComponent } from 'vue';
import { ruleApi } from '#/api/rule-engine';
import Versions from '#/components/kt-definition-list/Versions';

export default defineComponent({
  name: 'AutomationRuleVersions',
  setup() {
    return () => <Versions api={ruleApi} idKey="ruleId" basePath="/automation/rules" title="规则" />;
  },
});
