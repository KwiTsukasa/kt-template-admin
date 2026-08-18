import type { PropType } from 'vue';

import type { MessageManagementApi } from '#/api/message-management';

import { computed, defineComponent } from 'vue';

import Mentions from 'antdv-next/dist/mentions/index';

interface MessageTemplateMentionOption {
  label: string;
  value: string;
  variable: MessageManagementApi.SystemMessageSourceVariableDefinition;
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
        MessageManagementApi.SystemMessageSourceVariableDefinition[]
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

    /**
     * 根据模板变量键、标签、说明和示例执行不区分大小写的下拉搜索，非法选项直接排除。
     *
     * @param input - 用户在变量提及下拉框输入的大小写不敏感搜索词。
     * @param option - 待匹配的提及选项；必须携带合法变量定义才参与搜索。
     * @returns 选项结构合法且任一变量文本包含查询词时返回 true，否则返回 false。
     */
    function filterVariableOption(input: string, option: unknown) {
      const variable = (() => {
        if (option && typeof option === 'object' && 'variable' in option) {
          return option.variable;
        }
        return undefined;
      })();
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
     * 把模板提及输入框的新值通过 `update:value` 事件同步给父组件。
     *
     * @param value - 提及输入框更新后的完整模板正文。
     */
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

/**
 * 检查模板变量是否同时具备非空键名和展示标签。
 *
 * @param value - 待判别对象；description、example、key 和 label 均为字符串才有效。
 * @returns 模板变量同时具有非空键名和标签时返回 true，否则返回 false。
 */
function isVariableDefinition(
  value: unknown,
): value is MessageManagementApi.SystemMessageSourceVariableDefinition {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return ['description', 'example', 'key', 'label'].every(
    (field) => typeof candidate[field] === 'string',
  );
}
