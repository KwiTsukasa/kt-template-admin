import { defineComponent } from 'vue';

import { Fallback } from '@vben/common-ui';

export default defineComponent({
  name: 'Fallback500Demo',
  setup() {
    return () => <Fallback status="500" />;
  },
});
