export type KtActionAvailabilityStrategy = 'disabled' | 'static' | 'visibility';

interface KtActionAvailabilityInput {
  disabled?: unknown;
  disabledReason?: unknown;
  rowVisible?: unknown;
  visible?: unknown;
}

/**
 * 仅在操作对象自身显式定义目标字段且值不为 undefined 时判定已配置。
 *
 * @param action - 要检查显隐或禁用策略字段的行操作定义。
 * @param property - 需要检查是否已显式配置的可用性字段名。
 * @returns 操作对象自身包含目标字段且字段值不为 undefined 时返回 true，否则返回 false。
 */
function hasConfiguredProperty(
  action: KtActionAvailabilityInput,
  property: keyof KtActionAvailabilityInput,
) {
  return Object.hasOwn(action, property) && action[property] !== undefined;
}

/**
 * 通过检查每个操作只采用显隐或禁用一种可用性策略，混用时立即报错。
 *
 * @param actions - 同一操作组内需要统一检查的全部操作配置。
 * @param actionGroup - 用于错误信息定位的操作组名称。
 * @returns 操作组采用的 `disabled`、`visibility` 或 `static` 策略。
 * @throws 同一操作组同时配置显隐字段与禁用字段时抛出。
 */
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
