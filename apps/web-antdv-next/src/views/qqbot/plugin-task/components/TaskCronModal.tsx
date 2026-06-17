import type { PropType } from 'vue';

import type { QqbotPluginTaskApi } from '#/api/qqbot/plugin-task';

import { defineComponent, ref, watch } from 'vue';

import { message, Modal } from 'antdv-next';

import { updateQqbotPluginTaskCron } from '#/api/qqbot/plugin-task';

import CronEditorAntdvNext from './CronEditorAntdvNext';

const AModal = Modal as any;

export default defineComponent({
  name: 'QqBotPluginTaskCronModal',
  props: {
    open: {
      default: false,
      type: Boolean,
    },
    task: {
      default: undefined,
      type: Object as PropType<QqbotPluginTaskApi.Task | undefined>,
    },
  },
  emits: ['close', 'saved'],
  setup(props, { emit }) {
    const cronExpression = ref('0 */6 * * *');
    const valid = ref(true);
    const saving = ref(false);

    watch(
      () => [props.open, props.task?.id],
      () => {
        cronExpression.value =
          props.task?.cronExpression ||
          props.task?.defaultCron ||
          '0 */6 * * *';
        valid.value = true;
      },
      { immediate: true },
    );

    async function save() {
      if (!props.task || !valid.value) return;
      saving.value = true;
      try {
        await updateQqbotPluginTaskCron(props.task.id, cronExpression.value);
        message.success('Cron 已更新');
        emit('saved');
      } finally {
        saving.value = false;
      }
    }

    return () => (
      <AModal
        confirmLoading={saving.value}
        okButtonProps={{ disabled: !valid.value }}
        onCancel={() => emit('close')}
        onOk={() => void save()}
        open={props.open}
        title="修改 Cron"
        width={620}
      >
        <CronEditorAntdvNext
          onUpdate:value={(value: string) => {
            cronExpression.value = value;
          }}
          onValidChange={(value: boolean) => {
            valid.value = value;
          }}
          value={cronExpression.value}
        />
      </AModal>
    );
  },
});
