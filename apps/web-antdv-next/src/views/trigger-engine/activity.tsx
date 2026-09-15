import type {
  TriggerOccurrence,
  TriggerRegistration,
} from '#/api/trigger-engine';

import { defineComponent, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Empty,
  Space,
  Tabs,
  Tag,
  Timeline,
} from 'antdv-next';

import { triggerApi } from '#/api/trigger-engine';

const registrationLabels = {
  prepared: '等待消费方启用',
  active: '已启用',
  closed: '已关闭',
};

export default defineComponent({
  name: 'AutomationTriggerActivity',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const registrations = ref<TriggerRegistration[]>([]);
    const occurrences = ref<TriggerOccurrence[]>([]);
    const cursor = ref<null | string>(null);
    const title = ref('触发记录');
    const error = ref('');
    const loading = ref(false);
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
        return <Empty description="还没有调度计划使用这个触发器" />;
      return (
        <div class="grid gap-3 md:grid-cols-2">
          {registrations.value.map((item) => (
            <Card
              extra={<Tag>{registrationLabels[item.status]}</Tag>}
              key={item.id}
              size="small"
              title={`注册 ${item.id}`}
            >
              <dl class="space-y-2">
                <div>
                  <dt>固定触发版本</dt>
                  <dd>v{item.triggerRef.version}</dd>
                </div>
                <div>
                  <dt>下一次发生</dt>
                  <dd>{item.nextAt || '没有待发生的时间点'}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      );
    };
    const occurrenceList = () => {
      if (occurrences.value.length === 0)
        return <Empty description="尚未产生触发事件" />;
      return (
        <div>
          <Timeline
            items={occurrences.value.map((item) => ({
              key: item.id,
              content: (
                <Card
                  extra={
                    <Tag>
                      {item.status === 'pending' && '等待消费'}
                      {item.status === 'acknowledged' && '消费方已保存'}
                    </Tag>
                  }
                  size="small"
                  title={item.occurredAt}
                >
                  <div class="space-y-2">
                    <span class="text-muted-foreground">
                      注册 {item.registrationId} · 触发版本 v
                      {item.triggerRef.version}
                    </span>
                    {Object.entries(item.payload).map(([key, value]) => (
                      <div class="flex gap-3" key={key}>
                        <strong>{key}</strong>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ),
            }))}
          />
          <Button
            disabled={!cursor.value || loading.value}
            loading={loading.value}
            onClick={() => load(true)}
          >
            加载更早的发生记录
          </Button>
        </div>
      );
    };
    return () => (
      <Page>
        <div class="space-y-4">
          <Space>
            <Button onClick={() => router.push('/automation/triggers')}>
              返回触发器
            </Button>
            <strong>{title.value}</strong>
            <Button loading={loading.value} onClick={() => load()}>
              刷新记录
            </Button>
          </Space>
          {error.value && <Alert message={error.value} type="error" />}
          <Card>
            <Tabs
              items={[
                {
                  key: 'occurrences',
                  label: '发生记录',
                  content: occurrenceList,
                },
                {
                  key: 'registrations',
                  label: '注册状态',
                  content: registrationList,
                },
              ]}
            />
          </Card>
        </div>
      </Page>
    );
  },
});
