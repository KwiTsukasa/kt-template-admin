import type { DefinitionRevision } from '#/api/automation/definition';
import { defineComponent, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import {
  Alert,
  Button,
  Card,
  Empty,
  message,
  Select,
  Space,
  Tag,
  Timeline,
} from 'antdv-next';
import {
  scheduleApi,
  type ScheduleDefinition,
  type ScheduleHistory,
  type ScheduleState,
} from '#/api/task-scheduling/schedule';

const statuses = {
  pending: '等待准入',
  starting: '正在发起',
  running: '执行中',
  succeeded: '已完成',
  failed: '执行失败',
  skipped: '已跳过',
  cancelled: '已取消',
};

export default defineComponent({
  name: 'AutomationScheduleControl',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const { hasAccessByCodes } = useAccess();
    const state = ref<ScheduleState>();
    const versions = ref<DefinitionRevision<ScheduleDefinition>[]>([]);
    const selectedVersion = ref<number>();
    const history = ref<ScheduleHistory[]>([]);
    const cursor = ref<string | null>(null);
    const manual = ref(false);
    const loading = ref(false);
    const busy = ref(false);
    const error = ref('');
    let generation = 0;
    let fireKey: string | undefined;
    const refresh = async (append = false) => {
      if (append && !cursor.value) return;
      const current = ++generation;
      const id = String(route.params.scheduleId);
      loading.value = true;
      error.value = '';
      try {
        let beforeId: string | undefined;
        if (append && cursor.value) beforeId = cursor.value;
        const page = await scheduleApi.history(id, beforeId);
        if (current !== generation) return;
        if (append) history.value.push(...page.list);
        else {
          const [control, published] = await Promise.all([
            scheduleApi.state(id),
            scheduleApi.versions(id),
          ]);
          if (current !== generation) return;
          state.value = control;
          versions.value = published;
          history.value = page.list;
          if (!selectedVersion.value)
            selectedVersion.value =
              control.activeVersion || published[0]?.version;
          manual.value = control.manualTrigger;
        }
        if (current === generation) cursor.value = page.nextCursor;
      } catch {
        if (current === generation)
          error.value = '计划状态或派发历史加载失败，请刷新重试。';
      } finally {
        if (current === generation) loading.value = false;
      }
    };
    watch(
      () => route.params.scheduleId,
      () => {
        state.value = undefined;
        selectedVersion.value = undefined;
        history.value = [];
        cursor.value = null;
        fireKey = undefined;
        void refresh();
      },
      { immediate: true },
    );
    onBeforeUnmount(() => {
      generation += 1;
    });
    const control = async (enabled: boolean) => {
      if (!state.value || busy.value) return;
      busy.value = true;
      try {
        if (enabled && selectedVersion.value)
          await scheduleApi.enable(
            state.value.scheduleId,
            selectedVersion.value,
            state.value.revision,
          );
        else if (!enabled)
          await scheduleApi.disable(
            state.value.scheduleId,
            state.value.revision,
          );
        await refresh();
      } finally {
        busy.value = false;
      }
    };
    const fire = async () => {
      if (!state.value || busy.value) return;
      if (!fireKey) fireKey = `web-plan-${crypto.randomUUID()}`;
      busy.value = true;
      try {
        await scheduleApi.fire(state.value.scheduleId, fireKey);
        fireKey = undefined;
        message.success('已保存触发事件，可刷新查看派发结果');
        await refresh();
      } finally {
        busy.value = false;
      }
    };
    const openRun = async (row: ScheduleHistory) => {
      if (!row.target || !row.targetRunId) return;
      let base = '/automation/tasks';
      if (row.target.type === 'workflow') base = '/automation/workflows';
      await router.push(
        `${base}/${row.target.reference.id}/runs/${row.targetRunId}`,
      );
    };
    return () => (
      <Page>
        <div class="space-y-4">
          <Space>
            <Button onClick={() => router.push('/automation/schedules')}>
              返回调度计划
            </Button>
            <Button loading={loading.value} onClick={() => refresh()}>
              刷新状态
            </Button>
          </Space>
          {error.value && <Alert type="error" message={error.value} />}
          <Card title="计划启停">
            {state.value && (
              <div class="space-y-4">
                <Space>
                  <Tag>
                    {state.value.enabled && '已启用'}
                    {!state.value.enabled && '已停用'}
                  </Tag>
                  <span>
                    当前固定版本：{state.value.activeVersion || '未启用'}
                  </span>
                  <span>控制修订：{state.value.revision}</span>
                </Space>
                {state.value.error && (
                  <Alert type="error" message={state.value.error} />
                )}
                <div class="flex flex-wrap gap-3">
                  <Select
                    style={{ width: '240px' }}
                    value={selectedVersion.value}
                    options={versions.value.map((item) => ({
                      label: `${item.name} · v${item.version}`,
                      value: item.version,
                    }))}
                    onChange={(value) => {
                      selectedVersion.value = Number(value);
                    }}
                  />
                  <Button
                    type="primary"
                    loading={busy.value}
                    disabled={
                      !selectedVersion.value ||
                      !hasAccessByCodes(['Automation:Schedule:Control'])
                    }
                    onClick={() => control(true)}
                  >
                    启用选定版本
                  </Button>
                  <Button
                    danger
                    loading={busy.value}
                    disabled={
                      !state.value.enabled ||
                      !hasAccessByCodes(['Automation:Schedule:Control'])
                    }
                    onClick={() => control(false)}
                  >
                    停用计划
                  </Button>
                  <Button
                    loading={busy.value}
                    disabled={
                      !manual.value ||
                      state.value.activationStatus !== 'active' ||
                      !hasAccessByCodes(['Automation:Schedule:Run'])
                    }
                    onClick={fire}
                  >
                    手动触发一次
                  </Button>
                </div>
                <Alert
                  type="info"
                  message="发布草稿不会改变正在使用的版本。停用后不再接纳新的运行，已通过准入的执行继续保留和追踪。"
                />
              </div>
            )}
          </Card>
          <Card title="派发记录">
            {!history.value.length && <Empty description="尚未发生计划触发" />}
            <Timeline
              items={history.value.map((row) => ({
                key: row.id,
                content: (
                  <div class="space-y-2">
                    <Space>
                      <strong>{row.occurredAt}</strong>
                      <Tag>{statuses[row.status]}</Tag>
                      <span>v{row.scheduleVersion}</span>
                      <Button
                        size="small"
                        disabled={!row.targetRunId}
                        onClick={() => openRun(row)}
                      >
                        查看运行
                      </Button>
                    </Space>
                    {row.error && <Alert type="warning" message={row.error} />}
                    <div class="text-muted-foreground">
                      发生记录 {row.occurrenceId}
                    </div>
                  </div>
                ),
              }))}
            />
            <Button
              disabled={!cursor.value || loading.value}
              onClick={() => refresh(true)}
            >
              加载更早记录
            </Button>
          </Card>
        </div>
      </Page>
    );
  },
});
