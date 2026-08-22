import type { DescriptionsItemType } from 'antdv-next';

import type { BotApi } from '#/api/bot';

import { defineComponent, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Card, Col, Descriptions, Row, Statistic, Tag } from 'antdv-next';

import { getBotDashboardSummary } from '#/api/bot';

const ACard = Card as any;
const ACol = Col as any;
const ADescriptions = Descriptions as any;
const ARow = Row as any;
const AStatistic = Statistic as any;
const ATag = Tag as any;

export default defineComponent({
  name: 'BotDashboardList',
  setup() {
    const loading = ref(false);
    const summary = ref<BotApi.DashboardSummary>();

    /**
     * 加载 Bot 总览统计并写入页面状态，同时维护加载指示。
     */
    async function loadSummary() {
      loading.value = true;
      try {
        summary.value = await getBotDashboardSummary();
      } finally {
        loading.value = false;
      }
    }

    onMounted(loadSummary);

    return () => {
      const data = summary.value;
      const runtimeItems: DescriptionsItemType[] = [
        {
          content: (
            <ATag
              color={(() => {
                if (data?.napcatRuntime.enabled) {
                  return 'success';
                }
                return 'default';
              })()}
            >
              {(() => {
                if (data?.napcatRuntime.enabled) {
                  return '已启用';
                }
                return '未启用';
              })()}
            </ATag>
          ),
          key: 'runtime',
          label: 'NapCat Runtime',
        },
        {
          content: data?.napcatRuntime.path || '-',
          key: 'reverseWsPath',
          label: '反向 WS 路径',
        },
        {
          content: data?.napcatRuntime.sessions?.length || 0,
          key: 'sessions',
          label: '在线会话',
        },
        {
          content: (
            <ATag
              color={(() => {
                if (data?.bus.connected) {
                  return 'success';
                }
                return 'default';
              })()}
            >
              {data?.bus.mode || 'local'} /{' '}
              {(() => {
                if (data?.bus.connected) {
                  return '已连接';
                }
                return '未连接';
              })()}
            </ATag>
          ),
          key: 'mqtt',
          label: 'MQTT',
        },
        {
          content: data?.conversationTotal || 0,
          key: 'conversationTotal',
          label: '会话数',
        },
        {
          content: `${data?.sendSuccessTotal || 0}/${data?.sendFailedTotal || 0}`,
          key: 'sendResult',
          label: '发送成功/失败',
        },
      ];

      return (
        <Page autoContentHeight>
          <div style={{ display: 'grid', gap: '16px' }}>
            <ARow gutter={[16, 16]}>
              <ACol span={6}>
                <ACard loading={loading.value}>
                  <AStatistic
                    title="账号总数"
                    value={data?.accountTotal || 0}
                  />
                </ACard>
              </ACol>
              <ACol span={6}>
                <ACard loading={loading.value}>
                  <AStatistic title="在线账号" value={data?.onlineTotal || 0} />
                </ACard>
              </ACol>
              <ACol span={6}>
                <ACard loading={loading.value}>
                  <AStatistic
                    title="启用规则"
                    value={data?.enabledRuleTotal || 0}
                  />
                </ACard>
              </ACol>
              <ACol span={6}>
                <ACard loading={loading.value}>
                  <AStatistic
                    title="消息总数"
                    value={data?.messageTotal || 0}
                  />
                </ACard>
              </ACol>
            </ARow>

            <ACard loading={loading.value} title="运行状态">
              <ADescriptions
                bordered
                column={2}
                items={runtimeItems}
                size="small"
              />
            </ACard>
          </div>
        </Page>
      );
    };
  },
});
