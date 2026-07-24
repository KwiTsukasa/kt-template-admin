import type { PropType } from 'vue';

import type { QqbotMessagePushApi } from '#/api/qqbot/message-push';

import { computed, defineComponent, ref } from 'vue';

import Alert from 'antdv-next/dist/alert/index';
import Select from 'antdv-next/dist/select/index';

const AAlert = Alert as any;
const ASelect = Select as any;

type TargetType = QqbotMessagePushApi.QqbotMessagePushTargetType;

interface TargetSelectOption {
  label: string;
  targetId: string;
  value: string;
}

export interface MessagePushTargetPickerProps {
  available: boolean;
  disabled?: boolean;
  loading?: boolean;
  options: QqbotMessagePushApi.QqbotMessagePushTargetOption[];
  reasonCode: null | string;
  value: QqbotMessagePushApi.QqbotMessagePublishTargetInput[];
}

/**
 * Validates one QQ group/user target without numeric conversion.
 * @param targetId - Trimmed target identifier supplied by the Select runtime.
 * @returns Whether the identifier is 5–20 digits and has no leading zero.
 */
export function isValidMessagePushTargetId(targetId: string): boolean {
  return /^[1-9]\d{4,19}$/.test(targetId);
}

export default defineComponent({
  name: 'MessagePushTargetPicker',
  props: {
    available: {
      required: true,
      type: Boolean,
    },
    disabled: {
      default: false,
      type: Boolean,
    },
    loading: {
      default: false,
      type: Boolean,
    },
    options: {
      required: true,
      type: Array as PropType<
        QqbotMessagePushApi.QqbotMessagePushTargetOption[]
      >,
    },
    reasonCode: {
      default: null,
      type: String as PropType<null | string>,
    },
    value: {
      default: () => [],
      type: Array as PropType<
        QqbotMessagePushApi.QqbotMessagePublishTargetInput[]
      >,
    },
  },
  emits: {
    /**
     * Emits one normalized controlled target collection.
     * @param value - Group-first then private targets with string IDs only.
     * @returns Whether the payload remains an array for Vue emit validation.
     */
    'update:value': (
      value: QqbotMessagePushApi.QqbotMessagePublishTargetInput[],
    ) => Array.isArray(value),
  },
  /** Owns only selector remount revisions; all durable values stay controlled. */
  setup(props, { emit }) {
    const groupRevision = ref(0);
    const privateRevision = ref(0);

    /** Derives the currently controlled group IDs without cloning other fields. */
    const groupIds = computed(() => targetIdsForType(props.value, 'group'));
    /** Derives the currently controlled private IDs independently. */
    const privateIds = computed(() => targetIdsForType(props.value, 'private'));
    /** Maps only server-returned group choices to raw Select values. */
    const groupOptions = computed(() =>
      createSelectOptions(props.options, 'group'),
    );
    /** Maps only server-returned private choices to raw Select values. */
    const privateOptions = computed(() =>
      createSelectOptions(props.options, 'private'),
    );

    /**
     * Cleans one installed Select update and remounts only rejected input.
     * @param targetType - Selector whose controlled string values changed.
     * @param runtimeValue - Raw installed Select emission; may contain bad runtime values.
     */
    function handleValueUpdate(targetType: TargetType, runtimeValue: unknown) {
      const targetIds = normalizeTargetIds(runtimeValue);
      if (containsRejectedTarget(runtimeValue, targetIds)) {
        if (targetType === 'group') groupRevision.value += 1;
        else privateRevision.value += 1;
      }
      emit(
        'update:value',
        mergeTargets(props.value, props.options, targetType, targetIds),
      );
    }

    return () => (
      <div class="qqbot-message-push-target-picker">
        {props.available ? null : (
          <AAlert
            class="mb-3"
            message={props.reasonCode || ''}
            showIcon
            type="warning"
          />
        )}
        <div class="mb-3">
          <div class="mb-1 text-sm">群聊目标</div>
          <ASelect
            allowClear
            class="w-full"
            disabled={props.disabled}
            filterOption={filterTargetOption}
            key={`group-${groupRevision.value}`}
            loading={props.loading}
            mode="tags"
            onUpdate:value={(value: unknown) =>
              handleValueUpdate('group', value)
            }
            options={groupOptions.value}
            placeholder="选择或输入群号"
            value={groupIds.value}
          />
        </div>
        <div>
          <div class="mb-1 text-sm">私聊目标</div>
          <ASelect
            allowClear
            class="w-full"
            disabled={props.disabled}
            filterOption={filterTargetOption}
            key={`private-${privateRevision.value}`}
            loading={props.loading}
            mode="tags"
            onUpdate:value={(value: unknown) =>
              handleValueUpdate('private', value)
            }
            options={privateOptions.value}
            placeholder="选择或输入 QQ 号"
            value={privateIds.value}
          />
        </div>
      </div>
    );
  },
});

