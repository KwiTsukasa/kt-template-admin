import type { MediaGovernanceTaskDrawerExposed } from './components/MediaGovernanceTaskDrawer';

import { defineComponent, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import MediaGovernanceTaskDrawer from './components/MediaGovernanceTaskDrawer';

export default defineComponent({
  name: 'MediaGovernanceTaskDetail',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const detailDrawer = ref<MediaGovernanceTaskDrawerExposed>();

    /**
     * 从当前路由读取任务标识并打开详情抽屉。
     */
    function openCurrentTask() {
      const taskId = String(route.params.taskId || '');
      if (taskId) detailDrawer.value?.open(taskId);
    }

    onMounted(openCurrentTask);

    return () => (
      <Page autoContentHeight>
        <MediaGovernanceTaskDrawer
          onClose={() => void router.replace('/media/governance/tasks')}
          readOnly
          ref={detailDrawer}
        />
      </Page>
    );
  },
});
