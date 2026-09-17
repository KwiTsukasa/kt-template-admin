import type { DefinitionRevision } from '#/api/automation/definition';
import type {
  ScheduleDefinition,
  ScheduleHistory,
  ScheduleState,
} from '#/api/task-scheduling/schedule';

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

import { scheduleApi } from '#/api/task-scheduling/schedule';
import {
  AUTOMATION_PATH,
  AUTOMATION_PERMISSION,
} from '#/constants/automation/resources';
import { SCHEDULE_STATUS_LABELS as statuses } from '#/constants/automation/run-status';
import { usePageReturn } from '#/hooks/usePageReturn';

export default defineComponent({
  name: 'AutomationScheduleControl',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const returnToPage = usePageReturn(AUTOMATION_PATH.schedules);
    const { hasAccessByCodes } = useAccess();
    const state = ref<ScheduleState>();
    const versions = ref<DefinitionRevision<ScheduleDefinition>[]>([]);
    const selectedVersion = ref<number>();
    const history = ref<ScheduleHistory[]>([]);
    const cursor = ref<null | string>(null);
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
      let base: string = AUTOMATION_PATH.tasks;
      if (row.target.type === 'workflow') base = AUTOMATION_PATH.workflows;
      await router.push(
        `${base}/${row.target.reference.id}/runs/${row.targetRunId}`,
      );
    };
    return () => (
      <Page autoContentHeight contentClass="automation-designer-viewport">
        <div class="automation-page automation-page--designer">
          <Space class="shrink-0" wrap>
            <Button onClick={returnToPage}>返回定时任务</Button>
            <Button loading={loading.value} onClick={() => refresh()}>
              刷新状态
            </Button>
          </Space>
          {error.value && <Alert message={error.value} type="error" />}
          <Card class="shrink-0" title="运行状态">
            {state.value && (
              <div class="space-y-4">
                <Space wrap>
                  <Tag>
                    {state.value.enabled && '已启用'}
                    {!state.value.enabled && '已停用'}
                  </Tag>
                  <span>
                    当前固定版本：{state.value.activeVersion || '未启用'}
                  </span>
                </Space>
                {state.value.nextRunAt && (
                  <p>
                    下次运行：{new Date(state.value.nextRunAt).toLocaleString()}
                  </p>
                )}
                {state.value.error && (
                  <Alert message={state.value.error} type="error" />
                )}
                <div class="flex flex-wrap gap-3">
                  <Select
                    onChange={(value) => {
                      selectedVersion.value = Number(value);
                    }}
                    options={versions.value.map((item) => ({
                      label: `${item.name} · v${item.version}`,
                      value: item.version,
                    }))}
                    style={{ width: '240px', maxWidth: '100%' }}
                    value={selectedVersion.value}
                  />
                  <Button
                    disabled={
                      !selectedVersion.value ||
                      !hasAccessByCodes([AUTOMATION_PERMISSION.scheduleControl])
                    }
                    loading={busy.value}
                    onClick={() => control(true)}
                    type="primary"
                  >
                    启用选定版本
                  </Button>
                  <Button
                    danger
                    disabled={
                      !state.value.enabled ||
                      !hasAccessByCodes([AUTOMATION_PERMISSION.scheduleControl])
                    }
                    loading={busy.value}
                    onClick={() => control(false)}
                  >
                    停用计划
                  </Button>
                  <Button
                    disabled={
                      !manual.value ||
                      state.value.activationStatus !== 'active' ||
                      !hasAccessByCodes([AUTOMATION_PERMISSION.scheduleRun])
                    }
                    loading={busy.value}
                    onClick={fire}
                  >
                    手动触发一次
                  </Button>
                </div>
              </div>
            )}
          </Card>
          <section class="automation-studio__panel automation-records">
            <div class="automation-studio__panel-heading">
              <h2>派发记录</h2>
              <Button
                disabled={!cursor.value || loading.value}
                onClick={() => refresh(true)}
              >
                加载更早记录
              </Button>
            </div>
            <div class="automation-studio__panel-body automation-records__body">
              {history.value.length === 0 && (
                <Empty class="my-auto" description="暂无触发记录" />
              )}
              {history.value.length > 0 && (
                <Timeline
                  items={history.value.map((row) => ({
                    key: row.id,
                    content: (
                      <div class="space-y-2">
                        <Space wrap>
                          <strong>{row.occurredAt}</strong>
                          <Tag>{statuses[row.status]}</Tag>
                          <span>v{row.scheduleVersion}</span>
                          <Button
                            disabled={!row.targetRunId}
                            onClick={() => openRun(row)}
                            size="small"
                          >
                            查看运行
                          </Button>
                        </Space>
                        {row.error && (
                          <Alert message={row.error} type="warning" />
                        )}
                        <div class="text-muted-foreground">
                          发生记录 {row.occurrenceId}
                        </div>
                      </div>
                    ),
                  }))}
                />
              )}
            </div>
          </section>
        </div>
      </Page>
    );
  },
});
