import { defineComponent } from 'vue';

import TermManagement from '../modules/term-management';

export default defineComponent({
  name: 'BlogTagList',
  setup() {
    return () => <TermManagement kind="tag" title="标签" />;
  },
});
