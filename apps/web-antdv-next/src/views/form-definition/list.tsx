import type { FormDefinition } from '#/api/form-definition';

import { defineComponent } from 'vue';

import { emptyForm, formApi } from '#/api/form-definition';
import DefinitionList from '#/components/kt-definition-list';

export default defineComponent({
  name: 'AutomationForms',
  setup() {
    return () => (
      <DefinitionList
        api={formApi}
        basePath="/automation/forms"
        columns={[
          {
            title: '字段结构',
            key: 'fields',
            width: 190,
            render: (_value, record) => {
              const definition = record.definition as FormDefinition;
              return (
                <div class="automation-definition-meta">
                  <span>{definition.dataSchema.fields.length} 个字段</span>
                  <small>
                    {
                      definition.dataSchema.fields.filter(
                        (field) => field.required,
                      ).length
                    }{' '}
                    项必填
                  </small>
                </div>
              );
            },
          },
          {
            title: '布局',
            key: 'layout',
            width: 140,
            render: (_value, record) =>
              `${(record.definition as FormDefinition).uiSchema.columns} 列布局`,
          },
        ]}
        createDefinition={emptyForm}
        description="设计业务填写入口，统一字段、布局与校验，再供工作流绑定使用。"
        designerLabel="设计表单"
        icon="lucide:panels-top-left"
        permission="Automation:Form"
        title="表单"
      />
    );
  },
});
