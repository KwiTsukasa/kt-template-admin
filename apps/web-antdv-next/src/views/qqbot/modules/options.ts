export const qqbotTargetTypeOptions = [
  { label: '全部', value: 'all' },
  { label: '私聊', value: 'private' },
  { label: '群聊', value: 'group' },
  { label: '频道', value: 'channel' },
];

export const qqbotMessageTypeOptions = [
  { label: '私聊', value: 'private' },
  { label: '群聊', value: 'group' },
  { label: '频道', value: 'channel' },
];

export const qqbotRuleMatchOptions = [
  { label: '关键词包含', value: 'keyword' },
  { label: '完全相等', value: 'equals' },
  { label: '正则匹配', value: 'regex' },
];

export const qqbotRuleTargetOptions = qqbotTargetTypeOptions;

export const qqbotCommandParserOptions = [
  { label: '普通文本', value: 'plain' },
  { label: 'FF14 查价', value: 'ff14Price' },
];

export const qqbotPermissionTargetOptions = [
  { label: 'QQ号', value: 'qq' },
  { label: '群聊', value: 'group' },
  { label: '频道', value: 'channel' },
];

const qqbotDefaultSendStatusOption = {
  color: 'default',
  label: '等待中',
  value: 'pending',
};

export const qqbotSendStatusOptions = [
  qqbotDefaultSendStatusOption,
  { color: 'success', label: '成功', value: 'success' },
  { color: 'error', label: '失败', value: 'failed' },
];

/**
 * 从 QQBot 枚举选项中读取标签，未匹配时依次回退到原始值和占位符。
 *
 * @param options - 可按值查找标签的 QQBot 枚举选项数组。
 * @param value - 要查找显示标签的枚举值；未匹配时直接显示该值。
 * @returns 匹配选项的中文标签；未匹配时依次回退到原始值和 `-`。
 */
export function getOptionLabel(
  options: Array<{ label: string; value: string }>,
  value?: string,
) {
  return options.find((item) => item.value === value)?.label || value || '-';
}

/**
 * 将消息投递状态映射为标签颜色，未知状态使用默认选项。
 *
 * @param status - 消息投递的 pending、success 或 failed 状态；未知值回退为等待中。
 * @returns 与发送状态匹配的选项；未知状态回退为默认选项。
 */
export function getSendStatusOption(status?: string) {
  return (
    qqbotSendStatusOptions.find((item) => item.value === status) ||
    qqbotDefaultSendStatusOption
  );
}
