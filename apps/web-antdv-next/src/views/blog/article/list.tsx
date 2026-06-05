import type { TableColumnType } from 'antdv-next';

import type { WordpressBlogApi } from '#/api/blog';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/ktTable';

import { computed, defineComponent, onActivated, onMounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus, SvgDownloadIcon } from '@vben/icons';

import { message, Modal, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createArticle,
  deleteArticle,
  getArticleCategoryOptions,
  getArticleList,
  getArticleTagOptions,
  importWordpressArticles,
  updateArticle,
} from '#/api/blog';
import { KtTable, useKtTable } from '#/components/ktTable';
import { KtMilkdownEditor } from '#/components/markdown';

import { consumeBlogArticleFilters } from '../modules/use-article-filters';

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
    const editingId = ref<string>();
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
        {
          component: KtMilkdownEditor,
          componentProps: {
            minHeight: 460,
            placeholder: '请输入 Markdown 正文',
          },
          fieldName: 'content',
          label: '内容',
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
      class: 'w-[760px]',
      fullscreenButton: false,
      async onConfirm() {
        await submitArticle();
      },
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = articleModalApi.getData<{
          values?: WordpressBlogApi.ArticleBody;
        }>();
        void resetArticleForm(values || getArticleFormDefaults());
      },
    });
    const columns: Array<TableColumnType<WordpressBlogApi.Article>> = [
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

    const api: KtTableApi<WordpressBlogApi.Article, ArticleSearchValues> = {
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
    const buttons: Array<
      KtTableButton<WordpressBlogApi.Article, ArticleSearchValues>
    > = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: '新建文章',
        onClick: openCreate,
        permissionCodes: ['Blog:Article:Create'],
        type: 'primary',
      },
      {
        icon: <SvgDownloadIcon class="kt-table__button-icon" />,
        key: 'import-wordpress',
        label: '导入 WordPress',
        onClick: confirmImportWordpress,
        permissionCodes: ['Blog:Article:Import'],
        type: 'default',
      },
    ];
    const rowActions: Array<
      KtTableRowAction<WordpressBlogApi.Article, ArticleSearchValues>
    > = [
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
      WordpressBlogApi.Article,
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

    function getRenderedText(value?: string | WordpressBlogApi.RenderedField) {
      if (!value) return '';
      if (typeof value === 'string') return stripHtml(value);
      return stripHtml(value.raw || value.rendered || '');
    }

    function getEditableContent(
      value?: string | WordpressBlogApi.RenderedField,
      markdown?: string,
    ) {
      if (markdown) return markdown;
      if (!value) return '';
      if (typeof value === 'string') return value;
      return value.raw || value.rendered || '';
    }

    function stripHtml(value: string) {
      return value
        .replaceAll(/<[^>]+>/g, '')
        .replaceAll('&nbsp;', ' ')
        .trim();
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

    function confirmImportWordpress(
      context: KtTableContext<WordpressBlogApi.Article, ArticleSearchValues>,
    ) {
      Modal.confirm({
        cancelText: '取消',
        content:
          '将从已配置的 WordPress 公开接口全量导入文章；同别名文章默认跳过。',
        okText: '开始导入',
        title: '导入 WordPress 文章',
        async onOk() {
          const result = await importWordpressArticles({
            all: true,
            overwrite: false,
            pageSize: 100,
          });
          const pageCount = result.pageCount || 1;
          message.success(
            `导入完成：扫描 ${pageCount} 页，新增 ${result.created} 篇，跳过 ${result.skipped} 篇，更新 ${result.updated} 篇`,
          );
          await loadTermOptions();
          await context.reload();
        },
      });
    }

    function getArticleFormDefaults(
      searchValues: ArticleSearchValues = {},
    ): WordpressBlogApi.ArticleBody {
      return {
        categories: [...(searchValues.categories || [])],
        content: '',
        contentFormat: 'markdown',
        excerpt: '',
        slug: '',
        status: 'draft',
        sticky: false,
        tags: [...(searchValues.tags || [])],
        title: '',
      };
    }

    async function resetArticleForm(values: WordpressBlogApi.ArticleBody) {
      await articleFormApi.resetForm();
      await articleFormApi.setValues(values);
      await articleFormApi.resetValidate();
    }

    async function openCreate(
      context?: KtTableContext<WordpressBlogApi.Article, ArticleSearchValues>,
    ) {
      const searchValues = context
        ? await context.getSearchValues()
        : await tableApi.getSearchValues();

      editingId.value = undefined;
      articleModalApi
        .setData({ values: getArticleFormDefaults(searchValues) })
        .open();
    }

    function openEdit(row: WordpressBlogApi.Article) {
      editingId.value = `${row.id}`;
      articleModalApi
        .setData({
          values: {
            categories: row.categories || [],
            content: getEditableContent(row.content, row.contentMarkdown),
            contentFormat: 'markdown',
            excerpt: getRenderedText(row.excerpt),
            id: row.id,
            slug: row.slug || '',
            status: row.status || 'draft',
            sticky: !!row.sticky,
            tags: row.tags || [],
            title: getRenderedText(row.title),
          },
        })
        .open();
    }

    async function submitArticle() {
      const { valid } = await articleFormApi.validate();
      if (!valid) return;

      const values =
        await articleFormApi.getValues<WordpressBlogApi.ArticleBody>();
      const title = values.title?.trim();
      if (!title) {
        message.warning('请填写文章标题');
        return;
      }

      articleModalApi.lock();
      try {
        const payload = {
          ...values,
          contentFormat: 'markdown' as const,
          id: editingId.value,
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
              const article = record as WordpressBlogApi.Article;

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
          <ArticleForm class="mx-2" />
        </ArticleModal>
      </Page>
    );
  },
});
