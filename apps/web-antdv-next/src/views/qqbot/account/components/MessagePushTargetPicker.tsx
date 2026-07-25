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

/** 判断 QQ 群号或 QQ 号是否满足消息推送目标格式。 */
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
    'update:value': (
      value: QqbotMessagePushApi.QqbotMessagePublishTargetInput[],
    ) => Array.isArray(value),
  },
  setup(props, { emit }) {
    const groupRevision = ref(0);
    const privateRevision = ref(0);

    const groupIds = computed(() => targetIdsForType(props.value, 'group'));
    const privateIds = computed(() => targetIdsForType(props.value, 'private'));
    const groupOptions = computed(() =>
      createSelectOptions(props.options, 'group'),
    );
    const privateOptions = computed(() =>
      createSelectOptions(props.options, 'private'),
    );

    /** 规范化指定目标类型的选择值并向父表单提交完整目标列表。 */
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
      <div
        class="qqbot-message-push-target-picker w-full"
        style={{ width: '100%' }}
      >
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
            style={{ width: '100%' }}
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
            style={{ width: '100%' }}
            value={privateIds.value}
          />
        </div>
      </div>
    );
  },
});

/** 提取指定目标类型的已选 QQ 标识。 */
function targetIdsForType(
  targets: QqbotMessagePushApi.QqbotMessagePublishTargetInput[],
  targetType: TargetType,
): string[] {
  return targets
    .filter((target) => target.targetType === targetType)
    .map((target) => target.targetId);
}

/** 将账号候选项转换成指定目标类型的选择框候选项。 */
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

/** 按显示名称、目标标识和值过滤消息推送候选项。 */
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

/** 规范化选择框运行时值并移除无效或重复目标。 */
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

/** 判断运行时选择值是否包含被规范化规则拒绝的目标。 */
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

/** 合并本次变更与另一目标类型的既有选择。 */
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

/** 优先从候选项或既有配置中解析同类型目标名称。 */
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
