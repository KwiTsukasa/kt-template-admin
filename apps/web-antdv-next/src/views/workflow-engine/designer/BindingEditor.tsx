import type { PropType, VNode } from 'vue';
import type {
  DataField,
  DataSchema,
  DataScalar,
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
        { nodeId: string; name: string; schema: DataSchema }[]
      >,
      default: () => [],
    },
  },
  emits: { change: (_value: Record<string, ValueBinding>) => true },
  setup(props, { emit }) {
    const update = (key: string, binding?: ValueBinding) => {
      const values = { ...props.values };
      if (binding) values[key] = binding;
      else delete values[key];
      emit('change', values);
    };
    const defaultValue = (field: DataField): DataScalar => {
      if (field.options?.length) return field.options[0]!.value;
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
    ): VNode | null => {
      if (!binding) return null;
      if (binding.type === 'input')
        return (
          <Select
            class="w-full"
            placeholder="选择流程输入"
            value={binding.field}
            options={props.inputSchema.fields
              .filter((source) => compatible(source, field))
              .map((source) => ({ label: source.label, value: source.key }))}
            onChange={(value) =>
              update(field.key, { type: 'input', field: String(value) })
            }
          />
        );
      if (binding.type === 'node')
        return (
          <Select
            class="w-full"
            placeholder="选择上游字段"
            value={`${binding.nodeId}.${binding.field}`}
            options={props.outputs.flatMap((source) =>
              source.schema.fields
                .filter((item) => compatible(item, field))
                .map((item) => ({
                  label: `${source.name} · ${item.label}`,
                  value: `${source.nodeId}.${item.key}`,
                })),
            )}
            onChange={(value) => {
              const [nodeId, source] = String(value).split('.');
              update(field.key, {
                type: 'node',
                nodeId: nodeId || '',
                field: source || '',
              });
            }}
          />
        );
      return (
        <ScalarValueInput
          field={field}
          value={binding.value}
          onChange={(value) => {
            if (value === undefined) update(field.key);
            else update(field.key, { type: 'literal', value });
          }}
        />
      );
    };
    return () => (
      <div class="space-y-4">
        {props.fields.map((field) => (
          <div key={field.key} class="space-y-2">
            <label>
              {field.label}
              <span class="ml-2 text-muted-foreground">{field.type}</span>
            </label>
            <Select
              class="w-full"
              value={props.values[field.key]?.type || 'none'}
              options={sourceOptions}
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
            />
            {valueEditor(field, props.values[field.key])}
          </div>
        ))}
      </div>
    );
  },
});
