import type { PropType } from 'vue';

import type { BpmnExpression } from './BpmnExpressionEditor';

import type { DataField, DataSchema } from '#/api/automation/definition';
import type { ValueBinding } from '#/api/workflow-engine';
import type { BpmnElement } from '#/api/workflow-engine/bpmn';

import { computed, defineComponent } from 'vue';

import { cloneDeep } from '@vben/utils';

import { Alert, InputNumber, Select, Switch } from 'antdv-next';

import { BPMN_TYPE } from '#/constants/automation/bpmn';
import { BPMN_LOOP_LIMITS } from '#/constants/automation/workflow';

import BindingEditor from './BindingEditor';
import {
  readBpmnCountBinding,
  writeBpmnCountBinding,
} from './bpmn-count-binding';
import { readBpmnExpression } from './bpmn-expression';
import { createBpmnLoop } from './bpmn-loop';
import BpmnExpressionEditor from './BpmnExpressionEditor';

export default defineComponent({
  name: 'BpmnLoopProperties',
  props: {
    value: { type: Object as PropType<BpmnElement>, default: undefined },
    fields: { type: Array as PropType<DataField[]>, required: true },
    inputSchema: { type: Object as PropType<DataSchema>, required: true },
    outputs: {
      type: Array as PropType<
        { name: string; nodeId: string; schema: DataSchema }[]
      >,
      required: true,
    },
  },
  emits: { change: (_value: BpmnElement | undefined) => true },
  setup(props, { emit }) {
    const update = (change: (value: BpmnElement) => void) => {
      if (!props.value) return;
      const value = cloneDeep(props.value);
      change(value);
      emit('change', value);
    };
    const countValues = computed((): Record<string, ValueBinding> => {
      const count = readBpmnCountBinding(
        props.value?.loopCardinality?.body ?? '',
      );
      if (count) return { count };
      return {};
    });
    const condition = computed((): BpmnExpression | undefined => {
      const body = props.value?.loopCondition?.body;
      if (!body) return { value: true };
      return readBpmnExpression(body);
    });
    return () => (
      <div class="space-y-4">
        <label class="block space-y-2">
          <span>循环</span>
          <Select
            class="w-full"
            onChange={(type) => emit('change', createBpmnLoop(String(type)))}
            options={[
              { value: 'none', label: '不循环' },
              {
                value: BPMN_TYPE.StandardLoopCharacteristics,
                label: '标准循环',
              },
              {
                value: BPMN_TYPE.MultiInstanceLoopCharacteristics,
                label: '多实例',
              },
            ]}
            value={props.value?.$type ?? 'none'}
          />
        </label>
        {props.value?.$type === BPMN_TYPE.StandardLoopCharacteristics && (
          <>
            {condition.value && (
              <BpmnExpressionEditor
                fields={props.fields}
                onChange={(value) =>
                  update((loop) => {
                    loop.loopCondition = {
                      ...createBpmnLoop(BPMN_TYPE.StandardLoopCharacteristics)
                        ?.loopCondition,
                      ...loop.loopCondition,
                      body: JSON.stringify(value),
                    };
                  })
                }
                value={condition.value}
              />
            )}
            {!condition.value && (
              <Alert
                message="循环条件无法识别，请检查导入的表达式"
                type="error"
              />
            )}
            <label class="block space-y-2">
              <span>最大次数</span>
              <InputNumber
                class="w-full"
                max={BPMN_LOOP_LIMITS.maxIterations}
                min={1}
                onChange={(value) =>
                  update((loop) => {
                    loop.loopMaximum = Number(value) || 1;
                  })
                }
                value={props.value.loopMaximum}
              />
            </label>
            <label class="flex items-center justify-between">
              <span>执行前判断</span>
              <Switch
                checked={props.value.testBefore}
                onChange={(value) =>
                  update((loop) => {
                    loop.testBefore = value;
                  })
                }
              />
            </label>
          </>
        )}
        {props.value?.$type === BPMN_TYPE.MultiInstanceLoopCharacteristics && (
          <>
            <BindingEditor
              fields={[
                {
                  key: 'count',
                  label: '实例数量',
                  type: 'integer',
                  required: true,
                  min: 0,
                  max: BPMN_LOOP_LIMITS.maxInstances,
                },
              ]}
              inputSchema={props.inputSchema}
              onChange={(values) =>
                update((loop) => {
                  loop.loopCardinality = {
                    $type: BPMN_TYPE.FormalExpression,
                    ...loop.loopCardinality,
                    body: writeBpmnCountBinding(values.count) ?? '',
                  };
                })
              }
              outputs={props.outputs}
              values={countValues.value}
            />
            <label class="flex items-center justify-between">
              <span>顺序执行</span>
              <Switch
                checked={props.value.isSequential}
                onChange={(value) =>
                  update((loop) => {
                    loop.isSequential = value;
                  })
                }
              />
            </label>
          </>
        )}
      </div>
    );
  },
});
