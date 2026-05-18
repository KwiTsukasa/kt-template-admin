import { defineComponent } from 'vue';

import TermManagement from '../modules/term-management';

export default defineComponent({
  name: 'BlogCategoryList',
  setup() {
    return () => <TermManagement kind="category" title="分类" />;
  },
});
