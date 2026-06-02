import type { TableColumnType } from 'antdv-next';

import type { PropType } from 'vue';

import type { WordpressBlogApi } from '#/api/blog';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/ktTable';

import { computed, defineComponent, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createCategory,
  createTag,
  deleteCategory,
  deleteTag,
  getCategoryList,
  getTagList,
  updateCategory,
  updateTag,
} from '#/api/blog';
import { KtTable, useKtTable } from '#/components/ktTable';

import { setBlogArticleFilters } from './use-article-filters';

type TermSearchValues = {
  search?: string;
};

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'BlogTermManagement',
  props: {
    kind: {
      required: true,
      type: String as PropType<'category' | 'tag'>,
    },
    title: {
      required: true,
      type: String,
    },
  },
  setup(props) {
    const route = useRoute();
    const router = useRouter();

    const editingId = ref<number>();
    const tableRows = ref<WordpressBlogApi.Term[]>([]);
    const parentOptions = computed(() =>
      tableRows.value
        .filter((item) => item.id !== editingId.value)
        .map((item) => ({ label: item.name, value: item.id })),
    );

    const [TermForm, termFormApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      layout: 'horizontal',
      schema: [
        {
          component: 'Input',
          componentProps: () => ({
            placeholder: `请输入${props.title}名称`,
          }),
          fieldName: 'name',
          label: '名称',
          rules: 'required',
        },
        {
          component: 'Input',
          componentProps: {
            placeholder: '可选，WordPress slug',
          },
          fieldName: 'slug',
          label: '别名',
        },
        {
          component: 'Select',
          componentProps: () => ({
            allowClear: true,
            options: parentOptions.value,
            placeholder: '选择父级分类',
          }),
          dependencies: {
            if: () => props.kind === 'category',
            triggerFields: ['name'],
          },
          fieldName: 'parent',
          label: '父级分类',
        },
        {
          component: 'Textarea',
          componentProps: {
            autoSize: { maxRows: 6, minRows: 3 },
            placeholder: '可选',
          },
          fieldName: 'description',
          label: '描述',
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });

    const modalTitle = computed(() =>
      editingId.value ? `编辑${props.title}` : `新建${props.title}`,
    );
    const [TermModal, termModalApi] = useVbenModal({
      class: 'w-[620px]',
      fullscreenButton: false,
      async onConfirm() {
        await submitTerm();
      },
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = termModalApi.getData<{
          values?: WordpressBlogApi.TermBody;
        }>();
        void resetTermForm(values || getTermFormDefaults());
      },
    });
    const permissionModule = computed(() =>
      props.kind === 'category' ? 'Blog:Category' : 'Blog:Tag',
    );
    const columns = computed<Array<TableColumnType<WordpressBlogApi.Term>>>(
      () => [
        { dataIndex: 'name', key: 'name', title: '名称', width: 220 },
        { dataIndex: 'slug', key: 'slug', title: '别名', width: 180 },
        { dataIndex: 'count', key: 'count', title: '文章数', width: 100 },
        {
          dataIndex: 'description',
          key: 'description',
          title: '描述',
          width: 300,
        },
      ],
    );
    const api: KtTableApi<WordpressBlogApi.Term, TermSearchValues> = {
      list: async (params) => {
        const requestParams = {
          hide_empty: false,
          pageNo: params.pageNo,
          pageSize: params.pageSize,
          search: params.search,
        };

        return props.kind === 'category'
          ? await getCategoryList(requestParams)
          : await getTagList(requestParams);
      },
    };
    const buttons = computed<
      Array<KtTableButton<WordpressBlogApi.Term, TermSearchValues>>
    >(() => [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: `新建${props.title}`,
        onClick: openCreate,
        permissionCodes: [`${permissionModule.value}:Create`],
        type: 'primary',
      },
    ]);
    const rowActions = computed<
      Array<KtTableRowAction<WordpressBlogApi.Term, TermSearchValues>>
    >(() => [
      {
        key: 'articles',
        label: '查看文章',
        onClick: openRelatedArticles,
        permissionCodes: ['Blog:Article:List'],
      },
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        permissionCodes: [`${permissionModule.value}:Edit`],
      },
      {
        confirm: (row) =>
          `确认删除${props.title}「${row.name}」吗？WordPress 分类和标签不支持回收站，本操作会强制删除该条目，但不会删除已关联文章。`,
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: async (row, context) => {
          await (props.kind === 'category'
            ? deleteCategory(row.id)
            : deleteTag(row.id));
          message.success(`${props.title}删除成功`);
          await context.reload();
        },
        permissionCodes: [`${permissionModule.value}:Delete`],
      },
    ]);

    const [registerTable, tableApi] = useKtTable<
      WordpressBlogApi.Term,
      TermSearchValues
    >({
      afterFetch: (result) => {
        tableRows.value = Array.isArray(result)
          ? result
          : result.list || result.records || result.items || [];
        return result;
      },
      api,
      buttons: buttons.value,
      columns: columns.value,
      formOptions: {
        schema: [
          {
            component: 'Input',
            componentProps: {
              allowClear: true,
              placeholder: `搜索${props.title}名称`,
            },
            fieldName: 'search',
            label: '关键词',
          },
        ],
      },
      immediate: false,
      rowActions: rowActions.value,
      tableTitle: props.title,
    });

    function getRouteSearch() {
      const value = route.query.search;
      return Array.isArray(value) ? value[0] || '' : value || '';
    }

    function syncTableProps() {
      tableApi.setProps({
        buttons: buttons.value,
        columns: columns.value,
        formOptions: {
          schema: [
            {
              component: 'Input',
              componentProps: {
                allowClear: true,
                placeholder: `搜索${props.title}名称`,
              },
              fieldName: 'search',
              label: '关键词',
            },
          ],
        },
        rowActions: rowActions.value,
        tableTitle: props.title,
      });
    }

    function getTermFormDefaults(): WordpressBlogApi.TermBody {
      return {
        description: '',
        name: '',
        parent: undefined,
        slug: '',
      };
    }

    async function resetTermForm(values: WordpressBlogApi.TermBody) {
      await termFormApi.resetForm();
      await termFormApi.setValues(values);
      await termFormApi.resetValidate();
    }

    function openCreate() {
      editingId.value = undefined;
      termModalApi.setData({ values: getTermFormDefaults() }).open();
    }

    function openEdit(row: WordpressBlogApi.Term) {
      editingId.value = row.id;
      termModalApi
        .setData({
          values: {
            description: row.description || '',
            id: row.id,
            name: row.name,
            parent: row.parent || undefined,
            slug: row.slug || '',
          },
        })
        .open();
    }

    async function submitTerm() {
      const { valid } = await termFormApi.validate();
      if (!valid) return;

      const values = await termFormApi.getValues<WordpressBlogApi.TermBody>();
      const name = values.name?.trim();
      if (!name) {
        message.warning(`请填写${props.title}名称`);
        return;
      }

      termModalApi.lock();
      try {
        const payload = {
          ...values,
          id: editingId.value,
          name,
        };
        if (props.kind === 'category') {
          await (editingId.value
            ? updateCategory(payload)
            : createCategory(payload));
        } else {
          await (editingId.value ? updateTag(payload) : createTag(payload));
        }
        message.success(`${props.title}保存成功`);
        await termModalApi.close();
        await tableApi.reload();
      } finally {
        termModalApi.unlock();
      }
    }

    function openRelatedArticles(row: WordpressBlogApi.Term) {
      setBlogArticleFilters(
        props.kind === 'category'
          ? { categories: [row.id] }
          : { tags: [row.id] },
      );
      router.push({
        name: 'BlogArticle',
      });
    }

    async function reloadWithRouteSearch() {
      syncTableProps();
      await tableApi.setSearchValues({ search: getRouteSearch() });
      await tableApi.reload();
    }

    watch(
      () => props.kind,
      () => {
        reloadWithRouteSearch();
      },
    );

    onMounted(() => {
      reloadWithRouteSearch();
    });

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const term = record as WordpressBlogApi.Term;

              if (column.key === 'description') {
                return (
                  <span class="line-clamp-2">{term.description || '-'}</span>
                );
              }

              return undefined;
            },
          }}
        />

        <TermModal title={modalTitle.value}>
          <TermForm class="mx-2" />
        </TermModal>
      </Page>
    );
  },
});
