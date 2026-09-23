import type { VNodeChild } from 'vue';

import type { BotApi } from '#/api/bot';

import { computed, defineComponent, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { ArrowLeft } from '@vben/icons';

import { Alert, Button, Spin, Tag } from 'antdv-next';

import { getBotAccountList } from '#/api/bot';
import { usePageReturn } from '#/hooks/usePageReturn';

import AccountConfigPanel from './components/AccountConfigPanel';

import './config.scss';

const AButton = Button as any;
const ASpin = Spin as any;

export default defineComponent({
  name: 'BotNapcatConfig',
  setup() {
    const route = useRoute();
    const goBack = usePageReturn({ name: 'BotNapcatConnection' });
    const account = ref<BotApi.Account>();
    const errorMessage = ref('');
    const readFailed = ref(false);
    const loading = ref(false);
    let requestGeneration = 0;
    let disposed = false;

    const selfId = computed(() => normalizeQueryValue(route.query.selfId));
    const accountTitle = computed(() => {
      if (!account.value || account.value.selfId !== selfId.value)
        return '账号功能配置';
      if (account.value.name) {
        return `${account.value.name}（${account.value.selfId}）`;
      }
      return account.value.selfId;
    });

    watch(
      selfId,
      () => {
        void loadAccount();
      },
      { immediate: true },
    );

    onBeforeUnmount(() => {
      disposed = true;
      requestGeneration += 1;
    });

    /**
     * 仅允许同一轮且仍对应当前路由账号的读取完成提交页面状态。
     * @param request - 发起读取时分配的递增请求序号。
     * @param requestedSelfId - 发起读取时捕获的账号 Self ID。
     * @returns 页面未卸载、轮次和路由账号均一致时为 true。
     */
    function isCurrentAccountRequest(request: number, requestedSelfId: string) {
      return (
        !disposed &&
        request === requestGeneration &&
        selfId.value === requestedSelfId
      );
    }

    /**
     * 按路由 Self ID 查找账号，仅当前请求可写页面状态；失败、缺失与未找到分别呈现。
     */
    async function loadAccount() {
      const currentSelfId = selfId.value;
      const request = ++requestGeneration;
      account.value = undefined;
      errorMessage.value = '';
      readFailed.value = false;

      if (!currentSelfId) {
        loading.value = false;
        errorMessage.value = '缺少账号 Self ID，请从账号连接列表进入配置页。';
        return;
      }

      loading.value = true;
      try {
        const result = await getBotAccountList({
          pageNo: 1,
          pageSize: 20,
          selfId: currentSelfId,
        });
        if (!isCurrentAccountRequest(request, currentSelfId)) return;
        if (!Array.isArray(result.list)) {
          readFailed.value = true;
          errorMessage.value = '账号读取失败，请重试。';
          return;
        }
        const matched = result.list.find(
          (item) => item.selfId === currentSelfId,
        );
        if (!matched) {
          errorMessage.value = `未找到账号 ${currentSelfId}，请返回账号连接列表确认账号状态。`;
          return;
        }
        account.value = matched;
      } catch {
        if (!isCurrentAccountRequest(request, currentSelfId)) return;
        readFailed.value = true;
        errorMessage.value = '账号读取失败，请重试。';
      } finally {
        if (isCurrentAccountRequest(request, currentSelfId))
          loading.value = false;
      }
    }

    /**
     * 把查询参数数组或标量归一为去除两端空白的单个字符串。
     *
     * @param value - 账号配置页 query 的字符串、字符串数组或空值；数组只读取首项。
     * @returns 去除两端空白的首个查询参数字符串；参数缺失时为空字符串。
     */
    function normalizeQueryValue(value: unknown) {
      if (Array.isArray(value)) return `${value[0] || ''}`.trim();
      return `${value || ''}`.trim();
    }

    /**
     * 把账号接入方式映射为配置页短标签，避免官方账号继续显示 OneBot 文案。
     *
     * @param connectionMode - 当前 Bot 账号接入方式。
     * @returns NapCat、官方 WebSocket 或官方 Webhook 标签。
     */
    function getConnectionModeLabel(connectionMode: BotApi.ConnectionMode) {
      if (connectionMode === 'official-websocket') return '官方 WebSocket';
      if (connectionMode === 'official-webhook') return '官方 Webhook';
      return 'NapCat OneBot';
    }

    /**
     * 根据 transport 生成在线状态文案。
     *
     * @param current - 当前配置页账号。
     * @returns 对应 OneBot、Gateway 或 Webhook 的在线/离线文案。
     */
    function getConnectionStatusLabel(current: BotApi.Account) {
      let prefix = 'OneBot';
      if (current.connectionMode === 'official-websocket') prefix = 'Gateway';
      if (current.connectionMode === 'official-webhook') prefix = 'Webhook';
      if (current.connectStatus === 'online') return `${prefix} 在线`;
      return `${prefix} 离线`;
    }

    return () => (
      <Page autoContentHeight>
        <div class="bot-account-config">
          <div class="bot-account-config__header">
            <AButton
              class="bot-account-config__back"
              onClick={goBack}
              type="text"
            >
              <ArrowLeft class="bot-account-config__back-icon" />
              返回账号列表
            </AButton>
            <div class="bot-account-config__title">
              <span>{accountTitle.value}</span>
              {(() => {
                if (account.value && account.value.selfId === selfId.value) {
                  return (
                    <>
                      <Tag color="blue">
                        {getConnectionModeLabel(account.value.connectionMode)}
                      </Tag>
                      <Tag
                        color={(() => {
                          if (account.value.connectStatus === 'online') {
                            return 'success';
                          }
                          return 'default';
                        })()}
                      >
                        {getConnectionStatusLabel(account.value)}
                      </Tag>
                    </>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          <div class="bot-account-config__content">
            <ASpin spinning={loading.value}>
              {(() => {
                if (loading.value) {
                  return <span role="status">正在读取账号…</span>;
                }
                if (errorMessage.value) {
                  let retryAction: VNodeChild = null;
                  if (readFailed.value) {
                    retryAction = (
                      <AButton onClick={() => void loadAccount()}>重试</AButton>
                    );
                  }
                  return (
                    <Alert
                      action={retryAction}
                      showIcon
                      title={errorMessage.value}
                      type="warning"
                    />
                  );
                }
                if (account.value?.selfId === selfId.value) {
                  return <AccountConfigPanel account={account.value} />;
                }
                return null;
              })()}
            </ASpin>
          </div>
        </div>
      </Page>
    );
  },
});
