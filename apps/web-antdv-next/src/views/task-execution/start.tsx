import type { DefinitionRevision } from '#/api/automation/definition';
import type { FormDefinition } from '#/api/form-definition';
import type { AtomicTaskDefinition } from '#/api/task-execution';

import { defineComponent, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Button, Card, InputNumber, Select, Space } from 'antdv-next';

import { taskApi } from '#/api/task-execution';
import FormRenderer from '#/components/kt-dynamic-form/FormRenderer';
import { formFromDataSchema } from '#/components/kt-dynamic-form/schema-adapter';

export default defineComponent({
  name: 'AutomationTaskStart',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const versions = ref<DefinitionRevision<AtomicTaskDefinition>[]>([]);
    const version = ref<number>();
    const form = ref<FormDefinition>();
    const renderer = ref<{
      validate: () => Promise<Record<string, unknown> | undefined>;
    }>();
    const loading = ref(false);
    const submitting = ref(false);
    const error = ref('');
    const deadlineSeconds = ref(300);
    let generation = 0;
    let submission:
      | undefined
      | { deadlineAt: number; fingerprint: string; key: string };
    const selectVersion = (value: unknown) => {
      const selected = versions.value.find(
        (item) => item.version === Number(value),
      );
      if (!selected) return;
      version.value = selected.version;
      form.value = formFromDataSchema(selected.definition.contract.inputSchema);
      submission = undefined;
    };
    watch(
      () => route.params.taskId,
      async (id) => {
        const current = ++generation;
        form.value = undefined;
        versions.value = [];
        version.value = undefined;
        loading.value = true;
        error.value = '';
        try {
          const rows = await taskApi.versions(String(id));
          if (current !== generation) return;
          versions.value = rows;
          if (rows[0]) selectVersion(rows[0].version);
        } catch {
          if (current === generation) error.value = '任务版本加载失败';
        } finally {
          if (current === generation) loading.value = false;
        }
      },
      { immediate: true },
    );
    onBeforeUnmount(() => {
      generation += 1;
    });
    const start = async () => {
      if (!version.value || submitting.value) return;
      const input = await renderer.value?.validate();
      if (!input) return;
      const id = String(route.params.taskId);
      const fingerprint = JSON.stringify([
        id,
        version.value,
        input,
        deadlineSeconds.value,
      ]);
      if (!submission || submission.fingerprint !== fingerprint)
        submission = {
          fingerprint,
          key: `web-task-${crypto.randomUUID()}`,
          deadlineAt: Date.now() + deadlineSeconds.value * 1000,
        };
      submitting.value = true;
      error.value = '';
      try {
        const run = await taskApi.start({
          taskRef: { id, version: version.value },
          input,
          executionKey: submission.key,
          deadlineAt: submission.deadlineAt,
        });
        await router.push(`/automation/tasks/${id}/runs/${run.runId}`);
      } catch {
        error.value =
          '任务未能发起，请检查参数和执行能力；重试相同内容会沿用原请求身份。';
      } finally {
        submitting.value = false;
      }
    };
    return () => (
      <Page>
        <Card
          extra={
            <Button onClick={() => router.push('/automation/tasks')}>
              返回原子任务
            </Button>
          }
          loading={loading.value}
          title="发起原子任务"
        >
          <div class="space-y-4">
            {error.value && <Alert message={error.value} type="error" />}
            <Select
              class="w-full"
              disabled={submitting.value}
              onChange={selectVersion}
              options={versions.value.map((item) => ({
                label: `${item.name} · v${item.version}`,
                value: item.version,
              }))}
              placeholder="选择发布版本"
              value={version.value}
            />
            {form.value && (
              <>
                <FormRenderer
                  definition={form.value}
                  key={`${route.params.taskId}-${version.value}`}
                  ref={renderer}
                />
                <Space>
                  <span>排队与执行总期限</span>
                  <InputNumber
                    disabled={submitting.value}
                    max={86_400}
                    min={1}
                    onChange={(value) => {
                      if (value !== null) deadlineSeconds.value = Number(value);
                    }}
                    value={deadlineSeconds.value}
                  />
                  <span>秒</span>
                </Space>
                <div>
                  <Button
                    loading={submitting.value}
                    onClick={start}
                    type="primary"
                  >
                    发起任务
                  </Button>
                </div>
              </>
            )}
            {!loading.value && versions.value.length === 0 && (
              <Alert
                message="该任务尚未发布，请先在执行配置页发布一个版本。"
                type="info"
              />
            )}
          </div>
        </Card>
      </Page>
    );
  },
});
