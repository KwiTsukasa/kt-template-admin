import type { NapcatWebuiGatewaySessionState } from './useNapcatWebuiGatewaySession';

import { computed, defineComponent, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ArrowLeft } from '@vben/icons';

import { Alert, Button, Space, Spin, Tag } from 'antdv-next';

import { useNapcatWebuiGatewaySession } from './useNapcatWebuiGatewaySession';

import './index.scss';

const AAlert = Alert as any;
const AButton = Button as any;
const ASpace = Space as any;
const ASpin = Spin as any;
const ATag = Tag as any;

export default defineComponent({
  name: 'QqBotAccountNapcatWebui',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const routeAccountId = computed(() =>
      normalizeRouteParam(route.params.accountId),
    );
    const session = useNapcatWebuiGatewaySession(routeAccountId);
    const accountTitle = computed(() => {
      const account = session.account.value;
      if (!account) return 'NapCat WebUI';
      if (account.name) return `${account.name}（${account.selfId}）`;
      return account.selfId;
    });
    const expiresAtText = computed(() =>
      formatGatewayExpiresAt(session.expiresAt.value),
    );
    const statusMeta = computed(() => getStatusMeta(session.state.value));

    watch(
      routeAccountId,
      () => {
        void session.open();
      },
      { immediate: true },
    );

    function goBack() {
      void router.push({ name: 'QqBotAccount' });
    }

    function reopen() {
      void session.open();
    }

    function closeSession() {
      void session.revoke();
    }

    const renderFloatingCard = () => {
      return (
        <div class="qqbot-napcat-webui__floating-card">
          <div class="qqbot-napcat-webui__floating-head">
            <span class="qqbot-napcat-webui__floating-title">
              {accountTitle.value}
            </span>
            <ATag color={statusMeta.value.color}>{statusMeta.value.label}</ATag>
          </div>
          <div class="qqbot-napcat-webui__floating-meta">
            <span>NapCat WebUI</span>
            {expiresAtText.value ? (
              <span>有效期：{expiresAtText.value}</span>
            ) : null}
          </div>
          <ASpace class="qqbot-napcat-webui__floating-actions" size={6}>
            <AButton onClick={goBack} size="small" type="text">
              <ArrowLeft class="qqbot-napcat-webui__back-icon" />
              返回
            </AButton>
            <AButton
              disabled={session.state.value === 'loading'}
              onClick={reopen}
              size="small"
            >
              重开
            </AButton>
            <AButton
              danger
              disabled={session.state.value === 'loading'}
              onClick={closeSession}
              size="small"
            >
              关闭
            </AButton>
          </ASpace>
        </div>
      );
    };

    const renderBody = () => {
      if (session.state.value === 'ready' && session.iframeUrl.value) {
        return (
          <div class="qqbot-napcat-webui__iframe-shell">
            <iframe
              class="qqbot-napcat-webui__iframe"
              src={session.iframeUrl.value}
              title={`NapCat WebUI ${accountTitle.value}`}
            />
          </div>
        );
      }

      if (
        session.state.value === 'error' ||
        session.state.value === 'revoked'
      ) {
        return (
          <div class="qqbot-napcat-webui__message">
            <AAlert
              showIcon
              title={
                session.state.value === 'error'
                  ? session.errorMessage.value
                  : 'NapCat WebUI 会话已关闭。'
              }
              type={session.state.value === 'error' ? 'error' : 'info'}
            />
            <AButton onClick={reopen} type="primary">
              重新打开
            </AButton>
          </div>
        );
      }

      return (
        <div class="qqbot-napcat-webui__center">
          <ASpin spinning={session.state.value === 'loading'} />
        </div>
      );
    };

    const renderPage = () => {
      return (
        <div class="qqbot-napcat-webui-page">
          <div class="qqbot-napcat-webui">
            <div class="qqbot-napcat-webui__content">{renderBody()}</div>
            {renderFloatingCard()}
          </div>
        </div>
      );
    };

    return renderPage;
  },
});

function normalizeRouteParam(value: unknown) {
  if (Array.isArray(value)) return `${value[0] || ''}`.trim();
  return `${value || ''}`.trim();
}

function formatGatewayExpiresAt(value?: number) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (unit: number) => `${unit}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}`;
}

function getStatusMeta(state: NapcatWebuiGatewaySessionState) {
  const statusMap = {
    error: { color: 'error', label: '异常' },
    idle: { color: 'default', label: '待打开' },
    loading: { color: 'processing', label: '打开中' },
    ready: { color: 'success', label: '已连接' },
    revoked: { color: 'default', label: '已关闭' },
  } as const;
  return statusMap[state];
}
