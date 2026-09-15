import type { DefinitionRevision } from '#/api/automation/definition';
import type { FormDefinition } from '#/api/form-definition';
import { defineComponent, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Page } from '@vben/common-ui';
import { Alert, Button, Card, InputNumber, Select, Space } from 'antdv-next';
import { taskApi, type AtomicTaskDefinition } from '#/api/task-execution';
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
      | { fingerprint: string; key: string; deadlineAt: number }
      | undefined;
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
          title="发起原子任务"
          loading={loading.value}
          extra={
            <Button onClick={() => router.push('/automation/tasks')}>
              返回原子任务
            </Button>
          }
        >
          <div class="space-y-4">
            {error.value && <Alert type="error" message={error.value} />}
            <Select
              class="w-full"
              placeholder="选择发布版本"
              value={version.value}
              disabled={submitting.value}
              options={versions.value.map((item) => ({
                label: `${item.name} · v${item.version}`,
                value: item.version,
              }))}
              onChange={selectVersion}
            />
            {form.value && (
              <>
                <FormRenderer
                  ref={renderer}
                  key={`${route.params.taskId}-${version.value}`}
                  definition={form.value}
                />
                <Space>
                  <span>排队与执行总期限</span>
                  <InputNumber
                    min={1}
                    max={86400}
                    value={deadlineSeconds.value}
                    disabled={submitting.value}
                    onChange={(value) => {
                      if (value !== null) deadlineSeconds.value = Number(value);
                    }}
                  />
                  <span>秒</span>
                </Space>
                <div>
                  <Button
                    type="primary"
                    loading={submitting.value}
                    onClick={start}
                  >
                    发起任务
                  </Button>
                </div>
              </>
            )}
            {!loading.value && !versions.value.length && (
              <Alert
                type="info"
                message="该任务尚未发布，请先在执行配置页发布一个版本。"
              />
            )}
          </div>
        </Card>
      </Page>
    );
  },
});
