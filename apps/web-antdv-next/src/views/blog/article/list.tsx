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
} from '#/components/kt-table';

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
import { KtTable, useKtTable } from '#/components/kt-table';
import { KtMilkdownEditor } from '#/components/markdown';
import { KtTiptapHtmlEditor } from '#/components/rich-text';

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

    const modalTitle = computed(() => {
      if (editingId.value) {
        return '编辑文章';
      }
      return '新建文章';
    });
    const [ArticleModal, articleModalApi] = useVbenModal({
      class: BLOG_ARTICLE_MODAL_CLASS,
      contentClass: BLOG_ARTICLE_MODAL_CONTENT_CLASS,
      fullscreenButton: false,
      /**
       * 确认文章弹窗时校验并提交当前新建或编辑内容。
       */
      async onConfirm() {
        await submitArticle();
      },
      /**
       * 仅在文章弹窗打开时读取上下文值，并重置编辑器模式、字段和校验状态。
       *
       * @param isOpen - 弹窗或抽屉最新显隐状态；true 表示已打开。
       */
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
          categories: (() => {
            if (Array.isArray(params.categories)) {
              return params.categories.join(',');
            }
            return params.categories;
          })(),
          pageNo: params.pageNo,
          pageSize: params.pageSize,
          search: params.search,
          status: params.status || undefined,
          tags: (() => {
            if (Array.isArray(params.tags)) {
              return params.tags.join(',');
            }
            return params.tags;
          })(),
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

    /**
     * 生成文章关键词、状态、分类与标签筛选字段，并使用当前已加载的术语选项。
     *
     * @returns 可直接渲染文章搜索表单的字段 Schema 列表。
     */
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

    /**
     * 将文章发布状态映射为标签和颜色，未知状态按草稿展示。
     *
     * @param status - 文章发布状态；未匹配或缺省时回退到草稿选项。
     * @returns 与文章状态匹配的选项；未知状态回退为默认状态选项。
     */
    function getStatusOption(status?: string) {
      return (
        articleStatusOptions.find((item) => item.value === status) ||
        articleStatusOptions[1]
      );
    }

    /**
     * 从分类或标签选项中读取显示名称，未匹配时显示原始值。
     *
     * @param options - 分类或标签选项数组，用于按值查找显示名称。
     * @param value - 要匹配分类或标签名称的选项值。
     * @returns 与值匹配的分类或标签名称；未匹配时返回原始值文本。
     */
    function getTermLabel(options: TermOption[], value: string) {
      return options.find((item) => item.value === value)?.label || `${value}`;
    }

    /**
     * 消费一次性文章分类与标签筛选并写入搜索表单；没有待应用条件时保持表单不变。
     *
     * @returns 成功消费并写入筛选时返回 true；没有缓存筛选时返回 false。
     */
    async function applyPendingFilters() {
      const filters = consumeBlogArticleFilters();
      if (!filters) return false;

      await tableApi.setSearchValues({
        categories: (filters.categories || []).map((item) => `${item}`),
        tags: (filters.tags || []).map((item) => `${item}`),
      });

      return true;
    }

    /**
     * 并行加载文章分类与标签选项，更新筛选数据后重建搜索表单 Schema。
     */
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

    /**
     * 把选中分类作为唯一分类筛选写入文章表格，并立即执行搜索。
     *
     * @param value - 要写入文章列表分类筛选器的分类标识。
     */
    async function filterByCategory(value: string) {
      await tableApi.setSearchValues({ categories: [value] });
      await tableApi.search();
    }

    /**
     * 把选中标签作为唯一标签筛选写入文章表格，并立即执行搜索。
     *
     * @param value - 要写入文章列表标签筛选器的标签标识。
     */
    async function filterByTag(value: string) {
      await tableApi.setSearchValues({ tags: [value] });
      await tableApi.search();
    }

    /**
     * 将文章编辑模式恢复为目标值，再重置弹窗表单并清除校验状态。
     *
     * @param values - 弹窗重新打开时要恢复的文章表单字段。
     */
    async function resetArticleModalForm(values: BlogArticleFormValues) {
      await setArticleEditorMode(values.editorMode || 'markdown');
      await resetArticleForm(values);
    }

    /**
     * 清空文章表单后写入目标字段值，并移除上一轮校验错误。
     *
     * @param values - 重置后要写入文章表单的完整字段。
     */
    async function resetArticleForm(values: BlogArticleFormValues) {
      await articleFormApi.resetForm();
      await articleFormApi.setValues(values);
      await articleFormApi.resetValidate();
    }

    /**
     * 切换文章编辑器模式，并按当前内容在 Markdown 与富文本之间迁移可编辑值。
     *
     * @param mode - 文章内容使用的 Markdown、富文本或源码 HTML 编辑模式。
     */
    function handleArticleEditorModeChange(mode: BlogArticleEditorMode) {
      void setArticleEditorMode(mode, { preserveContent: true });
    }

    /**
     * 更新文章编辑器模式，并按选项决定是否同步转换现有内容。
     *
     * @param mode - 文章内容使用的 Markdown、富文本或源码 HTML 编辑模式。
     * @param options - 控制切换模式时是否同步转换正文；缺省时不转换。
     */
    async function setArticleEditorMode(
      mode: BlogArticleEditorMode,
      options: { preserveContent?: boolean } = {},
    ) {
      const currentValues = await (async () => {
        if (options.preserveContent) {
          return await articleFormApi.getValues<BlogArticleFormValues>();
        }
        return undefined;
      })();

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

    /**
     * 读取当前文章筛选条件作为默认分类或标签，并以新建模式打开文章弹窗。
     *
     * @param context - 用来读取当前分类与标签筛选值的 KtTable 上下文；可省略。
     */
    async function openCreate(
      context?: KtTableContext<BlogApi.Article, ArticleSearchValues>,
    ) {
      const searchValues = await (async () => {
        if (context) {
          return await context.getSearchValues();
        }
        return await tableApi.getSearchValues();
      })();

      editingId.value = undefined;
      const values = getBlogArticleCreateFormDefaults(searchValues);
      articleModalApi.setData({ values }).open();
    }

    /**
     * 把文章记录转换为可编辑字段，并以对应记录标识打开编辑弹窗。
     *
     * @param row - 要加载到编辑弹窗的文章列表记录。
     */
    function openEdit(row: BlogApi.Article) {
      editingId.value = `${row.id}`;
      const values = getBlogArticleEditFormValues(row);
      articleModalApi.setData({ values }).open();
    }

    /**
     * 把文章标识写入管理端预览路由并跳转，在新页面中展示该文章内容。
     *
     * @param row - 提供预览路由文章标识的列表记录。
     */
    function openPreview(row: BlogApi.Article) {
      void router.push({
        name: 'BlogArticlePreview',
        params: {
          articleId: row.id,
        },
      });
    }

    /**
     * 校验文章并按编辑标识执行新建或更新，成功后关闭弹窗、刷新术语选项与文章列表。
     */
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
        await (() => {
          if (editingId.value) {
            return updateArticle(payload);
          }
          return createArticle(payload);
        })();
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
                    {(() => {
                      if (article.link) {
                        return (
                          <a
                            class="text-xs text-primary"
                            href={article.link}
                            target="_blank"
                          >
                            查看原文
                          </a>
                        );
                      }
                      return null;
                    })()}
                  </div>
                );
              }

              if (column.key === 'status') {
                const status = getStatusOption(article.status);
                return <Tag color={status?.color}>{status?.label}</Tag>;
              }

              if (column.key === 'categories') {
                if (article.categories?.length) {
                  return (
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
                  );
                }
                return <span>-</span>;
              }

              if (column.key === 'tags') {
                if (article.tags?.length) {
                  return (
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
                  );
                }
                return <span>-</span>;
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
