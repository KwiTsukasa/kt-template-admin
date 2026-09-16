import type { FormDefinition } from '#/api/form-definition';

import { defineComponent, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Button, Card, Select, Space } from 'antdv-next';

import { formApi } from '#/api/form-definition';
import FormRenderer from '#/components/kt-dynamic-form/FormRenderer';
import { usePageReturn } from '#/hooks/usePageReturn';

export default defineComponent({
  name: 'AutomationFormPreview',
  setup() {
    const route = useRoute();
    const returnToPage = usePageReturn('/automation/forms');
    const definition = ref<FormDefinition>();
    const version = ref<number>();
    const published = ref<Awaited<ReturnType<typeof formApi.versions>>>([]);
    const renderer = ref<{
      validate: () => Promise<Record<string, unknown> | undefined>;
    }>();
    const result = ref('');
    const loadVersion = (value: unknown) => {
      const selected = published.value.find(
        (item) => item.version === Number(value),
      );
      if (!selected) return;
      version.value = selected.version;
      definition.value = selected.definition;
      result.value = '';
    };
    watch(
      () => route.params.formId,
      async (id) => {
        published.value = await formApi.versions(String(id));
        if (published.value[0]) loadVersion(published.value[0].version);
      },
      { immediate: true },
    );
    const validate = async () => {
      const values = await renderer.value?.validate();
      if (!values || !definition.value) return;
      await formApi.preview(definition.value, values);
      result.value = '前端和服务端校验均通过，预览数据未写入实例。';
    };
    return () => (
      <Page>
        <Card
          extra={
            <Space>
              <Select
                onChange={loadVersion}
                options={published.value.map((item) => ({
                  label: `版本 ${item.version}`,
                  value: item.version,
                }))}
                style={{ width: '140px' }}
                value={version.value}
              />
              <Button onClick={returnToPage}>返回表单管理</Button>
            </Space>
          }
          title="表单预览"
        >
          {definition.value && (
            <FormRenderer definition={definition.value} ref={renderer} />
          )}
          <Button onClick={validate} type="primary">
            校验填写数据
          </Button>
          {result.value && (
            <Alert class="mt-4" message={result.value} type="success" />
          )}
          {!definition.value && (
            <Alert
              message="表单尚未发布，请先在设计页发布一个版本。"
              type="info"
            />
          )}
        </Card>
      </Page>
    );
  },
});
