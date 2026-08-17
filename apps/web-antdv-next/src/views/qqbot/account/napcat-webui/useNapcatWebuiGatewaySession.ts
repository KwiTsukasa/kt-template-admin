import type { Ref } from 'vue';

import type { QqbotNapcatApi } from '#/api/qqbot/napcat';

import { onBeforeUnmount, ref } from 'vue';

import { useIntervalFn } from '@vueuse/core';

import {
  createQqbotNapcatWebuiSession,
  heartbeatQqbotNapcatWebuiSession,
  revokeQqbotNapcatWebuiSession,
} from '#/api/qqbot/napcat';

export type NapcatWebuiGatewaySessionState =
  | 'error'
  | 'idle'
  | 'loading'
  | 'ready'
  | 'revoked';

/**
 * 创建、心跳续期并撤销 NapCat WebUI 临时会话；过期创建响应会主动回收且不覆盖当前会话。
 *
 * @param accountId - 用于查询运行态或创建 WebUI 会话的 QQBot 账号唯一标识。
 * @returns 包含临时会话、账号、容器、iframe、错误状态及打开和撤销方法的网关会话控制器。
 */
export function useNapcatWebuiGatewaySession(accountId: Ref<string>) {
  const account = ref<QqbotNapcatApi.WebuiGatewaySessionAccount>();
  const container = ref<QqbotNapcatApi.WebuiGatewaySessionContainer>();
  const errorMessage = ref('');
  const expiresAt = ref<number>();
  const iframeUrl = ref('');
  const sessionId = ref('');
  const state = ref<NapcatWebuiGatewaySessionState>('idle');
  let disposed = false;
  let openToken = 0;

  const heartbeat = useIntervalFn(sendHeartbeat, 20_000, {
    immediate: false,
  });

  onBeforeUnmount(handleBeforeUnmount);

  /**
   * 撤销旧会话后为当前账号创建 NapCat WebUI 临时会话；过期响应会回收且不会覆盖新会话。
   */
  async function open() {
    const nextAccountId = accountId.value.trim();
    heartbeat.pause();
    errorMessage.value = '';

    if (sessionId.value) {
      await revoke();
      errorMessage.value = '';
    }

    if (!nextAccountId) {
      state.value = 'error';
      errorMessage.value =
        '缺少账号 ID，请从账号连接列表重新进入 NapCat WebUI。';
      return;
    }

    const currentOpenToken = ++openToken;
    state.value = 'loading';

    try {
      const result = await createQqbotNapcatWebuiSession({
        accountId: nextAccountId,
      });
      if (disposed || currentOpenToken !== openToken) {
        await revokeDetachedSession(result.sessionId);
        return;
      }
      applyGatewaySession(result);
      state.value = 'ready';
      heartbeat.resume();
    } catch (error) {
      if (currentOpenToken !== openToken) return;
      heartbeat.pause();
      state.value = 'error';
      errorMessage.value = getErrorMessage(
        error,
        'NapCat WebUI 会话创建失败，请稍后重试。',
      );
    }
  }

  /**
   * 停止 WebUI 心跳并撤销当前网关会话，随后清空浏览器端会话状态。
   */
  async function revoke() {
    openToken += 1;
    heartbeat.pause();
    const currentSessionId = sessionId.value;

    if (!currentSessionId) {
      clearGatewaySession();
      state.value = 'revoked';
      return;
    }

    try {
      await revokeQqbotNapcatWebuiSession(currentSessionId);
    } catch (error) {
      errorMessage.value = getErrorMessage(
        error,
        'NapCat WebUI 会话已在本地关闭，远端会话将等待过期。',
      );
    } finally {
      clearGatewaySession();
      state.value = 'revoked';
    }
  }

  /**
   * 仅在网关会话就绪时续期有效期；请求失败会暂停心跳并切换到错误状态。
   */
  async function sendHeartbeat() {
    const currentSessionId = sessionId.value;
    if (state.value !== 'ready' || !currentSessionId) return;

    try {
      const result = await heartbeatQqbotNapcatWebuiSession(currentSessionId);
      if (result.expiresAt !== undefined) {
        expiresAt.value = result.expiresAt;
      }
    } catch (error) {
      heartbeat.pause();
      state.value = 'error';
      errorMessage.value = getErrorMessage(
        error,
        'NapCat WebUI 会话心跳失败，请重新打开。',
      );
    }
  }

  /**
   * 把网关会话返回的账号、容器、有效期、iframe 与会话标识同步到响应式状态。
   *
   * @param result - 后端返回、需要写入当前会话状态的最新结果。
   */
  function applyGatewaySession(result: QqbotNapcatApi.WebuiGatewaySession) {
    account.value = result.account;
    container.value = result.container;
    expiresAt.value = result.expiresAt;
    iframeUrl.value = result.iframeUrl;
    sessionId.value = result.sessionId;
  }

  /**
   * 将 NapCat WebUI 会话标识、iframe、过期时间及账号和容器信息。
   */
  function clearGatewaySession() {
    account.value = undefined;
    container.value = undefined;
    expiresAt.value = undefined;
    iframeUrl.value = '';
    sessionId.value = '';
  }

  /**
   * 撤销已不再绑定当前界面的旧 WebUI 会话，避免服务端残留有效凭据。
   *
   * @param staleSessionId - 已经脱离当前界面、需要在后台撤销的 WebUI 会话标识。
   */
  async function revokeDetachedSession(staleSessionId: string) {
    try {
      await revokeQqbotNapcatWebuiSession(staleSessionId);
    } catch {
      // The page has already moved on; the backend TTL remains the fallback.
    }
  }

  /**
   * 组件卸载时标记会话已释放，并异步撤销 NapCat WebUI 网关会话。
   */
  function handleBeforeUnmount() {
    disposed = true;
    void revoke();
  }

  return {
    account,
    container,
    errorMessage,
    expiresAt,
    iframeUrl,
    open,
    revoke,
    sessionId,
    state,
  };
}

/**
 * 从字符串或 Error 对象提取非空消息，无法识别时返回调用方提供的兜底文本。
 *
 * @param error - 可能为 Error、字符串或携带 err、message、msg 字段的网关异常值。
 * @param fallback - 输入无法提取消息时返回的调用方兜底文本。
 * @returns 可展示的错误文本；无法识别输入时回退为“NapCat WebUI 会话请求失败”。
 */
function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message.trim();
  }
  return fallback;
}
