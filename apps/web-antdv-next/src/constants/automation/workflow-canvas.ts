export const BPMN_LAYOUT = Object.freeze({
  origin: 90,
  columnSpacing: 230,
  rowSpacing: 140,
  activityWidth: 160,
  activityHeight: 76,
  eventSize: 40,
  gatewaySize: 56,
  containerWidth: 920,
  containerHeight: 240,
  laneMinimumWidth: 890,
  laneMinimumHeight: 220,
  poolMinimumHeight: 280,
  containerInset: 30,
  containerPadding: 60,
  poolSpacing: 80,
});

export const BPMN_CANVAS_COLORS = Object.freeze({
  ink: 'var(--ant-color-text-secondary, #64748b)',
  surface: 'var(--ant-color-bg-container, #fff)',
  success: 'var(--ant-color-success)',
  danger: 'var(--ant-color-error)',
  primary: 'var(--ant-color-primary)',
  disabled: 'var(--ant-color-text-disabled)',
});

export const BPMN_STATUS_COLORS: Readonly<Record<string, string>> = {
  succeeded: BPMN_CANVAS_COLORS.success,
  failed: BPMN_CANVAS_COLORS.danger,
  waiting: BPMN_CANVAS_COLORS.primary,
  cancelled: BPMN_CANVAS_COLORS.disabled,
};
