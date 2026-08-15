import { defineComponent } from 'vue';

import { Fallback } from '@vben/common-ui';

export default defineComponent({
  name: 'Fallback403Demo',
  setup() {
    return () => <Fallback status="403" />;
  },
});
