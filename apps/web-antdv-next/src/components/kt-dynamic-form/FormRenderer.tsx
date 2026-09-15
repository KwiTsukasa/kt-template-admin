import type { PropType } from 'vue';
import type { FormDefinition } from '#/api/form-definition';
import { defineComponent, nextTick, watch } from 'vue';
import { useVbenForm } from '#/adapter/form';
import { toVbenFormSchema } from './schema-adapter';

export default defineComponent({
  name: 'KtDynamicFormRenderer',
  props: {
    definition: { type: Object as PropType<FormDefinition>, required: true },
    values: {
      type: Object as PropType<Record<string, unknown>>,
      default: () => ({}),
    },
    writableFields: { type: Array as PropType<string[]>, default: undefined },
  },
  setup(props, { expose }) {
    const [Form, formApi] = useVbenForm({
      showDefaultActions: false,
      layout: 'vertical',
      commonConfig: { emptyStateValue: undefined },
      schema: [],
    });
    const wrappers: Record<number, string> = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 md:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-3',
    };
    watch(
      () => [props.definition, props.writableFields],
      async () => {
        formApi.setState({
          schema: toVbenFormSchema(props.definition, props.writableFields),
          wrapperClass: wrappers[props.definition.uiSchema.columns],
        });
        await nextTick();
        await formApi.setValues(props.values);
      },
      { immediate: true, deep: true },
    );
    watch(
      () => props.values,
      async (values) => {
        await formApi.setValues(values);
      },
      { deep: true },
    );
    expose({
      validate: async () => {
        const values = await formApi.validateAndSubmitForm();
        if (!values) return undefined;
        const output: Record<string, unknown> = {};
        for (const field of props.definition.dataSchema.fields) {
          if (values[field.key] !== undefined && values[field.key] !== null)
            output[field.key] = values[field.key];
        }
        return output;
      },
    });
    return () => (
      <div class="kt-dynamic-form">
        <Form />
      </div>
    );
  },
});
