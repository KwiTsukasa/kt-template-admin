import type { PropType } from 'vue';

import type { QqbotMessageSubscriberApi } from '#/api/message-management/subscribers/qqbot';

import { computed, defineComponent, ref } from 'vue';

import Alert from 'antdv-next/dist/alert/index';
import Select from 'antdv-next/dist/select/index';

const AAlert = Alert as any;
const ASelect = Select as any;

type TargetType = QqbotMessageSubscriberApi.TargetType;

interface TargetSelectOption {
  label: string;
  targetId: string;
  value: string;
}

export interface MessagePushTargetPickerProps {
  available: boolean;
  disabled?: boolean;
  loading?: boolean;
  options: QqbotMessageSubscriberApi.TargetOption[];
  reasonCode: null | string;
  value: QqbotMessageSubscriberApi.PublishTargetInput[];
}

/**
 * 通过纯数字格式检查 QQ 用户或群目标标识是否合法。
 *
 * @param targetId - 私聊 QQ 或群聊目标的字符串标识。
 * @returns 目标标识是非空纯数字字符串时为 true。
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
      type: Array as PropType<QqbotMessageSubscriberApi.TargetOption[]>,
    },
    reasonCode: {
      default: null,
      type: String as PropType<null | string>,
    },
    value: {
      default: () => [],
      type: Array as PropType<QqbotMessageSubscriberApi.PublishTargetInput[]>,
    },
  },
  emits: {
    'update:value': (value: QqbotMessageSubscriberApi.PublishTargetInput[]) =>
      Array.isArray(value),
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

    /**
     * 规范化指定目标类型的选择值并向父表单提交完整目标列表。
     *
     * @param targetType - 要读取或更新的 private 私聊、group 群聊目标类型。
     * @param runtimeValue - 选择框回传的未知运行时值；仅合法、非空字符串会被保留。
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
      <div
        class="qqbot-message-push-target-picker w-full"
        style={{ width: '100%' }}
      >
        {(() => {
          if (props.available) {
            return null;
          }
          return (
            <AAlert
              class="mb-3"
              message={props.reasonCode || ''}
              showIcon
              type="warning"
            />
          );
        })()}
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

/**
 * 从已保存目标中提取指定私聊或群聊类型的 QQ 标识。
 *
 * @param targets - 账号推送绑定中已保存的私聊与群聊目标。
 * @param targetType - 要读取或更新的 private 私聊、group 群聊目标类型。
 * @returns 指定私聊或群聊类型的已选目标标识数组。
 */
function targetIdsForType(
  targets: QqbotMessageSubscriberApi.PublishTargetInput[],
  targetType: TargetType,
): string[] {
  return targets
    .filter((target) => target.targetType === targetType)
    .map((target) => target.targetId);
}

/**
 * 将账号候选项转换成指定目标类型的选择框候选项。
 *
 * @param options - 指定目标类型可选择的账号或群候选项。
 * @param targetType - 要读取或更新的 private 私聊、group 群聊目标类型。
 * @returns 带类型、显示名称和值的选择框候选项。
 */
function createSelectOptions(
  options: QqbotMessageSubscriberApi.TargetOption[],
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
 * 根据显示名称、目标标识和值过滤消息推送候选项。
 *
 * @param input - 选择框输入的搜索文本。
 * @param option - 选择框候选项，显示名称、标识和值都可参与过滤。
 * @returns 搜索文本命中名称、目标标识或值时为 true。
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
 * 将选择框运行时值规整为合法、非空且不重复的 QQ 标识。
 *
 * @param runtimeValue - 选择框回传的未知运行时值；仅合法、非空字符串会被保留。
 * @returns 从运行时值中提取的合法、非空且不重复目标标识。
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
 * 判断运行时选择值是否包含被规范化规则拒绝的目标。
 *
 * @param runtimeValue - 选择框回传的未知运行时值；仅合法、非空字符串会被保留。
 * @param normalized - 同一运行时选择值经过去空、校验和去重后的目标标识。
 * @returns 原始选择含空值、非法格式或规范化后丢失项时为 true。
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
 * 将本次目标类型的最新选择与另一类型的既有目标合并。
 *
 * @param current - 变更前已经选中的私聊与群聊目标。
 * @param options - 指定目标类型可选择的账号或群候选项。
 * @param changedType - 本次更新的是私聊目标还是群聊目标。
 * @param changedIds - 发生变更的目标类型最新选中标识。
 * @returns 保留另一类型并替换变更类型后的完整推送目标数组。
 */
function mergeTargets(
  current: QqbotMessageSubscriberApi.PublishTargetInput[],
  options: QqbotMessageSubscriberApi.TargetOption[],
  changedType: TargetType,
  changedIds: string[],
): QqbotMessageSubscriberApi.PublishTargetInput[] {
  const idsByType: Record<TargetType, string[]> = {
    group: (() => {
      if (changedType === 'group') {
        return changedIds;
      }
      return targetIdsForType(current, 'group');
    })(),
    private: (() => {
      if (changedType === 'private') {
        return changedIds;
      }
      return targetIdsForType(current, 'private');
    })(),
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
        ...(() => {
          if (targetName) {
            return { targetName };
          }
          return {};
        })(),
        targetType,
      };
    }),
  );
}

/**
 * 优先从候选项或既有配置中解析同类型目标名称。
 *
 * @param current - 变更前已经选中的私聊与群聊目标。
 * @param options - 指定目标类型可选择的账号或群候选项。
 * @param targetType - 要读取或更新的 private 私聊、group 群聊目标类型。
 * @param targetId - 私聊 QQ 或群聊目标的字符串标识。
 * @returns 候选项或既有配置中的目标名称；均未命中时为 undefined。
 */
function resolveTargetName(
  current: QqbotMessageSubscriberApi.PublishTargetInput[],
  options: QqbotMessageSubscriberApi.TargetOption[],
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
  if (existingName?.trim()) {
    return existingName;
  }
  return undefined;
}
