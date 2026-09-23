import type { BotApi } from '#/api/bot';

const containerIssueLabels = new Map([
  ['creating', '容器创建中'],
  ['error', '容器异常'],
  ['stopped', '容器已停止'],
]);

const qqLoginLabels = new Map<BotApi.QqLoginStatus, string>([
  ['offline', 'QQ 离线'],
  ['qrcode_expired', '二维码已过期，点击更新登录'],
  ['qrcode_pending', '等待扫码登录'],
  ['unknown', 'QQ 登录状态未知'],
]);

/**
 * 优先使用明确 OneBot 状态，再依 NapCat 标志和后端同义的 connectStatus 回退。
 * @param row - 包含连接与 NapCat 运行字段的账号。
 * @returns 已声明或回退的 OneBot 在线/离线状态。
 */
export function getAccountOneBotStatus(
  row: BotApi.Account,
): BotApi.OneBotStatus {
  if (row.oneBotStatus) return row.oneBotStatus;
  if (row.napcat?.oneBotOnline === true) return 'online';
  if (row.napcat?.oneBotOnline === false) return 'offline';
  return row.connectStatus;
}

/**
 * 优先使用账号级 QQ 登录状态，再使用 NapCat 状态，缺失时保持未知。
 * @param row - 包含两层 QQ 登录字段的账号。
 * @returns 当前声明的 QQ 登录状态或 unknown。
 */
export function getAccountQqLoginStatus(
  row: BotApi.Account,
): BotApi.QqLoginStatus {
  return row.qqLoginStatus || row.napcat?.qqLoginStatus || 'unknown';
}

/**
 * 按停用、容器、QQ、OneBot 顺序投影当前事实；未识别状态不进入连接成功分支。
 * @param row - 需要计算当前运行说明的账号。
 * @returns 当前状态说明及普通或警告等级。
 */
function getCurrentRuntimeStatus(row: BotApi.Account) {
  if (!row.enabled) return { level: 'warning', text: '账号已停用' } as const;
  if (row.connectionMode !== 'reverse-ws') {
    if (row.connectStatus === 'online') {
      return { level: 'normal', text: '连接在线' } as const;
    }
    return { level: 'warning', text: '连接离线' } as const;
  }

  const containerStatus = row.containerStatus || row.napcat?.containerStatus;
  const containerIssue = containerIssueLabels.get(containerStatus || '');
  if (containerIssue) {
    return {
      level: 'warning',
      text: containerIssue,
    } as const;
  }
  if (!row.napcat) {
    return { level: 'warning', text: '可更新登录绑定容器' } as const;
  }

  const oneBotStatus = getAccountOneBotStatus(row);
  const qqLoginStatus = getAccountQqLoginStatus(row);
  if (
    qqLoginStatus === 'online' &&
    oneBotStatus === 'online' &&
    containerStatus === 'running'
  ) {
    return { level: 'normal', text: 'QQ 与 OneBot 已连接' } as const;
  }
  if (qqLoginStatus !== 'online') {
    let text = qqLoginLabels.get(qqLoginStatus) || 'QQ 登录状态未知';
    if (
      oneBotStatus === 'online' &&
      (qqLoginStatus === 'offline' || qqLoginStatus === 'unknown')
    ) {
      text = `${text}，OneBot 在线`;
    }
    return { level: 'warning', text } as const;
  }
  if (oneBotStatus !== 'online') {
    return { level: 'warning', text: 'QQ 在线，等待 OneBot 连接' } as const;
  }
  return {
    level: 'warning',
    text: 'QQ 与 OneBot 已连接，容器状态未确认',
  } as const;
}

/**
 * 把当前运行事实与持久保留的错误文字并列输出，历史错误不覆盖当前连接状态。
 * @param row - 需要生成列表运行说明的账号与 NapCat 状态。
 * @returns 当前状态等级、说明和独立的最近错误记录。
 */
export function getAccountRuntimeSummary(row: BotApi.Account) {
  const recentErrors = [row.lastError, row.napcat?.lastError].filter(
    (value): value is string => !!value,
  );
  return {
    ...getCurrentRuntimeStatus(row),
    recentErrors: [...new Set(recentErrors)],
  };
}
