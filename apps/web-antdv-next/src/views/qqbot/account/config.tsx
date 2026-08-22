import type { QqbotApi } from '#/api/qqbot';

import { computed, defineComponent, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { ArrowLeft } from '@vben/icons';

import { Alert, Button, Spin, Tag } from 'antdv-next';

import { getQqbotAccountList } from '#/api/qqbot';

import AccountConfigPanel from './components/AccountConfigPanel';

import './config.scss';

const AButton = Button as any;
const ASpin = Spin as any;

export default defineComponent({
  name: 'QqBotAccountConfig',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const account = ref<QqbotApi.Account>();
    const errorMessage = ref('');
    const loading = ref(false);

    const selfId = computed(() => normalizeQueryValue(route.query.selfId));
    const accountTitle = computed(() => {
      if (!account.value) return '账号功能配置';
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

    /**
     * 按路由 Self ID 查找 QQBot 账号并更新配置页；缺少或未匹配账号时写入明确错误。
     */
    async function loadAccount() {
      const currentSelfId = selfId.value;
      account.value = undefined;
      errorMessage.value = '';

      if (!currentSelfId) {
        errorMessage.value = '缺少账号 Self ID，请从账号连接列表进入配置页。';
        return;
      }

      loading.value = true;
      try {
        const result = await getQqbotAccountList({
          pageNo: 1,
          pageSize: 20,
          selfId: currentSelfId,
        });
        const matched = (result.list || []).find(
          (item) => item.selfId === currentSelfId,
        );
        if (!matched) {
          errorMessage.value = `未找到账号 ${currentSelfId}，请返回账号连接列表确认账号状态。`;
          return;
        }
        account.value = matched;
      } finally {
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
     * 根据浏览器历史优先返回来源页面；没有可用记录时跳转到模块默认列表页。
     */
    function goBack() {
      void router.push({ name: 'QqBotAccount' });
    }

    /**
     * 把账号接入方式映射为配置页短标签，避免官方账号继续显示 OneBot 文案。
     *
     * @param connectionMode - 当前 QQBot 账号接入方式。
     * @returns NapCat、官方 WebSocket 或官方 Webhook 标签。
     */
    function getConnectionModeLabel(connectionMode: QqbotApi.ConnectionMode) {
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
    function getConnectionStatusLabel(current: QqbotApi.Account) {
      let prefix = 'OneBot';
      if (current.connectionMode === 'official-websocket') prefix = 'Gateway';
      if (current.connectionMode === 'official-webhook') prefix = 'Webhook';
      if (current.connectStatus === 'online') return `${prefix} 在线`;
      return `${prefix} 离线`;
    }

    return () => (
      <Page autoContentHeight>
        <div class="qqbot-account-config">
          <div class="qqbot-account-config__header">
            <AButton
              class="qqbot-account-config__back"
              onClick={goBack}
              type="text"
            >
              <ArrowLeft class="qqbot-account-config__back-icon" />
              返回账号列表
            </AButton>
            <div class="qqbot-account-config__title">
              <span>{accountTitle.value}</span>
              {(() => {
                if (account.value) {
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

          <div class="qqbot-account-config__content">
            <ASpin spinning={loading.value}>
              {(() => {
                if (errorMessage.value) {
                  return (
                    <Alert showIcon title={errorMessage.value} type="warning" />
                  );
                }
                return <AccountConfigPanel account={account.value} />;
              })()}
            </ASpin>
          </div>
        </div>
      </Page>
    );
  },
});
