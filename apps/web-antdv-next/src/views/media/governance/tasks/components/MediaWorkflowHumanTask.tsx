import type { PropType } from 'vue';

import type { MediaWorkflowHumanTask } from '#/api/media-governance/workflow';

import { defineComponent, ref } from 'vue';

import { Button, message } from 'antdv-next';

import FormRenderer from '#/components/kt-dynamic-form/FormRenderer';

export default defineComponent({
  name: 'MediaWorkflowHumanTask',
  props: {
    task: { type: Object as PropType<MediaWorkflowHumanTask>, required: true },
    disabled: { type: Boolean, default: false },
    submit: {
      type: Function as PropType<
        (values: Record<string, unknown>) => Promise<void>
      >,
      required: true,
    },
  },
  setup(props) {
    const form = ref<{
      validate: () => Promise<Record<string, unknown> | undefined>;
    }>();
    const saving = ref(false);
    const submit = async () => {
      if (saving.value || props.disabled) return;
      saving.value = true;
      try {
        let values: Record<string, unknown> = { confirmed: true };
        if (props.task.form) {
          const full = await form.value?.validate();
          if (!full) return;
          values = Object.fromEntries(
            Object.entries(full).filter(([key]) =>
              props.task.writableFields.includes(key),
            ),
          );
        }
        await props.submit(values);
      } catch (error) {
        message.error((error instanceof Error && error.message) || '提交失败');
      } finally {
        saving.value = false;
      }
    };
    return () => {
      let label = '确认';
      if (props.task.form) label = '提交';
      return (
        <section class="min-w-0 space-y-4 rounded-lg border p-4">
          <strong>{props.task.name}</strong>
          {props.task.form && (
            <FormRenderer
              definition={props.task.form}
              ref={form}
              values={props.task.values}
              writableFields={props.task.writableFields}
            />
          )}
          <Button
            disabled={props.disabled}
            loading={saving.value}
            onClick={submit}
            type="primary"
          >
            {label}
          </Button>
        </section>
      );
    };
  },
});
