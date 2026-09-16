import type {
  TriggerOccurrence,
  TriggerRegistration,
} from '#/api/trigger-engine';

import { defineComponent, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Button, Empty, Space, Tabs, Tag, Timeline } from 'antdv-next';

import { triggerApi } from '#/api/trigger-engine';
import { usePageReturn } from '#/hooks/usePageReturn';

import '#/components/kt-automation/automation.scss';

const registrationLabels = {
  prepared: '等待消费方启用',
  active: '已启用',
  closed: '已关闭',
};

export default defineComponent({
  name: 'AutomationTriggerActivity',
  setup() {
    const route = useRoute();
    const returnToPage = usePageReturn('/automation/triggers');
    const registrations = ref<TriggerRegistration[]>([]);
    const occurrences = ref<TriggerOccurrence[]>([]);
    const cursor = ref<null | string>(null);
    const title = ref('触发记录');
    const error = ref('');
    const loading = ref(false);
    const activeTab = ref('occurrences');
    let generation = 0;
    const load = async (append = false) => {
      if (append && !cursor.value) return;
      const current = ++generation;
      const id = String(route.params.triggerId);
      loading.value = true;
      error.value = '';
      try {
        let beforeId: string | undefined;
        if (append && cursor.value) beforeId = cursor.value;
        const page = await triggerApi.occurrences(id, beforeId);
        if (current !== generation) return;
        if (append) occurrences.value.push(...page.list);
        else {
          const [definition, currentRegistrations] = await Promise.all([
            triggerApi.detail(id),
            triggerApi.registrations(id),
          ]);
          if (current !== generation) return;
          title.value = definition.name;
          registrations.value = currentRegistrations;
          occurrences.value = page.list;
        }
        cursor.value = page.nextCursor;
      } catch {
        if (current === generation) error.value = '触发记录加载失败，请重试。';
      } finally {
        if (current === generation) loading.value = false;
      }
    };
    watch(
      () => route.params.triggerId,
      () => {
        registrations.value = [];
        occurrences.value = [];
        cursor.value = null;
        void load();
      },
      { immediate: true },
    );
    onBeforeUnmount(() => {
      generation += 1;
    });
    const registrationList = () => {
      if (registrations.value.length === 0)
        return <Empty class="my-auto" description="暂无注册记录" />;
      return (
        <div class="divide-y">
          {registrations.value.map((item) => (
            <div class="space-y-3 py-4 first:pt-0" key={item.id}>
              <Space wrap>
                <strong>注册 {item.id}</strong>
                <Tag>{registrationLabels[item.status]}</Tag>
              </Space>
              <dl class="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt>固定触发版本</dt>
                  <dd>v{item.triggerRef.version}</dd>
                </div>
                <div>
                  <dt>下一次发生</dt>
                  <dd>{item.nextAt || '—'}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      );
    };
    const occurrenceList = () => {
      if (occurrences.value.length === 0)
        return <Empty class="my-auto" description="暂无触发记录" />;
      return (
        <div>
          <Timeline
            items={occurrences.value.map((item) => ({
              key: item.id,
              content: (
                <div class="space-y-2">
                  <Space wrap>
                    <strong>{item.occurredAt}</strong>
                    <Tag>
                      {item.status === 'pending' && '等待消费'}
                      {item.status === 'acknowledged' && '消费方已保存'}
                    </Tag>
                  </Space>
                  <div class="space-y-2">
                    <span class="text-muted-foreground">
                      注册 {item.registrationId} · 触发版本 v
                      {item.triggerRef.version}
                    </span>
                    {Object.entries(item.payload).map(([key, value]) => (
                      <div class="flex flex-wrap gap-3" key={key}>
                        <strong>{key}</strong>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            }))}
          />
        </div>
      );
    };
    return () => (
      <Page autoContentHeight contentClass="automation-designer-viewport">
        <div class="automation-page automation-page--designer">
          <Space class="shrink-0" wrap>
            <Button onClick={returnToPage}>返回</Button>
            <strong>{title.value}</strong>
            <Button loading={loading.value} onClick={() => load()}>
              刷新记录
            </Button>
          </Space>
          {error.value && <Alert message={error.value} type="error" />}
          <section class="automation-studio__panel automation-records">
            <Tabs
              activeKey={activeTab.value}
              class="automation-record-tabs"
              items={[
                {
                  key: 'occurrences',
                  label: '发生记录',
                  content: () => (
                    <div class="automation-studio__panel-body automation-records__body break-words">
                      {occurrenceList()}
                    </div>
                  ),
                },
                {
                  key: 'registrations',
                  label: '注册状态',
                  content: () => (
                    <div class="automation-studio__panel-body automation-records__body break-words">
                      {registrationList()}
                    </div>
                  ),
                },
              ]}
              onChange={(key) => {
                activeTab.value = key;
              }}
              tabBarExtraContent={
                <Button
                  disabled={
                    activeTab.value !== 'occurrences' ||
                    !cursor.value ||
                    loading.value
                  }
                  loading={loading.value}
                  onClick={() => load(true)}
                >
                  加载更早记录
                </Button>
              }
            />
          </section>
        </div>
      </Page>
    );
  },
});
