import type { PropType } from 'vue';

import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';

import { computed, defineComponent } from 'vue';

import Mentions from 'antdv-next/dist/mentions/index';

interface MessageTemplateMentionOption {
  label: string;
  value: string;
  variable: QqbotMessagePushApi.SystemMessageSourceVariableDefinition;
}

export default defineComponent({
  name: 'MessageTemplateMentions',
  props: {
    disabled: {
      default: false,
      type: Boolean,
    },
    loading: {
      default: false,
      type: Boolean,
    },
    value: {
      default: '',
      type: String,
    },
    variables: {
      default: () => [],
      type: Array as PropType<
        QqbotMessagePushApi.SystemMessageSourceVariableDefinition[]
      >,
    },
  },
  emits: {
    'update:value': (value: string) => typeof value === 'string',
  },
  setup(props, { emit }) {
    // 1.5.1 的 typed maxLength 会在底层可缩放文本域丢失，保留原生属性并由组件测试锁定。
    const nativeTextareaAttrs = { maxlength: 2000 };
    const options = computed<MessageTemplateMentionOption[]>(() =>
      props.variables.map((variable) => ({
        label: `${variable.key} · ${variable.label} · ${variable.description} · 示例：${variable.example}`,
        value: `{{${variable.key}}}`,
        variable,
      })),
    );

    function filterVariableOption(input: string, option: unknown) {
      const variable =
        option && typeof option === 'object' && 'variable' in option
          ? option.variable
          : undefined;
      if (!isVariableDefinition(variable)) return false;
      const query = input.toLocaleLowerCase();
      return [
        variable.key,
        variable.label,
        variable.description,
        variable.example,
      ].some((field) => field.toLocaleLowerCase().includes(query));
    }

    function handleValueUpdate(value: string) {
      emit('update:value', value);
    }

    return () => (
      <Mentions
        {...nativeTextareaAttrs}
        disabled={props.disabled}
        filterOption={filterVariableOption}
        loading={props.loading}
        onUpdate:value={handleValueUpdate}
        options={options.value}
        prefix="$"
        rows={4}
        split=""
        value={props.value}
      />
    );
  },
});

function isVariableDefinition(
  value: unknown,
): value is QqbotMessagePushApi.SystemMessageSourceVariableDefinition {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return ['description', 'example', 'key', 'label'].every(
    (field) => typeof candidate[field] === 'string',
  );
}