/**
 * Returns controlled target IDs for exactly one target type.
 * @param targets - Current API/form-controlled targets.
 * @param targetType - Group or private selector identity.
 * @returns Original string IDs in their controlled order.
 */
function targetIdsForType(
  targets: QqbotMessagePushApi.QqbotMessagePublishTargetInput[],
  targetType: TargetType,
): string[] {
  return targets
    .filter((target) => target.targetType === targetType)
    .map((target) => target.targetId);
}

/**
 * Maps one type's API candidates to plain string-value Select options.
 * @param options - Current OneBot candidate snapshot.
 * @param targetType - Type allowed in the target selector.
 * @returns Type-scoped candidates retaining their server labels.
 */
function createSelectOptions(
  options: QqbotMessagePushApi.QqbotMessagePushTargetOption[],
  targetType: TargetType,
): TargetSelectOption[] {
  return options
    .filter((option) => option.targetType === targetType)
    .map((option) => ({
      label: option.label,
      targetId: option.targetId,
      value: option.targetId,
    }));
}

/**
 * Searches one known candidate by case-insensitive label and string ID.
 * @param input - Search text entered into the installed Select.
 * @param option - Candidate option produced by `createSelectOptions`.
 * @returns Whether its label or target ID contains the query.
 */
function filterTargetOption(
  input: string,
  option: Record<string, unknown>,
): boolean {
  const query = input.toLocaleLowerCase();
  return [option.label, option.targetId, option.value].some(
    (value) =>
      typeof value === 'string' && value.toLocaleLowerCase().includes(query),
  );
}

/**
 * Sanitizes the installed tags-mode payload without coercing non-string values.
 * @param runtimeValue - Raw `update:value` payload from Antdv Next.
 * @returns Trimmed, valid, deduplicated string IDs in input order.
 */
function normalizeTargetIds(runtimeValue: unknown): string[] {
  if (!Array.isArray(runtimeValue)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of runtimeValue) {
    if (typeof value !== 'string') continue;
    const targetId = value.trim();
    if (!isValidMessagePushTargetId(targetId) || seen.has(targetId)) continue;
    seen.add(targetId);
    result.push(targetId);
  }
  return result;
}

/**
 * Detects internal Select state that differs from the cleaned controlled value.
 * @param runtimeValue - Raw installed component emission.
 * @param normalized - Accepted target IDs.
 * @returns Whether the affected Select must remount to discard invalid state.
 */
function containsRejectedTarget(
  runtimeValue: unknown,
  normalized: string[],
): boolean {
  if (!Array.isArray(runtimeValue)) return true;
  if (runtimeValue.length !== normalized.length) return true;
  return runtimeValue.some(
    (value, index) =>
      typeof value !== 'string' || value.trim() !== normalized[index],
  );
}

/**
 * Rebuilds group-first/private-second targets after one selector update.
 * @param current - Controlled value carrying existing API name snapshots.
 * @param options - Current type-scoped candidate labels.
 * @param changedType - Selector whose IDs are replaced.
 * @param changedIds - Sanitized replacement IDs.
 * @returns Normalized targets with no cross-type name leakage.
 */
function mergeTargets(
  current: QqbotMessagePushApi.QqbotMessagePublishTargetInput[],
  options: QqbotMessagePushApi.QqbotMessagePushTargetOption[],
  changedType: TargetType,
  changedIds: string[],
): QqbotMessagePushApi.QqbotMessagePublishTargetInput[] {
  const idsByType: Record<TargetType, string[]> = {
    group:
      changedType === 'group' ? changedIds : targetIdsForType(current, 'group'),
    private:
      changedType === 'private'
        ? changedIds
        : targetIdsForType(current, 'private'),
  };
  return (['group', 'private'] as const).flatMap((targetType) =>
    idsByType[targetType].map((targetId) => {
      const targetName = resolveTargetName(
        current,
        options,
        targetType,
        targetId,
      );
      return {
        targetId,
        ...(targetName ? { targetName } : {}),
        targetType,
      };
    }),
  );
}

/**
 * Resolves a display name from only the same target type and identifier.
 * @param current - Existing API/form values with optional name snapshots.
 * @param options - Current OneBot candidates.
 * @param targetType - Exact group/private namespace.
 * @param targetId - Exact string target identifier.
 * @returns Current candidate label, same-type existing name, or undefined.
 */
function resolveTargetName(
  current: QqbotMessagePushApi.QqbotMessagePublishTargetInput[],
  options: QqbotMessagePushApi.QqbotMessagePushTargetOption[],
  targetType: TargetType,
  targetId: string,
): string | undefined {
  const candidate = options.find(
    (option) =>
      option.targetType === targetType && option.targetId === targetId,
  );
  const candidateName = candidate?.label;
  const comparableCandidateName = candidateName?.trim();
  if (candidateName && comparableCandidateName !== targetId) {
    return candidateName;
  }
  const existingName = current.find(
    (target) =>
      target.targetType === targetType && target.targetId === targetId,
  )?.targetName;
  return existingName?.trim() ? existingName : undefined;
}
