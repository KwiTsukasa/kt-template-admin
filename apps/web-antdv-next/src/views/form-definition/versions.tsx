import { defineComponent } from 'vue';

import { formApi } from '#/api/form-definition';
import Versions from '#/components/kt-definition-list/Versions';

export default defineComponent({
  name: 'AutomationFormVersions',
  setup() {
    return () => (
      <Versions
        api={formApi}
        basePath="/automation/forms"
        idKey="formId"
        title="表单"
      />
    );
  },
});
