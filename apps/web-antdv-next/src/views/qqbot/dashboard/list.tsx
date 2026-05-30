import type { DescriptionsItemType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';

import { defineComponent, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Card, Col, Descriptions, Row, Statistic, Tag } from 'antdv-next';

import { getQqbotDashboardSummary } from '#/api/qqbot';

const ACard = Card as any;
const ACol = Col as any;
const ADescriptions = Descriptions as any;
const ARow = Row as any;
const AStatistic = Statistic as any;
const ATag = Tag as any;

export default defineComponent({
  name: 'QqBotDashboardList',
  setup() {
    const loading = ref(false);
    const summary = ref<QqbotApi.DashboardSummary>();

    async function loadSummary() {
      loading.value = true;
      try {
        summary.value = await getQqbotDashboardSummary();
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
            <ATag color={data?.runtime.enabled ? 'success' : 'default'}>
              {data?.runtime.enabled ? '已启用' : '未启用'}
            </ATag>
          ),
          key: 'runtime',
          label: 'QQBot Runtime',
        },
        {
          content: data?.runtime.path || '-',
          key: 'reverseWsPath',
          label: '反向 WS 路径',
        },
        {
          content: data?.runtime.sessions?.length || 0,
          key: 'sessions',
          label: '在线会话',
        },
        {
          content: (
            <ATag color={data?.bus.connected ? 'success' : 'default'}>
              {data?.bus.mode || 'local'} /{' '}
              {data?.bus.connected ? '已连接' : '未连接'}
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
