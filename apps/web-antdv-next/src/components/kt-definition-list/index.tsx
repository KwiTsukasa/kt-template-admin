import type { TableColumnType } from 'antdv-next';

import type { Component, PropType } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';
import type {
  DefinitionClient,
  DefinitionDocument,
} from '#/api/automation/definition';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/kt-table';

import { defineComponent, h, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Drawer, message, Tag } from 'antdv-next';

import { useVbenForm, z } from '#/adapter/form';
import { KtTable, useKtTable } from '#/components/kt-table';

import '#/components/kt-automation/automation.scss';

type Row = DefinitionDocument<unknown>;
const Table = KtTable as any;

export default defineComponent({
  name: 'KtDefinitionList',
  props: {
    title: { type: String, required: true },
    pageTitle: { type: String, default: '' },
    description: {
      type: String,
      default: '维护可复用设计，在发布版本后供自动化使用。',
    },
    icon: { type: String, default: 'lucide:workflow' },
    columns: {
      type: Array as PropType<TableColumnType<Row>[]>,
      default: () => [],
    },
    basePath: { type: String, required: true },
    permission: { type: String, required: true },
    api: { type: Object as PropType<DefinitionClient<any>>, required: true },
    createDefinition: {
      type: Function as PropType<
        (values: Record<string, unknown>) => Promise<unknown> | unknown
      >,
      required: true,
    },
    designerLabel: { type: String, default: '设计' },
    drawerEditor: { type: Object as PropType<Component>, default: undefined },
    creationFields: {
      type: Array as PropType<VbenFormSchema[]>,
      default: () => [],
    },
    extraActions: {
      type: Array as PropType<KtTableRowAction<Row>[]>,
      default: () => [],
    },
    toolbarButtons: {
      type: Array as PropType<KtTableButton<Row>[]>,
      default: () => [],
    },
  },
  setup(props) {
    const router = useRouter();
    const route = useRoute();
    const submitting = ref(false);
    const editingId = ref('');
    const drawerRef = ref<{ confirmLeave: () => Promise<boolean> }>();
    const openEditor = async (id: string) => {
      if (props.drawerEditor) {
        editingId.value = id;
        return;
      }
      await router.push({
        path: `${props.basePath}/${id}/designer`,
        query: { returnTo: route.fullPath },
      });
    };
    const closeEditor = async () => {
      editingId.value = '';
      await tableApi.reload();
    };
    const requestClose = async () => {
      if (drawerRef.value && !(await drawerRef.value.confirmLeave())) return;
      await closeEditor();
    };
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
          await openEditor(created.id);
        } finally {
          submitting.value = false;
        }
      },
    });
    const api: KtTableApi<Row> = {
      list: (params) => props.api.page(params),
    };
    const actions: KtTableRowAction<Row>[] = [
      {
        key: 'designer',
        label: props.designerLabel,
        permissionCodes: [`${props.permission}:Edit`],
        onClick: async (row) => {
          await openEditor(row.id);
        },
      },
      ...props.extraActions,
      {
        key: 'versions',
        icon: <IconifyIcon icon="lucide:history" />,
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
        icon: <IconifyIcon icon="lucide:upload" />,
        label: '发布',
        permissionCodes: [`${props.permission}:Publish`],
        onClick: async (row, context) => {
          await props.api.publish(row.id, row.revision);
          message.success('已发布新版本');
          await context.reload();
        },
      },
    ];
    const [register, tableApi] = useKtTable<Row>({
      tableTitle: props.pageTitle || `${props.title}列表`,
      api,
      columns: [
        {
          title: `${props.title}名称`,
          dataIndex: 'name',
          width: 310,
          render: (_value, record) => (
            <div class="automation-definition-name">
              <strong>{record.name}</strong>
            </div>
          ),
        },
        ...props.columns,
        {
          title: '版本状态',
          dataIndex: 'publishedVersion',
          width: 170,
          render: (_value, record) => (
            <div class="automation-definition-meta">
              {record.publishedVersion && (
                <span>
                  <Tag color="blue">{`已发布 v${record.publishedVersion}`}</Tag>
                </span>
              )}
              {!record.publishedVersion && (
                <span>
                  <Tag>尚未发布</Tag>
                </span>
              )}
              <small>草稿修订 {record.revision}</small>
            </div>
          ),
        },
        { title: '更新时间', dataIndex: 'updateTime', width: 180 },
      ],
      formOptions: {
        schema: [
          {
            fieldName: 'name',
            label: '名称',
            component: 'Input',
            componentProps: {
              allowClear: true,
              placeholder: `搜索${props.title}名称`,
            },
          },
        ],
      },
      rowActions: actions,
      buttons: [
        {
          key: 'create',
          label: `新建${props.title}`,
          type: 'primary',
          icon: (
            <IconifyIcon class="kt-table__button-icon" icon="lucide:plus" />
          ),
          permissionCodes: [`${props.permission}:Edit`],
          onClick: async () => {
            formApi.setState({
              schema: [...basicFields, ...props.creationFields],
            });
            modalApi.open();
            await formApi.resetForm();
          },
        },
        ...props.toolbarButtons,
      ],
    });
    return () => (
      <Page autoContentHeight>
        <div class="automation-page">
          <div class="automation-page__content">
            <Table onRegister={register} />
          </div>
        </div>
        <CreateModal confirmLoading={submitting.value}>
          <BasicForm />
        </CreateModal>
        <Drawer
          destroyOnHidden
          onClose={requestClose}
          open={Boolean(editingId.value)}
          title={`${props.title} · 配置`}
          width="min(1100px, 94vw)"
        >
          {editingId.value &&
            props.drawerEditor &&
            h(props.drawerEditor, {
              ref: drawerRef,
              key: editingId.value,
              definitionId: editingId.value,
              onClose: closeEditor,
            })}
        </Drawer>
      </Page>
    );
  },
});
