import type { PropType } from 'vue';

import type {
  DataField,
  DataScalar,
  DataSchema,
} from '#/api/automation/definition';
import type { ScheduleBinding } from '#/api/task-scheduling/schedule';

import { computed, defineComponent } from 'vue';

import { Alert, Select } from 'antdv-next';

import {
  fieldOptionsKey,
  indexFieldOptions,
} from '#/components/kt-dynamic-form/field-options';
import ScalarValueInput from '#/components/kt-dynamic-form/ScalarValueInput';

const metadataFields: DataField[] = [
  { key: 'id', label: '发生记录 ID', type: 'string', required: true },
  { key: 'registrationId', label: '注册 ID', type: 'string', required: true },
  {
    key: 'occurredAt',
    label: '发生时间',
    type: 'string',
    required: true,
    format: 'date-time',
  },
];

export default defineComponent({
  name: 'ScheduleBindingEditor',
  props: {
    schema: { type: Object as PropType<DataSchema>, required: true },
    eventSchema: { type: Object as PropType<DataSchema>, required: true },
    values: {
      type: Object as PropType<Record<string, ScheduleBinding>>,
      required: true,
    },
  },
  emits: { change: (_value: Record<string, ScheduleBinding>) => true },
  setup(props, { emit }) {
    const metadataOptions = indexFieldOptions(metadataFields);
    const eventOptions = computed(() =>
      indexFieldOptions(props.eventSchema.fields),
    );
    const update = (key: string, binding?: ScheduleBinding) => {
      const values = Object.fromEntries(
        Object.entries(props.values).filter(([field]) => field !== key),
      );
      if (binding) values[key] = binding;

      emit('change', values);
    };
    const defaultValue = (field: DataField): DataScalar => {
      if (field.options?.[0]) return field.options[0].value;
      if (field.type === 'boolean') return false;
      if (field.type === 'number' || field.type === 'integer')
        return field.min || 0;
      return '';
    };
    const valueInput = (field: DataField, binding?: ScheduleBinding) => {
      if (!binding) return null;
      if (binding.source === 'literal')
        return (
          <ScalarValueInput
            field={field}
            onChange={(value) => {
              if (value === undefined) update(field.key);
              else update(field.key, { source: 'literal', value });
            }}
            value={binding.value}
          />
        );
      let options = metadataOptions;
      if (binding.source === 'event') options = eventOptions.value;
      return (
        <Select
          class="w-full"
          onChange={(value) => {
            if (binding.source === 'event')
              update(field.key, { source: 'event', field: String(value) });
            else if (
              value === 'id' ||
              value === 'registrationId' ||
              value === 'occurredAt'
            )
              update(field.key, { source: 'occurrence', field: value });
          }}
          options={options.get(fieldOptionsKey(field, true)) ?? []}
          placeholder="选择来源字段"
          value={binding.field || undefined}
        />
      );
    };
    return () => (
      <div class="space-y-4">
        {props.schema.fields.length === 0 && (
          <Alert message="该资源无需传入字段。" type="info" />
        )}
        {props.schema.fields.map((field) => (
          <div class="space-y-2 rounded border p-3" key={field.key}>
            <label>
              {field.label}
              <span class="ml-2 text-muted-foreground">
                {field.type}
                {field.required && ' · 必填'}
              </span>
            </label>
            <div class="grid gap-2 md:grid-cols-[160px_1fr]">
              <Select
                onChange={(source) => {
                  if (source === 'none') update(field.key);
                  if (source === 'literal')
                    update(field.key, { source, value: defaultValue(field) });
                  if (source === 'event')
                    update(field.key, { source, field: '' });
                  if (source === 'occurrence') {
                    const first = metadataOptions.get(
                      fieldOptionsKey(field, true),
                    )?.[0];
                    if (first)
                      update(field.key, {
                        source,
                        field: first.value as
                          | 'id'
                          | 'occurredAt'
                          | 'registrationId',
                      });
                  }
                }}
                options={[
                  { label: '不传入', value: 'none' },
                  { label: '固定值', value: 'literal' },
                  {
                    label: '事件字段',
                    value: 'event',
                    disabled: !eventOptions.value.has(
                      fieldOptionsKey(field, true),
                    ),
                  },
                  {
                    label: '发生记录信息',
                    value: 'occurrence',
                    disabled: !metadataOptions.has(
                      fieldOptionsKey(field, true),
                    ),
                  },
                ]}
                value={props.values[field.key]?.source || 'none'}
              />
              {valueInput(field, props.values[field.key])}
            </div>
          </div>
        ))}
      </div>
    );
  },
});
