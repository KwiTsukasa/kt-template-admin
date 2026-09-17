import { defineComponent } from 'vue';

import { formApi } from '#/api/form-definition';
import Versions from '#/components/kt-definition-list/Versions';
import { AUTOMATION_PATH } from '#/constants/automation/resources';

export default defineComponent({
  name: 'AutomationFormVersions',
  setup() {
    return () => (
      <Versions
        api={formApi}
        basePath={AUTOMATION_PATH.forms}
        idKey="formId"
        title="表单"
      />
    );
  },
});
