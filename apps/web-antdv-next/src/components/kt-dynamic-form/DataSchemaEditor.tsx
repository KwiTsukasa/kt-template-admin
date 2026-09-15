import type { PropType } from 'vue';

import type { DataField, DataSchema } from '#/api/automation/definition';

import { computed, defineComponent, ref } from 'vue';

import { Button, Card, Empty, Space } from 'antdv-next';

import FieldSchemaEditor from './FieldSchemaEditor';

export default defineComponent({
  name: 'KtDataSchemaEditor',
  props: { schema: { type: Object as PropType<DataSchema>, required: true } },
  emits: { change: (_schema: DataSchema) => true },
  setup(props, { emit }) {
    const selected = ref(0);
    const current = computed(() => props.schema.fields[selected.value]);
    const buttonType = (index: number) => {
      if (selected.value === index) return 'primary';
      return 'default';
    };
    const update = (field: DataField) => {
      const fields = [...props.schema.fields];
      fields[selected.value] = field;
      emit('change', { fields });
    };
    const add = () => {
      let number = props.schema.fields.length + 1;
      while (
        props.schema.fields.some((field) => field.key === `field_${number}`)
      )
        number += 1;
      emit('change', {
        fields: [
          ...props.schema.fields,
          {
            key: `field_${number}`,
            label: '新字段',
            type: 'string',
            required: false,
          },
        ],
      });
      selected.value = props.schema.fields.length;
    };
    return () => (
      <div class="space-y-3">
        <Space wrap>
          {props.schema.fields.map((field, index) => (
            <Button
              key={index}
              onClick={() => {
                selected.value = index;
              }}
              type={buttonType(index)}
            >
              {field.label}
            </Button>
          ))}
        </Space>
        <Button block disabled={props.schema.fields.length >= 64} onClick={add}>
          添加字段
        </Button>
        {current.value && (
          <Card size="small">
            <FieldSchemaEditor field={current.value} onChange={update} />
            <Button
              class="mt-3"
              danger
              onClick={() => {
                const fields = props.schema.fields.filter(
                  (_, index) => index !== selected.value,
                );
                selected.value = Math.max(0, selected.value - 1);
                emit('change', { fields });
              }}
            >
              删除字段
            </Button>
          </Card>
        )}
        {props.schema.fields.length === 0 && (
          <Empty description="尚未定义字段" />
        )}
      </div>
    );
  },
});
