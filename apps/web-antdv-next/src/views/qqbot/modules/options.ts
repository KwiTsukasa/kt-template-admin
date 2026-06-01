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

export function getOptionLabel(
  options: Array<{ label: string; value: string }>,
  value?: string,
) {
  return options.find((item) => item.value === value)?.label || value || '-';
}

export function getSendStatusOption(status?: string) {
  return (
    qqbotSendStatusOptions.find((item) => item.value === status) ||
    qqbotDefaultSendStatusOption
  );
}
