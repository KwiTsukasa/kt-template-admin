import { defineComponent, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Alert } from 'antdv-next';

import {
  isBpmnDefinition,
  workflowDocumentApi,
} from '#/api/workflow-engine/bpmn';

import BpmnDesigner from './BpmnDesigner';

export default defineComponent({
  name: 'AutomationWorkflowDesigner',
  setup() {
    const route = useRoute();
    const error = ref('');
    const format = ref('');
    let request = 0;
    const load = async () => {
      const current = ++request;
      format.value = '';
      error.value = '';
      try {
        const document = await workflowDocumentApi.detail(
          String(route.params.workflowId),
        );
        if (current !== request) return;
        format.value = 'legacy';
        if (isBpmnDefinition(document.definition)) format.value = 'bpmn20';
      } catch (error_) {
        if (current === request) error.value = String(error_);
      }
    };
    onMounted(load);
    watch(() => route.params.workflowId, load);
    return () => (
      <div class="h-full min-h-0">
        {error.value && <Alert message={error.value} type="error" />}
        {format.value === 'bpmn20' && <BpmnDesigner />}
        {format.value === 'legacy' && (
          <Alert
            message="旧自定义图已停用，请重新建立 BPMN 2.0 流程"
            type="error"
          />
        )}
      </div>
    );
  },
});
