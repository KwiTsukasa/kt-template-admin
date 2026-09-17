import type { TaskHandler } from '#/api/task-execution';

import { defineComponent, onMounted, ref } from 'vue';

import { z } from '#/adapter/form';
import { taskApi, taskFromHandler } from '#/api/task-execution';
import DefinitionList from '#/components/kt-definition-list';
import { AUTOMATION_PATH } from '#/constants/automation/resources';

export default defineComponent({
  name: 'AutomationTasks',
  setup() {
    const handlers = ref<TaskHandler[]>([]);
    onMounted(async () => {
      handlers.value = await taskApi.handlers();
    });
    const create = (values: Record<string, unknown>) => {
      const handler = handlers.value.find(
        (item) => `${item.key}@${item.version}` === values.handler,
      );
      if (!handler?.available) throw new Error('请选择当前可用的处理器版本');
      return taskFromHandler(handler);
    };
    return () => (
      <DefinitionList
        api={taskApi}
        basePath={AUTOMATION_PATH.tasks}
        createDefinition={create}
        creationFields={[
          {
            fieldName: 'handler',
            label: '执行能力',
            component: 'Select',
            rules: z.string().min(1, '请选择执行能力'),
            componentProps: {
              showSearch: true,
              optionFilterProp: 'label',
              placeholder: '选择系统或插件提供的执行能力',
              options: handlers.value.map((handler) => ({
                label: `${handler.name} · v${handler.version}`,
                value: `${handler.key}@${handler.version}`,
                disabled: !handler.available,
              })),
            },
          },
        ]}
        designerLabel="执行配置"
        permission="Automation:Task"
        title="执行动作"
      />
    );
  },
});
