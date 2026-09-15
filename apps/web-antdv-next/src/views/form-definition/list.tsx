import { defineComponent } from 'vue';
import { emptyForm, formApi } from '#/api/form-definition';
import DefinitionList from '#/components/kt-definition-list';

export default defineComponent({
  name: 'AutomationForms',
  setup() {
    return () => <DefinitionList title="表单" basePath="/automation/forms" permission="Automation:Form" api={formApi} createDefinition={emptyForm} designerLabel="设计表单" />;
  },
});
