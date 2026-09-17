export const BPMN_EXTENSION = {
  Contract: 'kt:Contract',
  Step: 'kt:Step',
} as const;

export const BPMN_TYPE = Object.freeze({
  Association: 'bpmn:Association',
  BoundaryEvent: 'bpmn:BoundaryEvent',
  BusinessRuleTask: 'bpmn:BusinessRuleTask',
  CancelEventDefinition: 'bpmn:CancelEventDefinition',
  Collaboration: 'bpmn:Collaboration',
  CompensateEventDefinition: 'bpmn:CompensateEventDefinition',
  ComplexGateway: 'bpmn:ComplexGateway',
  Definitions: 'bpmn:Definitions',
  EndEvent: 'bpmn:EndEvent',
  Error: 'bpmn:Error',
  ErrorEventDefinition: 'bpmn:ErrorEventDefinition',
  Escalation: 'bpmn:Escalation',
  EscalationEventDefinition: 'bpmn:EscalationEventDefinition',
  ExclusiveGateway: 'bpmn:ExclusiveGateway',
  ExtensionElements: 'bpmn:ExtensionElements',
  FormalExpression: 'bpmn:FormalExpression',
  InclusiveGateway: 'bpmn:InclusiveGateway',
  IntermediateCatchEvent: 'bpmn:IntermediateCatchEvent',
  IntermediateThrowEvent: 'bpmn:IntermediateThrowEvent',
  Lane: 'bpmn:Lane',
  LaneSet: 'bpmn:LaneSet',
  MessageEventDefinition: 'bpmn:MessageEventDefinition',
  MessageFlow: 'bpmn:MessageFlow',
  MultiInstanceLoopCharacteristics: 'bpmn:MultiInstanceLoopCharacteristics',
  ParallelGateway: 'bpmn:ParallelGateway',
  Participant: 'bpmn:Participant',
  Process: 'bpmn:Process',
  SequenceFlow: 'bpmn:SequenceFlow',
  ServiceTask: 'bpmn:ServiceTask',
  Signal: 'bpmn:Signal',
  SignalEventDefinition: 'bpmn:SignalEventDefinition',
  StandardLoopCharacteristics: 'bpmn:StandardLoopCharacteristics',
  StartEvent: 'bpmn:StartEvent',
  SubProcess: 'bpmn:SubProcess',
  TerminateEventDefinition: 'bpmn:TerminateEventDefinition',
  TimerEventDefinition: 'bpmn:TimerEventDefinition',
  Transaction: 'bpmn:Transaction',
  UserTask: 'bpmn:UserTask',
} as const);

export const BPMN_DI = Object.freeze({
  BPMNDiagram: 'bpmndi:BPMNDiagram',
  BPMNEdge: 'bpmndi:BPMNEdge',
  BPMNPlane: 'bpmndi:BPMNPlane',
  BPMNShape: 'bpmndi:BPMNShape',
} satisfies Record<string, string>);

export const BPMN_COORDINATE = Object.freeze({
  Bounds: 'dc:Bounds',
  Point: 'dc:Point',
} satisfies Record<string, string>);

export const BPMN_KIND_GROUPS = {
  interruptingEvents: new Set<string>([
    BPMN_TYPE.CancelEventDefinition,
    BPMN_TYPE.ErrorEventDefinition,
  ]) as ReadonlySet<string>,
  containers: new Set<string>([
    BPMN_TYPE.Lane,
    BPMN_TYPE.Participant,
  ]) as ReadonlySet<string>,
  excludedLayoutNodes: new Set<string>([
    BPMN_TYPE.BoundaryEvent,
    BPMN_TYPE.SequenceFlow,
  ]) as ReadonlySet<string>,
  connections: new Set<string>([
    BPMN_TYPE.Association,
    BPMN_TYPE.MessageFlow,
    BPMN_TYPE.SequenceFlow,
  ]) as ReadonlySet<string>,
  throwEvents: new Set<string>([
    BPMN_TYPE.EndEvent,
    BPMN_TYPE.IntermediateThrowEvent,
  ]) as ReadonlySet<string>,
  namedEventReferences: new Set<string>([
    BPMN_TYPE.CompensateEventDefinition,
    BPMN_TYPE.ErrorEventDefinition,
    BPMN_TYPE.EscalationEventDefinition,
    BPMN_TYPE.SignalEventDefinition,
  ]) as ReadonlySet<string>,
  catchEvents: new Set<string>([
    BPMN_TYPE.BoundaryEvent,
    BPMN_TYPE.IntermediateCatchEvent,
    BPMN_TYPE.StartEvent,
  ]) as ReadonlySet<string>,
  interruptibleCatchEvents: new Set<string>([
    BPMN_TYPE.BoundaryEvent,
    BPMN_TYPE.StartEvent,
  ]) as ReadonlySet<string>,
  subprocesses: new Set<string>([
    BPMN_TYPE.SubProcess,
    BPMN_TYPE.Transaction,
  ]) as ReadonlySet<string>,
  eventSubprocessTriggers: new Set<string>([
    BPMN_TYPE.EscalationEventDefinition,
    BPMN_TYPE.SignalEventDefinition,
    BPMN_TYPE.TimerEventDefinition,
  ]) as ReadonlySet<string>,
  intermediateCatchEvents: new Set<string>([
    BPMN_TYPE.BoundaryEvent,
    BPMN_TYPE.IntermediateCatchEvent,
  ]) as ReadonlySet<string>,
  conditionalGateways: new Set<string>([
    BPMN_TYPE.ComplexGateway,
    BPMN_TYPE.ExclusiveGateway,
    BPMN_TYPE.InclusiveGateway,
  ]) as ReadonlySet<string>,
} as const;
