import type { TableColumnType } from 'antdv-next';

import type {
  BlogArticleEditorMode,
  BlogArticleFormValues,
} from '../modules/article-form';

import type { BlogApi } from '#/api/blog';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/ktTable';

import { computed, defineComponent, onActivated, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createArticle,
  deleteArticle,
  getArticleCategoryOptions,
  getArticleList,
  getArticleTagOptions,
  updateArticle,
} from '#/api/blog';
import { KtTable, useKtTable } from '#/components/ktTable';
import { KtMilkdownEditor } from '#/components/markdown';
import { KtTiptapHtmlEditor } from '#/components/richText';

import {
  BLOG_ARTICLE_FORM_CLASS,
  BLOG_ARTICLE_MODAL_CLASS,
  BLOG_ARTICLE_MODAL_CONTENT_CLASS,
  buildBlogArticleSubmitPayload,
  createBlogArticleContentSchema,
  createBlogArticleEditorModeSchema,
  getBlogArticleCreateFormDefaults,
  getBlogArticleEditFormValues,
  getContentFormatForEditorMode,
  getRenderedText,
} from '../modules/article-form';
import { consumeBlogArticleFilters } from '../modules/use-article-filters';

import './list.scss';

type TermOption = {
  label: string;
  value: string;
};

type ArticleSearchValues = {
  categories?: string[];
  search?: string;
  status?: string;
  tags?: string[];
};

const AKtTable = KtTable as any;

const articleStatusOptions = [
  { color: 'success', label: '已发布', value: 'publish' },
  { color: 'default', label: '草稿', value: 'draft' },
  { color: 'warning', label: '待审核', value: 'pending' },
  { color: 'processing', label: '私有', value: 'private' },
];

