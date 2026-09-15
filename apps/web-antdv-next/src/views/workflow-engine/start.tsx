import type { DefinitionRevision } from '#/api/automation/definition';
import type { FormDefinition } from '#/api/form-definition';
import type { WorkflowDefinition } from '#/api/workflow-engine';

import { defineComponent, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Button, Card, Select, Space } from 'antdv-next';

import { workflowApi } from '#/api/workflow-engine';
import FormRenderer from '#/components/kt-dynamic-form/FormRenderer';
import { formFromDataSchema } from '#/components/kt-dynamic-form/schema-adapter';

export default defineComponent({
  name: 'AutomationWorkflowStart',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const versions = ref<DefinitionRevision<WorkflowDefinition>[]>([]);
    const version = ref<number>();
    const form = ref<FormDefinition>();
    const renderer = ref<{
      validate: () => Promise<Record<string, unknown> | undefined>;
    }>();
    const loading = ref(false);
    const submitting = ref(false);
    const error = ref('');
    const bindingLabel = ref('');
    let generation = 0;
    let submission: undefined | { fingerprint: string; key: string };
    const loadVersion = async (value: unknown) => {
      const selected = versions.value.find(
        (candidate) => candidate.version === Number(value),
      );
      if (!selected) return;
      const current = ++generation;
      loading.value = true;
      error.value = '';
      form.value = undefined;
      version.value = selected.version;
      submission = undefined;
      try {
        const presentation = await workflowApi.launch(
          String(route.params.workflowId),
          selected.version,
        );
        const graph = presentation.definition.graph;
        let resolved = formFromDataSchema(graph.inputSchema);
        let label = '按流程输入契约填写';
        if (graph.formRef && presentation.form) {
          resolved = presentation.form;
          label = `绑定表单版本 ${graph.formRef.version}`;
        }
        if (current !== generation) return;
        form.value = resolved;
        bindingLabel.value = label;
      } catch {
        if (current === generation)
          error.value = '无法加载该流程绑定的表单版本。';
      } finally {
        if (current === generation) loading.value = false;
      }
    };
    watch(
      () => route.params.workflowId,
      async (id) => {
        const current = ++generation;
        versions.value = [];
        form.value = undefined;
        error.value = '';
        loading.value = true;
        try {
          const published = await workflowApi.versions(String(id));
          if (current !== generation) return;
          versions.value = published;
          if (published[0]) await loadVersion(published[0].version);
          else loading.value = false;
        } catch {
          if (current === generation) {
            error.value = '无法读取流程发布版本，请检查权限或资源是否存在。';
            loading.value = false;
          }
        }
      },
      { immediate: true },
    );
    const start = async () => {
      if (!form.value || !version.value || submitting.value) return;
      const values = await renderer.value?.validate();
      if (!values) return;
      const workflowId = String(route.params.workflowId);
      const fingerprint = JSON.stringify([workflowId, version.value, values]);
      if (!submission || submission.fingerprint !== fingerprint)
        submission = { fingerprint, key: `web-${crypto.randomUUID()}` };
      submitting.value = true;
      error.value = '';
      try {
        const run = await workflowApi.start(
          { id: workflowId, version: version.value },
          values,
          submission.key,
        );
        await router.push(
          `/automation/workflows/${workflowId}/runs/${run.runId}`,
        );
      } catch {
        error.value =
          '流程未能发起，请检查填写数据及依赖状态；重试相同内容会沿用请求身份。';
      } finally {
        submitting.value = false;
      }
    };
    onBeforeUnmount(() => {
      generation += 1;
    });
    return () => (
      <Page>
        <Card
          extra={
            <Space>
              <Select
                disabled={submitting.value}
                onChange={loadVersion}
                options={versions.value.map((item) => ({
                  value: item.version,
                  label: `${item.name} · 版本 ${item.version}`,
                }))}
                style={{ width: '180px' }}
                value={version.value}
              />
              <Button onClick={() => router.push('/automation/workflows')}>
                返回工作流管理
              </Button>
            </Space>
          }
          loading={loading.value}
          title="发起工作流"
        >
          {error.value && (
            <Alert class="mb-4" message={error.value} type="error" />
          )}
          {form.value && (
            <div class="space-y-4">
              <Alert
                description="填写数据保存在本次流程实例中，按选定版本执行。"
                message={bindingLabel.value}
                type="info"
              />
              <FormRenderer
                definition={form.value}
                key={`${route.params.workflowId}-${version.value}`}
                ref={renderer}
              />
              <Button loading={submitting.value} onClick={start} type="primary">
                发起流程
              </Button>
            </div>
          )}
          {!form.value && !loading.value && !error.value && (
            <Alert
              message="此工作流尚未发布，请先在编排页发布一个版本。"
              type="info"
            />
          )}
        </Card>
      </Page>
    );
  },
});
