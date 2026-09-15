import type { PropType } from 'vue';
import type { DataField, DataScalar } from '#/api/automation/definition';
import { defineComponent } from 'vue';
import { DatePicker, Input, InputNumber, Select, Switch } from 'antdv-next';

export default defineComponent({
  name: 'ScalarValueInput',
  props: {
    field: { type: Object as PropType<DataField>, required: true },
    value: {
      type: [String, Number, Boolean] as PropType<DataScalar>,
      default: undefined,
    },
  },
  emits: { change: (_value: DataScalar | undefined) => true },
  setup(props, { emit }) {
    return () => {
      const field = props.field;
      if (field.options)
        return (
          <Select
            class="w-full"
            allowClear
            value={JSON.stringify(props.value)}
            options={field.options.map((item) => ({
              label: item.label,
              value: JSON.stringify(item.value),
            }))}
            onChange={(value) => {
              if (value === undefined) emit('change', undefined);
              else emit('change', JSON.parse(String(value)));
            }}
          />
        );
      if (field.type === 'boolean')
        return (
          <Switch
            checked={props.value === true}
            onChange={(value) => emit('change', Boolean(value))}
          />
        );
      if (field.type === 'integer' || field.type === 'number') {
        let precision: number | undefined;
        if (field.type === 'integer') precision = 0;
        return (
          <InputNumber
            class="w-full"
            value={props.value as number}
            precision={precision}
            min={field.min}
            max={field.max}
            onChange={(value) => {
              if (value === null) emit('change', undefined);
              else emit('change', Number(value));
            }}
          />
        );
      }
      if (field.format) {
        let format = 'YYYY-MM-DD';
        if (field.format === 'date-time') format = 'YYYY-MM-DDTHH:mm:ssZ';
        return (
          <DatePicker
            class="w-full"
            showTime={field.format === 'date-time'}
            valueFormat={format}
            value={props.value as string}
            onChange={(value) => {
              if (!value) emit('change', undefined);
              else emit('change', String(value));
            }}
          />
        );
      }
      return (
        <Input
          class="w-full"
          value={props.value as string}
          maxlength={field.max ?? 16384}
          onChange={(event) => emit('change', event.target.value || '')}
        />
      );
    };
  },
});
