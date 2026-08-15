import { defineComponent } from 'vue';

import { About } from '@vben/common-ui';

export default defineComponent({
  name: 'AboutPage',
  setup() {
    return () => <About />;
  },
});
