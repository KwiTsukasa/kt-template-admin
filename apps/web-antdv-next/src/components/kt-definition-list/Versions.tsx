import type { PropType } from 'vue';

import type {
  DefinitionClient,
  DefinitionRevision,
} from '#/api/automation/definition';

import { defineComponent, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Button, Card, Table } from 'antdv-next';

export default defineComponent({
  name: 'KtDefinitionVersions',
  props: {
    api: { type: Object as PropType<DefinitionClient<any>>, required: true },
    idKey: { type: String, required: true },
    basePath: { type: String, required: true },
    title: { type: String, required: true },
  },
  setup(props) {
    const route = useRoute();
    const router = useRouter();
    const versions = ref<DefinitionRevision<unknown>[]>([]);
    const error = ref('');
    const loading = ref(false);
    watch(
      () => route.params[props.idKey],
      async (id) => {
        loading.value = true;
        error.value = '';
        try {
          versions.value = await props.api.versions(String(id));
        } catch (error_) {
          error.value = String(error_);
        } finally {
          loading.value = false;
        }
      },
      { immediate: true },
    );
    return () => (
      <Page>
        <Card
          extra={
            <Button onClick={() => router.push(props.basePath)}>
              返回管理列表
            </Button>
          }
          title={`${props.title}发布版本`}
        >
          {error.value && <Alert message={error.value} type="error" />}
          <Table
            columns={[
              { title: '版本', dataIndex: 'version' },
              { title: '名称', dataIndex: 'name' },
              { title: '说明', dataIndex: 'description' },
              { title: '发布时间', dataIndex: 'publishedAt' },
            ]}
            dataSource={versions.value}
            loading={loading.value}
            pagination={false}
            rowKey="version"
          />
        </Card>
      </Page>
    );
  },
});
