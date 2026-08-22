import { defineComponent, ref, watch } from 'vue';

import { useCron } from '@vue-js-cron/core';
import { Alert, Input, RadioButton, RadioGroup, Space } from 'antdv-next';

const AAlert = Alert as any;
const AInput = Input as any;
const ARadioButton = RadioButton as any;
const ARadioGroup = RadioGroup as any;
const ASpace = Space as any;

const fieldPattern = /^[\d*/,-]+$/;

export default defineComponent({
  name: 'CronEditorAntdvNext',
  props: {
    value: {
      default: '0 */6 * * *',
      type: String,
    },
  },
  emits: ['update:value', 'validChange'],
  setup(props, { emit }) {
    const cronCore = useCron({
      format: 'crontab',
      initialValue: props.value,
      locale: 'cn',
    });
    const expression = ref(props.value);
    const error = ref('');

    /**
     * 把 cron 输入规范为空格分隔的五段表达式，拒绝非法字符和每分钟执行，并同步错误与有效状态。
     *
     * @param value - 需要规范化并校验为五段表达式的 cron 文本。
     */
    function validate(value: string) {
      const nextValue = `${value || ''}`.trim().replaceAll(/\s+/g, ' ');
      const fields = nextValue.split(' ').filter(Boolean);
      cronCore.cron.value = nextValue;
      if (fields.length !== 5) {
        error.value = '请输入 5 段 cron 表达式';
        emit('validChange', false);
        return;
      }
      if (!fields.every((field) => fieldPattern.test(field))) {
        error.value = 'cron 只能包含数字、星号、斜杠、逗号和横线';
        emit('validChange', false);
        return;
      }
      if (fields[0] === '*') {
        error.value = '不允许每分钟执行';
        emit('validChange', false);
        return;
      }
      error.value = cronCore.error.value || '';
      emit('validChange', !error.value);
    }

    /**
     * 同步 cron 表达式内部状态、向父组件派发新值并立即执行校验。
     *
     * @param value - cron 编辑器新的五段表达式文本。
     */
    function updateValue(value: string) {
      expression.value = value;
      emit('update:value', value);
      validate(value);
    }

    watch(
      () => props.value,
      (value) => {
        expression.value = value;
        validate(value);
      },
      { immediate: true },
    );

    return () => (
      <ASpace orientation="vertical" size={12} style={{ width: '100%' }}>
        <ARadioGroup
          buttonStyle="solid"
          onChange={(event: any) => updateValue(event.target.value)}
          value={expression.value}
        >
          <ARadioButton value="0 */6 * * *">每 6 小时</ARadioButton>
          <ARadioButton value="0 3 * * *">每天 03:00</ARadioButton>
          <ARadioButton value="0 3 * * 1">每周一 03:00</ARadioButton>
        </ARadioGroup>
        <AInput
          onChange={(event: any) => updateValue(event.target.value)}
          value={expression.value}
        />
        {(() => {
          if (error.value) {
            return <AAlert showIcon title={error.value} type="error" />;
          }
          return null;
        })()}
      </ASpace>
    );
  },
});
