import type { PropType } from 'vue';

import type {
  DataSchema,
  PublishedReference,
} from '#/api/automation/definition';
import type { FormDefinition } from '#/api/form-definition';
import type { BpmnStep } from '#/api/workflow-engine/bpmn';

import { defineComponent, onBeforeUnmount, ref, watch } from 'vue';

import { Alert, Button, Select } from 'antdv-next';

import { formApi } from '#/api/form-definition';
import ReferencePicker from '#/components/kt-definition-list/ReferencePicker';

import BindingEditor from './BindingEditor';

type HumanStep = Extract<BpmnStep, { kind: 'human' }>;
export default defineComponent({
  name: 'BpmnHumanProperties',
  props: {
    value: { type: Object as PropType<HumanStep>, required: true },
    inputSchema: { type: Object as PropType<DataSchema>, required: true },
    iterationAvailable: { type: Boolean, default: false },
    businessSteps: {
      type: Array as PropType<{ key: string; name: string }[]>,
      default: () => [],
    },
    outputs: {
      type: Array as PropType<
        { name: string; nodeId: string; schema: DataSchema }[]
      >,
      required: true,
    },
  },
  emits: { change: (_step: HumanStep) => true },
  setup(props, { emit }) {
    const form = ref<FormDefinition>();
    const failure = ref('');
    let generation = 0;
    watch(
      () => props.value.formRef,
      async (reference) => {
        const current = ++generation;
        form.value = undefined;
        failure.value = '';
        if (!reference) return;
        try {
          const value = await formApi.version(reference.id, reference.version);
          if (current === generation) form.value = value;
        } catch {
          if (current === generation) failure.value = '固定表单版本读取失败';
        }
      },
      { immediate: true },
    );
    const choose = (formRef: null | PublishedReference) =>
      emit('change', {
        ...props.value,
        kind: 'human',
        formRef,
        writableFields: [],
        input: {},
      });
    onBeforeUnmount(() => {
      generation += 1;
    });
    return () => (
      <div class="space-y-4">
        {props.businessSteps.length > 0 && (
          <label class="block space-y-2">
            <span>业务确认</span>
            <Select
              allowClear
              class="w-full min-w-0"
              onChange={(businessKey) =>
                emit('change', {
                  ...props.value,
                  businessKey: businessKey as string | undefined,
                })
              }
              options={props.businessSteps.map((item) => ({
                label: item.name,
                value: item.key,
              }))}
              placeholder="选择业务确认能力"
              value={props.value.businessKey}
            />
          </label>
        )}
        <ReferencePicker
          api={formApi}
          basePath="/automation/forms"
          label="节点表单"
          onChange={choose}
          value={props.value.formRef}
        />
        <Button
          disabled={!props.value.formRef}
          onClick={() =>
            emit('change', {
              ...props.value,
              kind: 'human',
              formRef: null,
              writableFields: [],
              input: {},
            })
          }
          size="small"
        >
          改为确认节点
        </Button>
        {failure.value && <Alert message={failure.value} type="error" />}
        {form.value && (
          <>
            <label class="block space-y-2">
              <span>可填写字段</span>
              <Select
                class="w-full min-w-0"
                mode="multiple"
                onChange={(keys) =>
                  emit('change', {
                    ...props.value,
                    writableFields: keys as string[],
                  })
                }
                options={form.value.dataSchema.fields.map((field) => ({
                  label: field.label,
                  value: field.key,
                }))}
                value={props.value.writableFields}
              />
            </label>
            <BindingEditor
              fields={form.value.dataSchema.fields.map((field) => ({
                ...field,
                required:
                  field.required &&
                  !props.value.writableFields.includes(field.key),
              }))}
              inputSchema={props.inputSchema}
              iterationAvailable={props.iterationAvailable}
              onChange={(input) => emit('change', { ...props.value, input })}
              outputs={props.outputs}
              values={props.value.input}
            />
          </>
        )}
      </div>
    );
  },
});
