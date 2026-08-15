import type { MediaGovernanceTaskDrawerExposed } from './components/MediaGovernanceTaskDrawer';
import type { MediaGovernanceTaskFormDrawerExposed } from './components/MediaGovernanceTaskFormDrawer';

import type { MediaGovernanceApi } from '#/api/media-governance';

import { defineComponent, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import MediaGovernanceTaskDrawer from './components/MediaGovernanceTaskDrawer';
import MediaGovernanceTaskFormDrawer from './components/MediaGovernanceTaskFormDrawer';

export default defineComponent({
  name: 'MediaGovernanceTaskDetail',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const detailDrawer = ref<MediaGovernanceTaskDrawerExposed>();
    const formDrawer = ref<MediaGovernanceTaskFormDrawerExposed>();

    function openCurrentTask() {
      const taskId = String(route.params.taskId || '');
      if (taskId) detailDrawer.value?.open(taskId);
    }

    function handleSaved(task: MediaGovernanceApi.Task) {
      detailDrawer.value?.open(task.id);
    }

    onMounted(openCurrentTask);

    return () => (
      <Page autoContentHeight>
        <MediaGovernanceTaskDrawer
          onClose={() => void router.replace('/media/governance/tasks')}
          onEdit={(task: MediaGovernanceApi.Task) =>
            formDrawer.value?.openEdit(task)
          }
          ref={detailDrawer}
        />
        <MediaGovernanceTaskFormDrawer onSaved={handleSaved} ref={formDrawer} />
      </Page>
    );
  },
});
