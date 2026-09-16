import type { PropType } from 'vue';

import type {
  DefinitionClient,
  DefinitionRevision,
} from '#/api/automation/definition';

import { defineComponent, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { KtTable, useKtTable } from '#/components/kt-table';
import { usePageReturn } from '#/hooks/usePageReturn';

const Table = KtTable as any;

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
    const returnToPage = usePageReturn(props.basePath);
    const [register, tableApi] = useKtTable<DefinitionRevision<unknown>>({
      tableTitle: `${props.title}发布版本`,
      rowKey: 'version',
      showPagination: false,
      showDefaultButtons: false,
      tableSettings: { showSearch: false },
      api: {
        list: async () => props.api.versions(String(route.params[props.idKey])),
      },
      columns: [
        { title: '版本', dataIndex: 'version', width: 100 },
        { title: '名称', dataIndex: 'name', width: 260 },
        { title: '说明', dataIndex: 'description', width: 360, ellipsis: true },
        { title: '发布时间', dataIndex: 'publishedAt', width: 180 },
      ],
      buttons: [
        {
          key: 'back',
          label: '返回列表',
          icon: <IconifyIcon icon="lucide:arrow-left" />,
          onClick: returnToPage,
        },
      ],
    });
    watch(
      () => route.params[props.idKey],
      (id) => {
        if (typeof id === 'string' && route.path.endsWith('/versions'))
          void tableApi.reload();
      },
    );
    return () => (
      <Page autoContentHeight>
        <Table onRegister={register} />
      </Page>
    );
  },
});
