import { defineComponent } from 'vue';

import { Fallback } from '@vben/common-ui';

export default defineComponent({
  name: 'FallbackOfflineDemo',
  setup() {
    return () => <Fallback status="offline" />;
  },
});
