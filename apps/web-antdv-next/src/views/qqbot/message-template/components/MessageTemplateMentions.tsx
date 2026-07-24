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
    /**
     * Keeps the wrapper controlled and forwards only the complete plain-text value.
     * @param value - Mentions textarea content after an explicit user update.
     * @returns Always true because string payloads are the only supported update.
     */
    'update:value': (value: string) => typeof value === 'string',
  },
  /** Creates a request-free controlled boundary around the installed Mentions. */
  setup(props, { emit }) {
    /** Maps server variables to the exact `{{key}}` values required after `$`. */
    const options = computed<MessageTemplateMentionOption[]>(() =>
      props.variables.map((variable) => ({
        label: `${variable.key} · ${variable.label} · ${variable.description} · 示例：${variable.example}`,
        value: `{{${variable.key}}}`,
        variable,
      })),
    );

    /**
     * Filters one option across the four server-owned variable descriptors.
     * @param input - Case-insensitive query entered after the `$` prefix.
     * @param option - Mentions option carrying the original variable definition.
     * @returns Whether key, label, description, or example includes the query.
     */
    function filterVariableOption(
      input: string,
      option: Record<string, unknown>,
    ) {
      const variable = option.variable;
      if (!isVariableDefinition(variable)) return false;
      const query = input.toLocaleLowerCase();
      return [
        variable.key,
        variable.label,
        variable.description,
        variable.example,
      ].some((field) => field.toLocaleLowerCase().includes(query));
    }

    /**
     * Emits the installed component's controlled value without interpreting its text.
     * @param value - Literal textarea value, including CQ-looking substrings.
     */
    function handleValueUpdate(value: string) {
      emit('update:value', value);
    }

    return () => (
      <Mentions
        disabled={props.disabled}
        filterOption={filterVariableOption}
        loading={props.loading}
        maxlength={2000}
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

/**
 * Narrows an unknown Mentions option payload to the server variable contract.
 * @param value - Candidate option metadata supplied by the installed component.
 * @returns Whether all searchable variable fields are strings.
 */
function isVariableDefinition(
  value: unknown,
): value is QqbotMessagePushApi.SystemMessageSourceVariableDefinition {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return ['description', 'example', 'key', 'label'].every(
    (field) => typeof candidate[field] === 'string',
  );
}
