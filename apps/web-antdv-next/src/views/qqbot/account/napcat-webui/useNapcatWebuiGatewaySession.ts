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
 * Owns one NapCat WebUI gateway session for the current account page lifetime.
 *
 * @param accountId - Reactive account id read from the route.
 * @returns Reactive gateway session state and lifecycle actions.
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
   * Opens a new gateway session after revoking any existing local session.
   *
   * @returns A promise that settles after the open attempt finishes.
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
   * Revokes the current gateway session and clears local iframe credentials.
   *
   * @returns A promise that settles after local state has been cleared.
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
   * Sends one heartbeat for the active ready session and updates its expiry.
   *
   * @returns A promise that settles after the heartbeat attempt finishes.
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
   * Applies the gateway session payload returned by the backend.
   *
   * @param result - Gateway session payload containing iframe URL and metadata.
   */
  function applyGatewaySession(result: QqbotNapcatApi.WebuiGatewaySession) {
    account.value = result.account;
    container.value = result.container;
    expiresAt.value = result.expiresAt;
    iframeUrl.value = result.iframeUrl;
    sessionId.value = result.sessionId;
  }

  /**
   * Clears all local data that can keep a gateway session reachable.
   */
  function clearGatewaySession() {
    account.value = undefined;
    container.value = undefined;
    expiresAt.value = undefined;
    iframeUrl.value = '';
    sessionId.value = '';
  }

  /**
   * Revokes a session created after this composable was already invalidated.
   *
   * @param staleSessionId - Session id returned by an outdated open request.
   * @returns A promise that ignores revoke failures because the page is leaving.
   */
  async function revokeDetachedSession(staleSessionId: string) {
    try {
      await revokeQqbotNapcatWebuiSession(staleSessionId);
    } catch {
      // The page has already moved on; the backend TTL remains the fallback.
    }
  }

  /**
   * Marks the composable disposed and starts best-effort session revocation.
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
 * Extracts a user-facing error message from unknown rejection values.
 *
 * @param error - Unknown error thrown by the request client.
 * @param fallback - Message to show when the error has no readable text.
 * @returns A Chinese or backend-provided message for page alerts.
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
