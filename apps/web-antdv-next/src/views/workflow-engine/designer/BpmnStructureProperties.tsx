import type { PropType } from 'vue';

import type { BpmnDefinition, BpmnElement } from '#/api/workflow-engine/bpmn';

import { defineComponent } from 'vue';

import { cloneDeep } from '@vben/utils';

import { Input, InputNumber, Select, Switch, Tooltip } from 'antdv-next';

import { BPMN_KIND_GROUPS, BPMN_TYPE } from '#/constants/automation/bpmn';

import {
  bpmnEventReferenceValue,
  eventSubprocessRestriction,
  setBpmnEventReference,
  setBpmnEventSubprocess,
  setBpmnEventType,
} from './bpmn-events';
import { indexBpmn, setBpmnBounds } from './bpmn-model';
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
      const boundary = element.$type === BPMN_TYPE.BoundaryEvent;
      const eventStart =
        element.$type === BPMN_TYPE.StartEvent && parent?.triggeredByEvent;
      const throwing = element.$type === BPMN_TYPE.IntermediateThrowEvent;
      const restriction = eventSubprocessRestriction(props.definition, element);
      const eventOptions: Array<{ label: string; value: string }> = [
        { value: BPMN_TYPE.SignalEventDefinition, label: '信号' },
        { value: BPMN_TYPE.EscalationEventDefinition, label: '升级' },
      ];
      if (eventStart)
        eventOptions.push({
          value: BPMN_TYPE.ErrorEventDefinition,
          label: '错误',
        });
      if (throwing)
        eventOptions.push({
          value: BPMN_TYPE.CompensateEventDefinition,
          label: '补偿',
        });
      const referenceLabels: Record<string, string> = {
        [BPMN_TYPE.ErrorEventDefinition]: '错误代码',
        [BPMN_TYPE.EscalationEventDefinition]: '升级代码',
        [BPMN_TYPE.SignalEventDefinition]: '信号名称',
      };
      const lanes = bpmnLanes(parent ?? ({} as BpmnElement));
      const lane = lanes.find((item) =>
        item.flowNodeRef?.some(
          (reference: { $ref: string }) => reference.$ref === element.id,
        ),
      );
      const bounds = bpmnBounds(props.definition, element.id);
      return (
        <>
          {element.$type === BPMN_TYPE.SubProcess && (
            <label class="flex items-center justify-between">
              <span>事件子流程</span>
              <Tooltip title={restriction}>
                <Switch
                  checked={!!element.triggeredByEvent}
                  disabled={!!restriction}
                  onChange={(value) =>
                    edit((document, item) => {
                      setBpmnEventSubprocess(document, item, !!value);
                    })
                  }
                />
              </Tooltip>
            </label>
          )}
          {(eventStart || throwing) && (
            <label class="block space-y-2">
              <span>事件类型</span>
              <Select
                class="w-full"
                onChange={(value) =>
                  edit((_document, item) =>
                    setBpmnEventType(item, String(value)),
                  )
                }
                options={eventOptions}
                value={event?.$type}
              />
            </label>
          )}
          {eventStart && (
            <label class="flex items-center justify-between">
              <span>中断父流程</span>
              <Switch
                checked={element.isInterrupting !== false}
                disabled={event?.$type === BPMN_TYPE.ErrorEventDefinition}
                onChange={(value) =>
                  edit((_document, item) => {
                    item.isInterrupting = value;
                  })
                }
              />
            </label>
          )}
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
          {BPMN_KIND_GROUPS.containers.has(element.$type) && bounds && (
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
                    .filter(
                      (item: BpmnElement) =>
                        !item.triggeredByEvent &&
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
                    edit((_document, item) =>
                      setBpmnEventType(item, String(value)),
                    )
                  }
                  options={[
                    { value: BPMN_TYPE.TimerEventDefinition, label: '定时' },
                    { value: BPMN_TYPE.ErrorEventDefinition, label: '错误' },
                    { value: BPMN_TYPE.SignalEventDefinition, label: '信号' },
                    {
                      value: BPMN_TYPE.EscalationEventDefinition,
                      label: '升级',
                    },
                    {
                      value: BPMN_TYPE.CancelEventDefinition,
                      label: '事务取消',
                    },
                    {
                      value: BPMN_TYPE.CompensateEventDefinition,
                      label: '补偿',
                    },
                  ]}
                  value={event?.$type}
                />
              </label>
              <label class="flex items-center justify-between">
                <span>中断宿主活动</span>
                <Switch
                  checked={element.cancelActivity !== false}
                  disabled={
                    !BPMN_KIND_GROUPS.eventSubprocessTriggers.has(event?.$type)
                  }
                  onChange={(value) =>
                    edit((_document, item) => {
                      item.cancelActivity = value;
                    })
                  }
                />
              </label>
            </>
          )}
          {event && referenceLabels[event.$type] && (
            <label class="block space-y-2">
              <span>{referenceLabels[event.$type]}</span>
              <Input
                onChange={(change) =>
                  edit((document, item) => {
                    setBpmnEventReference(
                      document,
                      item.eventDefinitions[0],
                      change.target.value ?? '',
                    );
                  })
                }
                value={bpmnEventReferenceValue(props.definition, event)}
              />
            </label>
          )}
        </>
      );
    };
  },
});
