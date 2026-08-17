import type { TableColumnType } from 'antdv-next';

import type { PropType } from 'vue';

import type { BlogApi } from '#/api/blog';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/kt-table';

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
import { KtTable, useKtTable } from '#/components/kt-table';

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

    const editingId = ref<string>();
    const tableRows = ref<BlogApi.Term[]>([]);
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
            placeholder: '可选，默认由名称生成',
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

    const modalTitle = computed(() => {
      if (editingId.value) {
        return `编辑${props.title}`;
      }
      return `新建${props.title}`;
    });
    const [TermModal, termModalApi] = useVbenModal({
      class: 'w-[620px]',
      fullscreenButton: false,
      /**
       * 确认分类或标签弹窗时校验并提交当前新建或编辑内容。
       */
      async onConfirm() {
        await submitTerm();
      },
      /**
       * 仅在分类或标签弹窗打开时读取上下文值，并重置字段与校验状态。
       *
       * @param isOpen - 弹窗或抽屉最新显隐状态；true 表示已打开。
       */
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = termModalApi.getData<{
          values?: BlogApi.TermBody;
        }>();
        void resetTermForm(values || getTermFormDefaults());
      },
    });
    const permissionModule = computed(() => {
      if (props.kind === 'category') {
        return 'Blog:Category';
      }
      return 'Blog:Tag';
    });
    const columns = computed<Array<TableColumnType<BlogApi.Term>>>(() => [
      { dataIndex: 'name', key: 'name', title: '名称', width: 220 },
      { dataIndex: 'slug', key: 'slug', title: '别名', width: 180 },
      { dataIndex: 'count', key: 'count', title: '文章数', width: 100 },
      {
        dataIndex: 'description',
        key: 'description',
        title: '描述',
        width: 300,
      },
    ]);
    const api: KtTableApi<BlogApi.Term, TermSearchValues> = {
      list: async (params) => {
        const requestParams = {
          hide_empty: false,
          pageNo: params.pageNo,
          pageSize: params.pageSize,
          search: params.search,
        };

        if (props.kind === 'category') {
          return await getCategoryList(requestParams);
        }
        return await getTagList(requestParams);
      },
    };
    const buttons = computed<
      Array<KtTableButton<BlogApi.Term, TermSearchValues>>
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
      Array<KtTableRowAction<BlogApi.Term, TermSearchValues>>
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
          `确认删除${props.title}「${row.name}」吗？本操作不会删除已关联文章。`,
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: async (row, context) => {
          await (() => {
            if (props.kind === 'category') {
              return deleteCategory(row.id);
            }
            return deleteTag(row.id);
          })();
          message.success(`${props.title}删除成功`);
          await context.reload();
        },
        permissionCodes: [`${permissionModule.value}:Delete`],
      },
    ]);

    const [registerTable, tableApi] = useKtTable<
      BlogApi.Term,
      TermSearchValues
    >({
      afterFetch: (result) => {
        if (Array.isArray(result)) {
          tableRows.value = result;
        } else {
          tableRows.value = result.list || result.records || result.items || [];
        }
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

    /**
     * 将当前路由的分类或标签搜索参数归一为单个字符串，数组参数只采用第一项。
     *
     * @returns 分类或标签路由参数的首个字符串值；没有参数时为空字符串。
     */
    function getRouteSearch() {
      const value = route.query.search;
      if (Array.isArray(value)) {
        return value[0] || '';
      }
      return value || '';
    }

    /**
     * 把分类或标签类型写入表格请求参数与标题，保持复用表格和当前路由一致。
     */
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

    /**
     * 根据分类或标签编辑记录生成表单初值，新建模式提供空名称与别名。
     *
     * @returns 编辑时为当前术语字段，新建时为名称、别名等字段的空初值。
     */
    function getTermFormDefaults(): BlogApi.TermBody {
      return {
        description: '',
        name: '',
        parent: undefined,
        slug: '',
      };
    }

    /**
     * 清空术语表单后写入目标字段值，并移除上一轮校验错误。
     *
     * @param values - 重置后要写入分类或标签表单的完整字段。
     */
    async function resetTermForm(values: BlogApi.TermBody) {
      await termFormApi.resetForm();
      await termFormApi.setValues(values);
      await termFormApi.resetValidate();
    }

    /**
     * 清除分类或标签编辑标识，并用默认父级与空字段打开新建弹窗。
     */
    function openCreate() {
      editingId.value = undefined;
      termModalApi.setData({ values: getTermFormDefaults() }).open();
    }

    /**
     * 把分类或标签记录转换为表单字段，并以编辑模式打开弹窗。
     *
     * @param row - 要加载到编辑弹窗的分类或标签记录。
     */
    function openEdit(row: BlogApi.Term) {
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

    /**
     * 校验分类或标签名称并按类型及编辑标识保存，成功后关闭弹窗并刷新列表。
     */
    async function submitTerm() {
      const { valid } = await termFormApi.validate();
      if (!valid) return;

      const values = await termFormApi.getValues<BlogApi.TermBody>();
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
          await (() => {
            if (editingId.value) {
              return updateCategory(payload);
            }
            return createCategory(payload);
          })();
        } else {
          await (() => {
            if (editingId.value) {
              return updateTag(payload);
            }
            return createTag(payload);
          })();
        }
        message.success(`${props.title}保存成功`);
        await termModalApi.close();
        await tableApi.reload();
      } finally {
        termModalApi.unlock();
      }
    }

    /**
     * 按当前分类或标签缓存文章筛选条件，并跳转到文章列表。
     *
     * @param row - 用户选中的分类或标签；其名称会写入文章列表的对应筛选条件。
     */
    function openRelatedArticles(row: BlogApi.Term) {
      setBlogArticleFilters(
        (() => {
          if (props.kind === 'category') {
            return { categories: [row.name] };
          }
          return { tags: [row.name] };
        })(),
      );
      router.push({
        name: 'BlogArticle',
      });
    }

    /**
     * 把筛选条件写入路由查询后重新加载列表，使刷新与分享保持相同视图。
     */
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
              const term = record as BlogApi.Term;

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
