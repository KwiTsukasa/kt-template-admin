import { defineComponent } from 'vue';

import { Fallback } from '@vben/common-ui';

export default defineComponent({
  name: 'FallbackComingSoonDemo',
  setup() {
    return () => <Fallback status="coming-soon" />;
  },
});
