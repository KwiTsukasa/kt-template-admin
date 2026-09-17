import { BPMN_TYPE } from './bpmn';

export const BPMN_CONTROLS = [
  {
    type: BPMN_TYPE.IntermediateThrowEvent,
    label: '抛出事件',
    icon: 'lucide:undo-2',
  },
  { type: BPMN_TYPE.Participant, label: '外部泳池', icon: 'lucide:panel-top' },
  { type: BPMN_TYPE.Lane, label: '泳道', icon: 'lucide:rows-3' },
  {
    type: BPMN_TYPE.BoundaryEvent,
    label: '边界事件',
    icon: 'lucide:circle-dashed',
  },
  {
    type: BPMN_TYPE.UserTask,
    label: '人工办理',
    icon: 'lucide:user-round-check',
  },
  { type: BPMN_TYPE.StartEvent, label: '开始事件', icon: 'lucide:circle' },
  { type: BPMN_TYPE.EndEvent, label: '结束事件', icon: 'lucide:circle-stop' },
  {
    type: BPMN_TYPE.ExclusiveGateway,
    label: '排他网关',
    icon: 'lucide:diamond',
  },
  {
    type: BPMN_TYPE.ParallelGateway,
    label: '并行网关',
    icon: 'lucide:git-fork',
  },
  {
    type: BPMN_TYPE.ComplexGateway,
    label: '复杂网关',
    icon: 'lucide:asterisk',
  },
  {
    type: BPMN_TYPE.InclusiveGateway,
    label: '包容网关',
    icon: 'lucide:circle-dot',
  },
  {
    type: BPMN_TYPE.BusinessRuleTask,
    label: '规则任务',
    icon: 'lucide:table-properties',
  },
  {
    type: BPMN_TYPE.IntermediateCatchEvent,
    label: '定时等待',
    icon: 'lucide:timer',
  },
  { type: BPMN_TYPE.SubProcess, label: '子流程', icon: 'lucide:square-plus' },
  {
    type: BPMN_TYPE.Transaction,
    label: '事务子流程',
    icon: 'lucide:panels-top-left',
  },
];
