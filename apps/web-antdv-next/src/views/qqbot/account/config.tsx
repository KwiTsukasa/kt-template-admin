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
      return account.value.name
        ? `${account.value.name}（${account.value.selfId}）`
        : account.value.selfId;
    });

    watch(
      selfId,
      () => {
        void loadAccount();
      },
      { immediate: true },
    );

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

    function normalizeQueryValue(value: unknown) {
      if (Array.isArray(value)) return `${value[0] || ''}`.trim();
      return `${value || ''}`.trim();
    }

    function goBack() {
      void router.push({ name: 'QqBotAccount' });
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
              {account.value ? (
                <Tag
                  color={
                    account.value.connectStatus === 'online'
                      ? 'success'
                      : 'default'
                  }
                >
                  {account.value.connectStatus === 'online'
                    ? 'OneBot 在线'
                    : 'OneBot 离线'}
                </Tag>
              ) : null}
            </div>
          </div>

          <div class="qqbot-account-config__content">
            <ASpin spinning={loading.value}>
              {errorMessage.value ? (
                <Alert message={errorMessage.value} showIcon type="warning" />
              ) : (
                <AccountConfigPanel account={account.value} />
              )}
            </ASpin>
          </div>
        </div>
      </Page>
    );
  },
});
