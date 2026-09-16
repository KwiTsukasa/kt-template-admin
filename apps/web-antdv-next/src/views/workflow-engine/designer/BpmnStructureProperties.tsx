import type { PropType } from 'vue';

import type { BpmnDefinition, BpmnElement } from '#/api/workflow-engine/bpmn';

import { defineComponent } from 'vue';

import { cloneDeep } from '@vben/utils';

import { Input, InputNumber, Select, Switch } from 'antdv-next';

import { bpmnId, indexBpmn, setBpmnBounds } from './bpmn-model';
import {
  attachBpmnBoundary,
  bpmnBounds,
  bpmnLanes,
  moveBpmnElement,
} from './bpmn-structure';

export default defineComponent({
  name: 'BpmnStructureProperties',
  props: {
    definition: { type: Object as PropType<BpmnDefinition>, required: true },
    element: { type: Object as PropType<BpmnElement>, required: true },
  },
  emits: { change: (_value: BpmnDefinition) => true },
  setup(props, { emit }) {
    const edit = (
      change: (document: BpmnDefinition, element: BpmnElement) => void,
    ) => {
      const document = cloneDeep(props.definition);
      const element = indexBpmn(document).get(props.element.id ?? '')?.element;
      if (!element) return;
      change(document, element);
      emit('change', document);
    };
    return () => {
      const element = props.element;
      const parent = indexBpmn(props.definition).get(element.id ?? '')?.parent;
      const event = element.eventDefinitions?.[0];
      const boundary = element.$type === 'bpmn:BoundaryEvent';
      const lanes = bpmnLanes(parent ?? ({} as BpmnElement));
      const lane = lanes.find((item) =>
        item.flowNodeRef?.some(
          (reference: { $ref: string }) => reference.$ref === element.id,
        ),
      );
      const bounds = bpmnBounds(props.definition, element.id);
      return (
        <>
          {/(?:Task|Activity|SubProcess|Transaction)$/.test(element.$type) && (
            <label class="flex items-center justify-between">
              <span>补偿活动</span>
              <Switch
                checked={!!element.isForCompensation}
                onChange={(value) =>
                  edit((_document, item) => {
                    item.isForCompensation = value;
                  })
                }
              />
            </label>
          )}
          {lanes.length > 0 &&
            !element.attachedToRef &&
            !element.$type.endsWith('Flow') && (
              <label class="block space-y-2">
                <span>所属泳道</span>
                <Select
                  class="w-full"
                  onChange={(value) =>
                    edit((document, item) => {
                      const box = bpmnBounds(document, String(value));
                      const own = bpmnBounds(document, item.id);
                      if (box && own)
                        moveBpmnElement(document, item.id ?? '', {
                          x: Math.max(
                            box.x + 50,
                            Math.min(own.x, box.x + box.width - own.width - 20),
                          ),
                          y: box.y + (box.height - own.height) / 2,
                        });
                    })
                  }
                  options={lanes.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  placeholder="选择泳道"
                  value={lane?.id}
                />
              </label>
            )}
          {['bpmn:Lane', 'bpmn:Participant'].includes(element.$type) &&
            bounds && (
              <div class="grid grid-cols-2 gap-3">
                {(['width', 'height'] as const).map((key) => (
                  <label class="block space-y-2" key={key}>
                    <span>{{ width: '宽度', height: '高度' }[key]}</span>
                    <InputNumber
                      class="w-full"
                      min={100}
                      onChange={(value) =>
                        edit((document, item) => {
                          setBpmnBounds(document, item.id ?? '', {
                            ...bounds,
                            [key]: Math.max(100, Number(value)),
                          });
                        })
                      }
                      value={bounds[key]}
                    />
                  </label>
                ))}
              </div>
            )}
          {boundary && (
            <>
              <label class="block space-y-2">
                <span>附着活动</span>
                <Select
                  class="w-full"
                  onChange={(value) =>
                    edit((document, item) =>
                      attachBpmnBoundary(
                        document,
                        item.id ?? '',
                        String(value),
                      ),
                    )
                  }
                  options={(parent?.flowElements ?? [])
                    .filter((item: BpmnElement) =>
                      /(?:Task|Activity|SubProcess|Transaction)$/.test(
                        item.$type,
                      ),
                    )
                    .map((item: BpmnElement) => ({
                      value: item.id,
                      label: item.name || item.id,
                    }))}
                  value={element.attachedToRef?.$ref}
                />
              </label>
              <label class="block space-y-2">
                <span>边界事件</span>
                <Select
                  class="w-full"
                  onChange={(value) =>
                    edit((_document, item) => {
                      const next: BpmnElement = {
                        $type: String(value),
                        id: bpmnId('EventDefinition'),
                      };
                      if (value === 'bpmn:TimerEventDefinition')
                        next.timeDuration = {
                          $type: 'bpmn:FormalExpression',
                          body: 'PT60S',
                        };
                      item.eventDefinitions = [next];
                      item.cancelActivity =
                        value !== 'bpmn:CompensateEventDefinition';
                    })
                  }
                  options={[
                    { value: 'bpmn:TimerEventDefinition', label: '定时' },
                    { value: 'bpmn:ErrorEventDefinition', label: '错误' },
                    { value: 'bpmn:CancelEventDefinition', label: '事务取消' },
                    { value: 'bpmn:CompensateEventDefinition', label: '补偿' },
                  ]}
                  value={event?.$type}
                />
              </label>
              <label class="flex items-center justify-between">
                <span>中断宿主活动</span>
                <Switch
                  checked={element.cancelActivity !== false}
                  disabled={event?.$type !== 'bpmn:TimerEventDefinition'}
                  onChange={(value) =>
                    edit((_document, item) => {
                      item.cancelActivity = value;
                    })
                  }
                />
              </label>
            </>
          )}
          {event?.$type === 'bpmn:ErrorEventDefinition' && (
            <label class="block space-y-2">
              <span>错误代码</span>
              <Input
                onChange={(change) =>
                  edit((document, item) => {
                    const code = change.target.value?.trim();
                    const definition = item.eventDefinitions[0];
                    if (!code) {
                      delete definition.errorRef;
                      return;
                    }
                    let error = document.model.rootElements.find(
                      (root: BpmnElement) =>
                        root.$type === 'bpmn:Error' && root.errorCode === code,
                    );
                    if (!error) {
                      error = {
                        $type: 'bpmn:Error',
                        id: bpmnId('Error'),
                        errorCode: code,
                      };
                      document.model.rootElements.push(error);
                    }
                    definition.errorRef = { $ref: error.id };
                  })
                }
                placeholder="全部错误"
                value={
                  indexBpmn(props.definition).get(event.errorRef?.$ref)?.element
                    .errorCode ?? ''
                }
              />
            </label>
          )}
        </>
      );
    };
  },
});
