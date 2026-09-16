import type { RuleDefinition } from '#/api/rule-engine';

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
        columns={[
          {
            title: '判断方式',
            key: 'mode',
            width: 150,
            render: (_value, record) => {
              if ((record.definition as RuleDefinition).mode === 'condition')
                return '条件树';
              return '决策表';
            },
          },
          {
            title: '事实与验证',
            key: 'facts',
            width: 180,
            render: (_value, record) => {
              const definition = record.definition as RuleDefinition;
              return (
                <div class="automation-definition-meta">
                  <span>{definition.factSchema.fields.length} 项事实</span>
                  <small>{definition.testCases.length} 个测试用例</small>
                </div>
              );
            },
          },
        ]}
        createDefinition={emptyRule}
        description="将业务判断变成可解释、可测试的条件与决策，供流程和触发准入复用。"
        designerLabel="设计规则"
        icon="lucide:git-branch"
        permission="Automation:Rule"
        title="规则"
      />
    );
  },
});
