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
        createDefinition={emptyForm}
        designerLabel="设计表单"
        permission="Automation:Form"
        title="表单"
      />
    );
  },
});
