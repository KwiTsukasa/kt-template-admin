import type { PropType } from 'vue';

import type {
  DataSchema,
  PublishedReference,
} from '#/api/automation/definition';
import type { FormDefinition } from '#/api/form-definition';
import type { WorkflowProcessCapability } from '#/api/workflow-engine';
import type { BpmnContract } from '#/api/workflow-engine/bpmn';

import { computed, defineComponent, onBeforeUnmount, ref, watch } from 'vue';

import { Alert, Button, InputNumber, Select } from 'antdv-next';

import { formApi } from '#/api/form-definition';
import ReferencePicker from '#/components/kt-definition-list/ReferencePicker';
import DataSchemaEditor from '#/components/kt-dynamic-form/DataSchemaEditor';
import {
  fieldOptionsKey,
  indexFieldOptions,
} from '#/components/kt-dynamic-form/field-options';
import { AUTOMATION_PATH } from '#/constants/automation/resources';

import BindingEditor from './BindingEditor';

export default defineComponent({
  name: 'BpmnContractEditor',
  props: {
    value: { type: Object as PropType<BpmnContract>, required: true },
    process: {
      type: Object as PropType<WorkflowProcessCapability>,
      default: undefined,
    },
    outputs: {
      type: Array as PropType<
        { name: string; nodeId: string; schema: DataSchema }[]
      >,
      default: () => [],
    },
  },
  emits: { change: (_value: BpmnContract) => true },
  setup(props, { emit }) {
    const form = ref<FormDefinition>();
    const failure = ref('');
    const formOptions = computed(() =>
      indexFieldOptions(form.value?.dataSchema.fields ?? [], true),
    );
    let generation = 0;
    const submissionSchema = computed(() => {
      if (props.value.processRef)
        return props.process?.launchSchema ?? { fields: [] };
      return props.value.inputSchema;
    });
    const update = (patch: Partial<BpmnContract>) =>
      emit('change', { ...props.value, ...patch });
    const chooseForm = (formRef: null | PublishedReference) =>
      update({ formRef, formMapping: {} });
    watch(
      () => props.value.formRef,
      async (reference) => {
        const current = ++generation;
        form.value = undefined;
        failure.value = '';
        if (!reference) return;
        try {
          const result = await formApi.version(reference.id, reference.version);
          if (current === generation) form.value = result;
        } catch {
          if (current === generation) failure.value = '表单固定版本加载失败';
        }
      },
      { immediate: true, deep: true },
    );
    onBeforeUnmount(() => {
      generation++;
    });
    const fields = (schema: DataSchema) =>
      schema.fields.map((field) => (
        <div class="flex justify-between gap-2 text-sm" key={field.key}>
          <span>
            {field.label}
            {field.required && <span class="text-destructive"> *</span>}
          </span>
          <span class="text-muted-foreground">{field.type}</span>
        </div>
      ));
    return () => (
      <div class="space-y-4">
        <label class="block space-y-2">
          <span>流程总期限（秒）</span>
          <InputNumber
            class="w-full"
            max={2_678_400}
            min={1}
            onChange={(value) => {
              if (value !== null) update({ timeoutMs: Number(value) * 1000 });
            }}
            value={props.value.timeoutMs / 1000}
          />
        </label>
        {!props.value.processRef && (
          <>
            <ReferencePicker
              api={formApi}
              basePath={AUTOMATION_PATH.forms}
              label="业务表单"
              onChange={chooseForm}
              value={props.value.formRef}
            />
            <Button
              disabled={!props.value.formRef}
              onClick={() => chooseForm(null)}
              size="small"
            >
              解除表单绑定
            </Button>
            {failure.value && <Alert message={failure.value} type="error" />}
            {props.value.formRef && (
              <section class="space-y-3">
                <strong>表单字段映射</strong>
                {submissionSchema.value.fields.map((field) => (
                  <label class="block space-y-2" key={field.key}>
                    <span>
                      {field.label}
                      {field.required && (
                        <span class="text-destructive"> *</span>
                      )}
                    </span>
                    <Select
                      allowClear
                      class="w-full"
                      onChange={(value) => {
                        const formMapping = Object.fromEntries(
                          Object.entries(props.value.formMapping).filter(
                            ([key]) => key !== field.key,
                          ),
                        );
                        if (value) formMapping[field.key] = String(value);
                        update({ formMapping });
                      }}
                      options={
                        formOptions.value.get(fieldOptionsKey(field)) ?? []
                      }
                      placeholder="选择表单字段"
                      value={props.value.formMapping[field.key]}
                    />
                  </label>
                ))}
              </section>
            )}
          </>
        )}
        <section class="space-y-3">
          <strong>流程输入</strong>
          {props.value.processRef && fields(props.value.inputSchema)}
          {!props.value.processRef && (
            <DataSchemaEditor
              onChange={(inputSchema) => {
                const keys = new Set(
                  inputSchema.fields.map((field) => field.key),
                );
                update({
                  inputSchema,
                  formMapping: Object.fromEntries(
                    Object.entries(props.value.formMapping).filter(([key]) =>
                      keys.has(key),
                    ),
                  ),
                });
              }}
              schema={props.value.inputSchema}
            />
          )}
        </section>
        <section class="space-y-3">
          <strong>流程结果</strong>
          {props.value.processRef && fields(props.value.outputSchema)}
          {!props.value.processRef && (
            <DataSchemaEditor
              onChange={(outputSchema) => {
                const keys = new Set(
                  outputSchema.fields.map((field) => field.key),
                );
                update({
                  outputSchema,
                  output: Object.fromEntries(
                    Object.entries(props.value.output).filter(([key]) =>
                      keys.has(key),
                    ),
                  ),
                });
              }}
              schema={props.value.outputSchema}
            />
          )}
          <BindingEditor
            fields={props.value.outputSchema.fields}
            inputSchema={props.value.inputSchema}
            onChange={(output) => update({ output })}
            outputs={props.outputs}
            values={props.value.output}
          />
        </section>
      </div>
    );
  },
});
