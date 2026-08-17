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

    /**
     * 根据浏览器历史优先返回来源页面；没有可用记录时跳转到模块默认列表页。
     */
    function goBack() {
      void router.push({ name: 'QqBotAccount' });
    }

    /**
     * 使用上次传入的数据重新打开弹窗或抽屉，避免调用方重复组装上下文。
     */
    function reopen() {
      void session.open();
    }

    /**
     * 异步撤销当前 NapCat WebUI 网关会话。
     */
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
            {(() => {
              if (expiresAtText.value) {
                return <span>有效期：{expiresAtText.value}</span>;
              }
              return null;
            })()}
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
              title={(() => {
                if (session.state.value === 'error') {
                  return session.errorMessage.value;
                }
                return 'NapCat WebUI 会话已关闭。';
              })()}
              type={(() => {
                if (session.state.value === 'error') {
                  return 'error';
                }
                return 'info';
              })()}
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

/**
 * 把路由参数数组或标量归一为去除两端空白的单个字符串。
 *
 * @param value - WebUI 路由参数的字符串、字符串数组或空值；数组只读取首项。
 * @returns 去除两端空白的首个路由参数字符串；参数缺失时为空字符串。
 */
function normalizeRouteParam(value: unknown) {
  if (Array.isArray(value)) return `${value[0] || ''}`.trim();
  return `${value || ''}`.trim();
}

/**
 * 把网关过期时间戳格式化为本地日期时间，空值或无效时间返回空字符串。
 *
 * @param value - 网关会话的过期时间；空值表示暂不展示。
 * @returns 网关会话过期时间的本地化文本；输入缺失时为空字符串。
 */
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

/**
 * 将 WebUI 网关阶段映射为待打开、打开中、已连接、异常或已关闭。
 *
 * @param state - NapCat WebUI 网关的待打开、加载、就绪、异常或已撤销状态。
 * @returns 包含展示标签、颜色与说明的将 WebUI 网关阶段映射为待打开、打开中、已连接、异常或已关闭。
 */
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
