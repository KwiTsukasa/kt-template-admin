import type { PropType } from 'vue';
import type {
  DefinitionClient,
  DefinitionDocument,
} from '#/api/automation/definition';
import type { KtTableApi, KtTableRowAction } from '#/components/kt-table';
import { defineComponent, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Page, useVbenModal } from '@vben/common-ui';
import { message } from 'antdv-next';
import { useVbenForm, z, type VbenFormSchema } from '#/adapter/form';
import { KtTable, useKtTable } from '#/components/kt-table';

type Row = DefinitionDocument<unknown>;
const Table = KtTable as any;

export default defineComponent({
  name: 'KtDefinitionList',
  props: {
    title: { type: String, required: true },
    basePath: { type: String, required: true },
    permission: { type: String, required: true },
    api: { type: Object as PropType<DefinitionClient<any>>, required: true },
    createDefinition: {
      type: Function as PropType<
        (values: Record<string, unknown>) => unknown | Promise<unknown>
      >,
      required: true,
    },
    designerLabel: { type: String, default: '设计' },
    creationFields: {
      type: Array as PropType<VbenFormSchema[]>,
      default: () => [],
    },
    extraActions: {
      type: Array as PropType<KtTableRowAction<Row>[]>,
      default: () => [],
    },
  },
  setup(props) {
    const router = useRouter();
    const route = useRoute();
    const submitting = ref(false);
    const basicFields: VbenFormSchema[] = [
      {
        fieldName: 'name',
        label: '名称',
        component: 'Input',
        rules: z.string().trim().min(1).max(128),
      },
      {
        fieldName: 'description',
        label: '说明',
        component: 'Textarea',
        componentProps: { maxLength: 2048 },
        defaultValue: '',
      },
    ];
    const [BasicForm, formApi] = useVbenForm({
      showDefaultActions: false,
      schema: basicFields,
    });
    const [CreateModal, modalApi] = useVbenModal({
      title: `新建${props.title}`,
      onConfirm: async () => {
        const values = await formApi.validateAndSubmitForm();
        if (!values) return;
        submitting.value = true;
        try {
          const created = await props.api.create({
            name: String(values.name),
            description: String(values.description || ''),
            definition: await props.createDefinition(values),
          });
          modalApi.close();
          await router.push({
            path: `${props.basePath}/${created.id}/designer`,
            query: { returnTo: route.fullPath },
          });
        } finally {
          submitting.value = false;
        }
      },
    });
    let firstPage = true;
    const api: KtTableApi<Row> = {
      list: async (params) => {
        let query = params;
        if (firstPage) {
          query = { ...params, ...route.query };
          firstPage = false;
        }
        await router.replace({
          query: {
            name: String(query.name || ''),
            pageNo: String(query.pageNo || 1),
            pageSize: String(query.pageSize || 20),
          },
        });
        return props.api.page(query);
      },
    };
    const actions: KtTableRowAction<Row>[] = [
      ...props.extraActions,
      {
        key: 'designer',
        label: props.designerLabel,
        permissionCodes: [`${props.permission}:Edit`],
        onClick: async (row) => {
          await router.push({
            path: `${props.basePath}/${row.id}/designer`,
            query: { returnTo: route.fullPath },
          });
        },
      },
      {
        key: 'versions',
        label: '版本',
        permissionCodes: [`${props.permission}:List`],
        onClick: async (row) => {
          await router.push({
            path: `${props.basePath}/${row.id}/versions`,
            query: { returnTo: route.fullPath },
          });
        },
      },
      {
        key: 'publish',
        label: '发布',
        permissionCodes: [`${props.permission}:Publish`],
        onClick: async (row, context) => {
          await props.api.publish(row.id, row.revision);
          message.success('已发布新版本');
          await context.reload();
        },
      },
    ];
    const [register] = useKtTable<Row>({
      tableTitle: props.title,
      api,
      columns: [
        { title: '名称', dataIndex: 'name', width: 220 },
        { title: '说明', dataIndex: 'description', width: 320 },
        { title: '草稿版本', dataIndex: 'revision', width: 120 },
        { title: '发布版本', dataIndex: 'publishedVersion', width: 120 },
        { title: '更新时间', dataIndex: 'updateTime', width: 180 },
      ],
      formOptions: {
        schema: [
          {
            fieldName: 'name',
            label: '名称',
            component: 'Input',
            componentProps: { allowClear: true },
          },
        ],
      },
      rowActions: actions,
      buttons: [
        {
          key: 'create',
          label: `新建${props.title}`,
          type: 'primary',
          permissionCodes: [`${props.permission}:Edit`],
          onClick: async () => {
            formApi.setState({
              schema: [...basicFields, ...props.creationFields],
            });
            await formApi.resetForm();
            modalApi.open();
          },
        },
      ],
    });
    return () => (
      <Page autoContentHeight>
        <Table onRegister={register} />
        <CreateModal confirmLoading={submitting.value}>
          <BasicForm />
        </CreateModal>
      </Page>
    );
  },
});