export default defineComponent({
  name: 'BlogArticleList',
  setup() {
    const router = useRouter();
    const editingId = ref<string>();
    const contentEditMode = ref<BlogArticleEditorMode>('markdown');
    const categoryOptions = ref<TermOption[]>([]);
    const tagOptions = ref<TermOption[]>([]);

    const [ArticleForm, articleFormApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-20',
      },
      layout: 'horizontal',
      schema: [
        {
          component: 'Input',
          componentProps: {
            placeholder: '请输入文章标题',
          },
          fieldName: 'title',
          label: '标题',
          rules: 'required',
        },
        {
          component: 'Select',
          componentProps: {
            options: articleStatusOptions,
          },
          fieldName: 'status',
          label: '状态',
        },
        {
          component: 'Input',
          componentProps: {
            placeholder: '可选，默认由标题生成',
          },
          fieldName: 'slug',
          label: '别名',
        },
        {
          component: 'Select',
          componentProps: () => ({
            mode: 'tags',
            options: categoryOptions.value,
            placeholder: '输入或选择分类',
          }),
          fieldName: 'categories',
          label: '分类',
        },
        {
          component: 'Select',
          componentProps: () => ({
            mode: 'tags',
            options: tagOptions.value,
            placeholder: '输入或选择标签',
          }),
          fieldName: 'tags',
          label: '标签',
        },
        {
          component: 'Textarea',
          componentProps: {
            autoSize: { maxRows: 4, minRows: 2 },
            placeholder: '可选，文章摘要',
          },
          fieldName: 'excerpt',
          label: '摘要',
        },
        createBlogArticleEditorModeSchema(handleArticleEditorModeChange),
        {
          ...createBlogArticleContentSchema(
            'markdown',
            KtMilkdownEditor,
            KtTiptapHtmlEditor,
          ),
        },
        {
          component: 'Switch',
          fieldName: 'sticky',
          label: '置顶',
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });

    const modalTitle = computed(() =>
      editingId.value ? '编辑文章' : '新建文章',
    );
    const [ArticleModal, articleModalApi] = useVbenModal({
      class: BLOG_ARTICLE_MODAL_CLASS,
      contentClass: BLOG_ARTICLE_MODAL_CONTENT_CLASS,
      fullscreenButton: false,
      async onConfirm() {
        await submitArticle();
      },
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = articleModalApi.getData<{
          values?: BlogArticleFormValues;
        }>();
        void resetArticleModalForm(
          values || getBlogArticleCreateFormDefaults(),
        );
      },
    });
    const columns: Array<TableColumnType<BlogApi.Article>> = [
      { dataIndex: 'title', key: 'title', title: '标题', width: 280 },
      { dataIndex: 'status', key: 'status', title: '状态', width: 110 },
      { dataIndex: 'categories', key: 'categories', title: '分类', width: 180 },
      { dataIndex: 'tags', key: 'tags', title: '标签', width: 180 },
      {
        dataIndex: 'updateTime',
        key: 'modified',
        title: '更新时间',
        width: 180,
      },
    ];

    const api: KtTableApi<BlogApi.Article, ArticleSearchValues> = {
      list: (params) =>
        getArticleList({
          categories: Array.isArray(params.categories)
            ? params.categories.join(',')
            : params.categories,
          pageNo: params.pageNo,
          pageSize: params.pageSize,
          search: params.search,
          status: params.status || undefined,
          tags: Array.isArray(params.tags)
            ? params.tags.join(',')
            : params.tags,
        }),
    };
    const buttons: Array<KtTableButton<BlogApi.Article, ArticleSearchValues>> =
      [
        {
          icon: <Plus class="kt-table__button-icon" />,
          key: 'create',
          label: '新建文章',
          onClick: openCreate,
          permissionCodes: ['Blog:Article:Create'],
          type: 'primary',
        },
      ];
    const rowActions: Array<
      KtTableRowAction<BlogApi.Article, ArticleSearchValues>
    > = [
      {
        key: 'preview',
        label: '预览',
        onClick: openPreview,
        permissionCodes: ['Blog:Article:Preview'],
      },
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        permissionCodes: ['Blog:Article:Edit'],
      },
      {
        confirm: (row) =>
          `确认删除文章「${getRenderedText(row.title) || row.id}」吗？`,
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: async (row, context) => {
          await deleteArticle(row.id);
          message.success('文章删除成功');
          await context.reload();
        },
        permissionCodes: ['Blog:Article:Delete'],
      },
    ];

    const [registerTable, tableApi] = useKtTable<
      BlogApi.Article,
      ArticleSearchValues
    >({
      api,
      buttons,
      columns,
      formOptions: {
        schema: getArticleSearchSchema(),
      },
      immediate: false,
      rowActions,
      tableTitle: '文章管理',
    });

    function getArticleSearchSchema() {
      return [
        {
          component: 'Input',
          componentProps: {
            allowClear: true,
            placeholder: '搜索标题或内容',
          },
          fieldName: 'search',
          label: '关键词',
        },
        {
          component: 'Select',
          componentProps: {
            allowClear: true,
            options: articleStatusOptions,
          },
          fieldName: 'status',
          label: '文章状态',
        },
        {
          component: 'Select',
          componentProps: {
            allowClear: true,
            mode: 'tags',
            options: categoryOptions.value,
          },
          fieldName: 'categories',
          label: '文章分类',
        },
        {
          component: 'Select',
          componentProps: {
            allowClear: true,
            mode: 'tags',
            options: tagOptions.value,
          },
          fieldName: 'tags',
          label: '文章标签',
        },
      ];
    }

    function getStatusOption(status?: string) {
      return (
        articleStatusOptions.find((item) => item.value === status) ||
        articleStatusOptions[1]
      );
    }

    function getTermLabel(options: TermOption[], value: string) {
      return options.find((item) => item.value === value)?.label || `${value}`;
    }

    async function applyPendingFilters() {
      const filters = consumeBlogArticleFilters();
      if (!filters) return false;

      await tableApi.setSearchValues({
        categories: (filters.categories || []).map((item) => `${item}`),
        tags: (filters.tags || []).map((item) => `${item}`),
      });

      return true;
    }

    async function loadTermOptions() {
      const [categories, tags] = await Promise.all([
        getArticleCategoryOptions({ pageNo: 1, pageSize: 200 }),
        getArticleTagOptions({ pageNo: 1, pageSize: 200 }),
      ]);
      categoryOptions.value = categories.list.map((item) => ({
        label: item.name,
        value: item.name,
      }));
      tagOptions.value = tags.list.map((item) => ({
        label: item.name,
        value: item.name,
      }));
      tableApi.setProps({
        formOptions: {
          schema: getArticleSearchSchema(),
        },
      });
    }

    async function filterByCategory(value: string) {
      await tableApi.setSearchValues({ categories: [value] });
      await tableApi.search();
    }

    async function filterByTag(value: string) {
      await tableApi.setSearchValues({ tags: [value] });
      await tableApi.search();
    }

    async function resetArticleModalForm(values: BlogArticleFormValues) {
      await setArticleEditorMode(values.editorMode || 'markdown');
      await resetArticleForm(values);
    }

    async function resetArticleForm(values: BlogArticleFormValues) {
      await articleFormApi.resetForm();
      await articleFormApi.setValues(values);
      await articleFormApi.resetValidate();
    }

    function handleArticleEditorModeChange(mode: BlogArticleEditorMode) {
      void setArticleEditorMode(mode, { preserveContent: true });
    }

    async function setArticleEditorMode(
      mode: BlogArticleEditorMode,
      options: { preserveContent?: boolean } = {},
    ) {
      const currentValues = options.preserveContent
        ? await articleFormApi.getValues<BlogArticleFormValues>()
        : undefined;

      contentEditMode.value = mode;
      await articleFormApi.updateSchema([
        createBlogArticleEditorModeSchema(handleArticleEditorModeChange),
        createBlogArticleContentSchema(
          mode,
          KtMilkdownEditor,
          KtTiptapHtmlEditor,
        ),
      ]);

      const nextValues: Partial<BlogArticleFormValues> = {
        contentFormat: getContentFormatForEditorMode(mode),
        editorMode: mode,
      };
      if (
        options.preserveContent &&
        currentValues &&
        'content' in currentValues
      ) {
        nextValues.content = currentValues.content;
      }
      await articleFormApi.setValues(nextValues);
    }

    async function openCreate(
      context?: KtTableContext<BlogApi.Article, ArticleSearchValues>,
    ) {
      const searchValues = context
        ? await context.getSearchValues()
        : await tableApi.getSearchValues();

      editingId.value = undefined;
      const values = getBlogArticleCreateFormDefaults(searchValues);
      articleModalApi.setData({ values }).open();
    }

    function openEdit(row: BlogApi.Article) {
      editingId.value = `${row.id}`;
      const values = getBlogArticleEditFormValues(row);
      articleModalApi.setData({ values }).open();
    }

    /**
     * @param row 文章列表当前行，用其数据库 ID 打开专用 Blog Web 预览页。
     */
    function openPreview(row: BlogApi.Article) {
      void router.push({
        name: 'BlogArticlePreview',
        params: {
          articleId: row.id,
        },
      });
    }

    async function submitArticle() {
      const { valid } = await articleFormApi.validate();
      if (!valid) return;

      const values = await articleFormApi.getValues<BlogArticleFormValues>();
      const title = values.title?.trim();
      if (!title) {
        message.warning('请填写文章标题');
        return;
      }

      articleModalApi.lock();
      try {
        const payload = {
          ...buildBlogArticleSubmitPayload(
            values,
            editingId.value,
            contentEditMode.value,
          ),
          title,
        };
        await (editingId.value
          ? updateArticle(payload)
          : createArticle(payload));
        message.success('文章保存成功');
        await articleModalApi.close();
        await loadTermOptions();
        await tableApi.reload();
      } finally {
        articleModalApi.unlock();
      }
    }

    onMounted(async () => {
      await loadTermOptions();
      await applyPendingFilters();
      await tableApi.reload();
    });

    onActivated(async () => {
      if (await applyPendingFilters()) {
        await tableApi.search();
      }
    });

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const article = record as BlogApi.Article;

              if (column.key === 'title') {
                return (
                  <div class="max-w-[420px]">
                    <div class="truncate font-medium">
                      {getRenderedText(article.title) || '-'}
                    </div>
                    {article.link ? (
                      <a
                        class="text-xs text-primary"
                        href={article.link}
                        target="_blank"
                      >
                        查看原文
                      </a>
                    ) : null}
                  </div>
                );
              }

              if (column.key === 'status') {
                const status = getStatusOption(article.status);
                return <Tag color={status?.color}>{status?.label}</Tag>;
              }

              if (column.key === 'categories') {
                return article.categories?.length ? (
                  <div class="flex flex-wrap gap-1">
                    {article.categories.map((item) => (
                      <Tag
                        class="cursor-pointer"
                        color="blue"
                        key={item}
                        onClick={() => filterByCategory(item)}
                      >
                        {getTermLabel(categoryOptions.value, item)}
                      </Tag>
                    ))}
                  </div>
                ) : (
                  <span>-</span>
                );
              }

              if (column.key === 'tags') {
                return article.tags?.length ? (
                  <div class="flex flex-wrap gap-1">
                    {article.tags.map((item) => (
                      <Tag
                        class="cursor-pointer"
                        key={item}
                        onClick={() => filterByTag(item)}
                      >
                        {getTermLabel(tagOptions.value, item)}
                      </Tag>
                    ))}
                  </div>
                ) : (
                  <span>-</span>
                );
              }

              return undefined;
            },
          }}
        />

        <ArticleModal title={modalTitle.value}>
          <ArticleForm class={BLOG_ARTICLE_FORM_CLASS} />
        </ArticleModal>
      </Page>
    );
  },
});
