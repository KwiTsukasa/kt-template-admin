import type { PropType, VNode } from 'vue';

import type {
  DataField,
  DataScalar,
  DataSchema,
} from '#/api/automation/definition';
import type { ValueBinding, ValueReference } from '#/api/workflow-engine';

import { defineComponent } from 'vue';

import { Button, Select } from 'antdv-next';

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
    inheritedFields: { type: Array as PropType<string[]>, default: () => [] },
    iterationAvailable: { type: Boolean, default: false },
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
      if (field.type === 'number' || field.type === 'integer')
        return field.min ?? 0;
      return '';
    };
    const sourceOptions = [
      { label: '不传入', value: 'none' },
      { label: '固定值', value: 'literal' },
      { label: '流程输入', value: 'input' },
      { label: '上游输出', value: 'node' },
      { label: '优先取值', value: 'first' },
    ];
    const bindingSource = (key: string) => {
      if (props.inheritedFields.includes(key)) return 'business';
      return props.values[key]?.type || 'none';
    };
    const bindingOptions = (field: DataField) => {
      if (props.inheritedFields.includes(field.key))
        return [{ label: '由业务步骤提供', value: 'business' }];
      return [
        ...sourceOptions,
        {
          label: '当前循环序号',
          value: 'iteration',
          disabled:
            !props.iterationAvailable ||
            !['integer', 'number'].includes(field.type),
        },
      ];
    };
    const compatible = (source: DataField, target: DataField) =>
      source.type === target.type ||
      (source.type === 'integer' && target.type === 'number');
    const valueEditor = (
      field: DataField,
      binding?: ValueBinding,
    ): null | VNode => {
      if (!binding) return null;
      if (binding.type === 'iteration') return null;
      if (binding.type === 'first') {
        const options = [
          ...props.inputSchema.fields
            .filter((source) => compatible(source, field))
            .map((source) => ({
              label: `流程输入 · ${source.label}`,
              value: JSON.stringify({ type: 'input', field: source.key }),
            })),
          ...props.outputs.flatMap((source) =>
            source.schema.fields
              .filter((item) => compatible(item, field))
              .map((item) => ({
                label: `${source.name} · ${item.label}`,
                value: JSON.stringify({
                  type: 'node',
                  nodeId: source.nodeId,
                  field: item.key,
                }),
              })),
          ),
        ];
        return (
          <div class="space-y-2">
            {binding.sources.map((source, index) => (
              <div class="flex min-w-0 items-center gap-1" key={index}>
                <span>{index + 1}</span>
                <Select
                  aria-label={`${field.label}优先来源${index + 1}`}
                  class="min-w-0 flex-1"
                  onChange={(value) => {
                    const sources = [...binding.sources];
                    sources[index] = JSON.parse(
                      String(value),
                    ) as ValueReference;
                    update(field.key, { type: 'first', sources });
                  }}
                  options={options}
                  value={JSON.stringify(source)}
                />
                <Button
                  disabled={index === 0}
                  onClick={() => {
                    const sources = [...binding.sources];
                    const previous = sources[index - 1];
                    if (!previous) return;
                    sources[index - 1] = source;
                    sources[index] = previous;
                    update(field.key, { type: 'first', sources });
                  }}
                  size="small"
                >
                  上移
                </Button>
                <Button
                  danger
                  onClick={() =>
                    update(field.key, {
                      type: 'first',
                      sources: binding.sources.filter(
                        (_, position) => position !== index,
                      ),
                    })
                  }
                  size="small"
                >
                  删除
                </Button>
              </div>
            ))}
            <Button
              disabled={options.length === 0 || binding.sources.length >= 8}
              onClick={() => {
                const option = options[0];
                if (option)
                  update(field.key, {
                    type: 'first',
                    sources: [
                      ...binding.sources,
                      JSON.parse(option.value) as ValueReference,
                    ],
                  });
              }}
              size="small"
            >
              添加来源
            </Button>
          </div>
        );
      }
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
              {field.required && <span class="ml-1 text-destructive">*</span>}
              <span class="ml-2 text-muted-foreground">{field.type}</span>
            </label>
            <Select
              class="w-full"
              disabled={props.inheritedFields.includes(field.key)}
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
                if (type === 'iteration')
                  update(field.key, { type: 'iteration' });
                if (type === 'first')
                  update(field.key, { type: 'first', sources: [] });
              }}
              options={bindingOptions(field)}
              value={bindingSource(field.key)}
            />
            {valueEditor(field, props.values[field.key])}
          </div>
        ))}
      </div>
    );
  },
});
