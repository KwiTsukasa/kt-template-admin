export type KtActionAvailabilityStrategy = 'disabled' | 'static' | 'visibility';

interface KtActionAvailabilityInput {
  disabled?: unknown;
  disabledReason?: unknown;
  rowVisible?: unknown;
  visible?: unknown;
}

function hasConfiguredProperty(
  action: KtActionAvailabilityInput,
  property: keyof KtActionAvailabilityInput,
) {
  return Object.hasOwn(action, property) && action[property] !== undefined;
}

export function assertSingleActionAvailabilityStrategy(
  actions: KtActionAvailabilityInput[],
  actionGroup: string,
): KtActionAvailabilityStrategy {
  const usesDisabled = actions.some(
    (action) =>
      hasConfiguredProperty(action, 'disabled') ||
      hasConfiguredProperty(action, 'disabledReason'),
  );
  const usesVisibility = actions.some(
    (action) =>
      hasConfiguredProperty(action, 'rowVisible') ||
      hasConfiguredProperty(action, 'visible'),
  );

  if (usesDisabled && usesVisibility) {
    throw new Error(
      `${actionGroup} 不能同时使用 disabled 与 visible/rowVisible，请为整个操作组选择一种可用性策略。`,
    );
  }
  if (usesDisabled) return 'disabled';
  if (usesVisibility) return 'visibility';
  return 'static';
}
