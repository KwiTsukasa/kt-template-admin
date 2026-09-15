import type { PropType, VNode } from 'vue';

import type {
  DataField,
  DataScalar,
  DataSchema,
} from '#/api/automation/definition';
import type { ValueBinding } from '#/api/workflow-engine';

import { defineComponent } from 'vue';

import { Select } from 'antdv-next';

import ScalarValueInput from '#/components/kt-dynamic-form/ScalarValueInput';

export default defineComponent({
  name: 'WorkflowBindingEditor',
  props: {
    fields: { type: Array as PropType<DataField[]>, required: true },
    values: {
      type: Object as PropType<Record<string, ValueBinding>>,
      required: true,
    },
    inputSchema: { type: Object as PropType<DataSchema>, required: true },
    outputs: {
      type: Array as PropType<
        { name: string; nodeId: string; schema: DataSchema }[]
      >,
      default: () => [],
    },
  },
  emits: { change: (_value: Record<string, ValueBinding>) => true },
  setup(props, { emit }) {
    const update = (key: string, binding?: ValueBinding) => {
      const values = Object.fromEntries(
        Object.entries(props.values).filter(([field]) => field !== key),
      );
      if (binding) values[key] = binding;

      emit('change', values);
    };
    const defaultValue = (field: DataField): DataScalar => {
      const option = field.options?.[0];
      if (option) return option.value;
      if (field.type === 'boolean') return false;
      if (field.type === 'number' || field.type === 'integer') return 0;
      return '';
    };
    const sourceOptions = [
      { label: '不传入', value: 'none' },
      { label: '固定值', value: 'literal' },
      { label: '流程输入', value: 'input' },
      { label: '上游输出', value: 'node' },
    ];
    const compatible = (source: DataField, target: DataField) =>
      source.type === target.type ||
      (source.type === 'integer' && target.type === 'number');
    const valueEditor = (
      field: DataField,
      binding?: ValueBinding,
    ): null | VNode => {
      if (!binding) return null;
      if (binding.type === 'input')
        return (
          <Select
            class="w-full"
            onChange={(value) =>
              update(field.key, { type: 'input', field: String(value) })
            }
            options={props.inputSchema.fields
              .filter((source) => compatible(source, field))
              .map((source) => ({ label: source.label, value: source.key }))}
            placeholder="选择流程输入"
            value={binding.field}
          />
        );
      if (binding.type === 'node')
        return (
          <Select
            class="w-full"
            onChange={(value) => {
              const [nodeId, source] = String(value).split('.');
              update(field.key, {
                type: 'node',
                nodeId: nodeId || '',
                field: source || '',
              });
            }}
            options={props.outputs.flatMap((source) =>
              source.schema.fields
                .filter((item) => compatible(item, field))
                .map((item) => ({
                  label: `${source.name} · ${item.label}`,
                  value: `${source.nodeId}.${item.key}`,
                })),
            )}
            placeholder="选择上游字段"
            value={`${binding.nodeId}.${binding.field}`}
          />
        );
      return (
        <ScalarValueInput
          field={field}
          onChange={(value) => {
            if (value === undefined) update(field.key);
            else update(field.key, { type: 'literal', value });
          }}
          value={binding.value}
        />
      );
    };
    return () => (
      <div class="space-y-4">
        {props.fields.map((field) => (
          <div class="space-y-2" key={field.key}>
            <label>
              {field.label}
              <span class="ml-2 text-muted-foreground">{field.type}</span>
            </label>
            <Select
              class="w-full"
              onChange={(type) => {
                if (type === 'none') update(field.key);
                if (type === 'literal')
                  update(field.key, {
                    type: 'literal',
                    value: defaultValue(field),
                  });
                if (type === 'input')
                  update(field.key, { type: 'input', field: '' });
                if (type === 'node')
                  update(field.key, { type: 'node', nodeId: '', field: '' });
              }}
              options={sourceOptions}
              value={props.values[field.key]?.type || 'none'}
            />
            {valueEditor(field, props.values[field.key])}
          </div>
        ))}
      </div>
    );
  },
});
