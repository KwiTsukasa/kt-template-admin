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
            allowClear
            class="w-full"
            onChange={(value) => {
              if (value === undefined) emit('change', undefined);
              else emit('change', JSON.parse(String(value)));
            }}
            options={field.options.map((item) => ({
              label: item.label,
              value: JSON.stringify(item.value),
            }))}
            value={JSON.stringify(props.value)}
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
            max={field.max}
            min={field.min}
            onChange={(value) => {
              if (value === null) emit('change', undefined);
              else emit('change', Number(value));
            }}
            precision={precision}
            value={props.value as number}
          />
        );
      }
      if (field.format) {
        let format = 'YYYY-MM-DD';
        if (field.format === 'date-time') format = 'YYYY-MM-DDTHH:mm:ssZ';
        return (
          <DatePicker
            class="w-full"
            onChange={(value) => {
              if (value) {
                emit('change', String(value));
              } else {
                emit('change', undefined);
              }
            }}
            showTime={field.format === 'date-time'}
            value={props.value as string}
            valueFormat={format}
          />
        );
      }
      return (
        <Input
          class="w-full"
          maxlength={field.max ?? 16_384}
          onChange={(event) => emit('change', event.target.value || '')}
          value={props.value as string}
        />
      );
    };
  },
});
