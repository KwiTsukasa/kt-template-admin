import type { PropType } from 'vue';

import type { PluginPlatformTaskApi } from '#/api/plugin-platform/task';

import { defineComponent, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm, z } from '#/adapter/form';
import { updatePluginTaskCron } from '#/api/plugin-platform/task';

import CronEditorAntdvNext from './CronEditorAntdvNext';

interface CronFormValues {
  cronExpression: string;
}

export default defineComponent({
  name: 'PluginPlatformTaskCronModal',
  props: {
    open: {
      default: false,
      type: Boolean,
    },
    task: {
      default: undefined,
      type: Object as PropType<PluginPlatformTaskApi.Task | undefined>,
    },
  },
  emits: ['close', 'saved'],
  setup(props, { emit }) {
    const valid = ref(true);
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[620px]',
      confirmText: '保存',
      fullscreenButton: false,
      /**
       * 确认 Cron 弹窗时校验表达式并更新当前插件任务。
       */
      async onConfirm() {
        await save();
      },
      /**
       * 用户从通用 Modal 关闭弹窗时同步外部受控 open 状态。
       *
       * @param isOpen - 通用 Modal 最新显隐状态。
       */
      onOpenChange(isOpen: boolean) {
        if (isOpen) {
          const { task } = modalApi.getData<{
            task?: PluginPlatformTaskApi.Task;
          }>();
          void resetCronForm(task);
          return;
        }
        if (props.open) emit('close');
      },
    });
    const [CronForm, formApi] = useVbenForm({
      layout: 'vertical',
      schema: [
        {
          component: CronEditorAntdvNext as any,
          componentProps: {
            /**
             * 把 Cron 编辑器语法结果同步到通用 Modal 确认按钮。
             *
             * @param value - 当前 Cron 表达式是否通过编辑器校验。
             */
            onValidChange(value: boolean) {
              valid.value = value;
              modalApi.setState({ confirmDisabled: !value });
            },
          },
          fieldName: 'cronExpression',
          hideLabel: true,
          label: 'Cron 表达式',
          rules: z.string().trim().min(1, '请输入 Cron 表达式'),
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });

    watch(
      () => [props.open, props.task?.id],
      async () => {
        if (!props.open) {
          await modalApi.close();
          return;
        }
        modalApi
          .setData({ task: props.task })
          .setState({ confirmDisabled: false })
          .open();
      },
      { immediate: true },
    );

    /**
     * 在 Cron Modal 已挂载后按当前任务恢复表达式、有效态与校验状态。
     *
     * @param task - 当前要编辑的插件任务；缺失时使用六小时默认表达式。
     */
    async function resetCronForm(task?: PluginPlatformTaskApi.Task) {
      await formApi.resetForm();
      await formApi.setValues({
        cronExpression:
          task?.cronExpression || task?.defaultCron || '0 */6 * * *',
      } satisfies CronFormValues);
      await formApi.resetValidate();
      valid.value = true;
      modalApi.setState({ confirmDisabled: false });
    }

    /**
     * 仅在任务存在且 cron 有效时保存表达式，成功后提示并派发 saved。
     */
    async function save() {
      if (!props.task || !valid.value) return;
      const { valid: formValid } = await formApi.validate();
      if (!formValid) return;
      const values = await formApi.getValues<CronFormValues>();
      modalApi.lock();
      try {
        await updatePluginTaskCron(props.task.id, values.cronExpression.trim());
        await modalApi.close();
        message.success('Cron 已更新');
        emit('saved');
      } finally {
        modalApi.unlock();
      }
    }

    return () => (
      <Modal title="修改 Cron">
        <CronForm />
      </Modal>
    );
  },
});
