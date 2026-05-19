import type { TableColumnType } from 'antdv-next';

import type { WordpressBlogApi } from '#/api/blog';
import type {
  KtTableApi,
  KtTableButton,
  KtTableContext,
  KtTableRowAction,
} from '#/components/ktTable';

import {
  computed,
  defineComponent,
  onActivated,
  onMounted,
  reactive,
  ref,
} from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Switch,
  Tag,
  TextArea,
} from 'antdv-next';

import {
  createArticle,
  deleteArticle,
  getArticleList,
  getCategoryList,
  getTagList,
  updateArticle,
} from '#/api/blog';
import { KtTable, useKtTable } from '#/components/ktTable';

import { consumeBlogArticleFilters } from '../modules/use-article-filters';

type TermOption = {
  label: string;
  value: number;
};

type ArticleSearchValues = {
  categories?: number[];
  search?: string;
  status?: string;
  tags?: number[];
};

const AKtTable = KtTable as any;
const AInput = Input as any;
const AModal = Modal as any;
const ASelect = Select as any;
const ASwitch = Switch as any;
const ATextArea = TextArea as any;

const articleStatusOptions = [
  { color: 'success', label: '已发布', value: 'publish' },
  { color: 'default', label: '草稿', value: 'draft' },
  { color: 'warning', label: '待审核', value: 'pending' },
  { color: 'processing', label: '私有', value: 'private' },
];

export default defineComponent({
  name: 'BlogArticleList',
  setup() {
    const saving = ref(false);
    const modalOpen = ref(false);
    const editingId = ref<number>();
    const categoryOptions = ref<TermOption[]>([]);
    const tagOptions = ref<TermOption[]>([]);

    const form = reactive<WordpressBlogApi.ArticleBody>({
      categories: [],
      content: '',
      excerpt: '',
      slug: '',
      status: 'draft',
      sticky: false,
      tags: [],
      title: '',
    });

    const modalTitle = computed(() =>
      editingId.value ? '编辑文章' : '新建文章',
    );
    const columns: Array<TableColumnType<WordpressBlogApi.Article>> = [
      { dataIndex: 'title', key: 'title', title: '标题', width: 280 },
      { dataIndex: 'status', key: 'status', title: '状态', width: 110 },
      { dataIndex: 'categories', key: 'categories', title: '分类', width: 180 },
      { dataIndex: 'tags', key: 'tags', title: '标签', width: 180 },
      { dataIndex: 'modified', key: 'modified', title: '更新时间', width: 180 },
    ];

    const api: KtTableApi<WordpressBlogApi.Article, ArticleSearchValues> = {
      list: async (params) => {
        return await getArticleList({
          categories: Array.isArray(params.categories)
            ? params.categories.join(',')
            : undefined,
          pageNo: params.pageNo,
          pageSize: params.pageSize,
          search: params.search,
          status: params.status || undefined,
          tags: Array.isArray(params.tags) ? params.tags.join(',') : undefined,
        });
      },
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
        schema: [
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
              mode: 'multiple',
              options: categoryOptions.value,
            },
            fieldName: 'categories',
            label: '文章分类',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              mode: 'multiple',
              options: tagOptions.value,
            },
            fieldName: 'tags',
            label: '文章标签',
          },
        ],
      },
      immediate: false,
      rowActions,
      tableTitle: '文章管理',
    });

    function getRenderedText(value?: string | WordpressBlogApi.RenderedField) {
      if (!value) return '';
      if (typeof value === 'string') return stripHtml(value);
      return stripHtml(value.raw || value.rendered || '');
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

    function getTermLabel(options: TermOption[], value: number) {
      return options.find((item) => item.value === value)?.label || `${value}`;
    }

    async function applyPendingFilters() {
      const filters = consumeBlogArticleFilters();
      if (!filters) return false;

      await tableApi.setSearchValues({
        categories: filters.categories || [],
        tags: filters.tags || [],
      });

      return true;
    }

    async function loadTermOptions() {
      const [categories, tags] = await Promise.all([
        getCategoryList({ hide_empty: false, pageNo: 1, pageSize: 100 }),
        getTagList({ hide_empty: false, pageNo: 1, pageSize: 100 }),
      ]);
      categoryOptions.value = categories.list.map((item) => ({
        label: item.name,
        value: item.id,
      }));
      tagOptions.value = tags.list.map((item) => ({
        label: item.name,
        value: item.id,
      }));
      tableApi.setProps({
        formOptions: {
          schema: [
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
                mode: 'multiple',
                options: categoryOptions.value,
              },
              fieldName: 'categories',
              label: '文章分类',
            },
            {
              component: 'Select',
              componentProps: {
                allowClear: true,
                mode: 'multiple',
                options: tagOptions.value,
              },
              fieldName: 'tags',
              label: '文章标签',
            },
          ],
        },
      });
    }

    async function filterByCategory(id: number) {
      await tableApi.setSearchValues({ categories: [id] });
      await tableApi.search();
    }

    async function filterByTag(id: number) {
      await tableApi.setSearchValues({ tags: [id] });
      await tableApi.search();
    }

    async function openCreate(
      context?: KtTableContext<WordpressBlogApi.Article, ArticleSearchValues>,
    ) {
      const searchValues = context
        ? await context.getSearchValues()
        : await tableApi.getSearchValues();

      editingId.value = undefined;
      Object.assign(form, {
        categories: [...(searchValues.categories || [])],
        content: '',
        excerpt: '',
        slug: '',
        status: 'draft',
        sticky: false,
        tags: [...(searchValues.tags || [])],
        title: '',
      });
      modalOpen.value = true;
    }

    function openEdit(row: WordpressBlogApi.Article) {
      editingId.value = row.id;
      Object.assign(form, {
        categories: row.categories || [],
        content: getRenderedText(row.content),
        excerpt: getRenderedText(row.excerpt),
        id: row.id,
        slug: row.slug || '',
        status: row.status || 'draft',
        sticky: !!row.sticky,
        tags: row.tags || [],
        title: getRenderedText(row.title),
      });
      modalOpen.value = true;
    }

    async function submitArticle() {
      if (!form.title.trim()) {
        message.warning('请填写文章标题');
        return;
      }

      saving.value = true;
      try {
        const payload = {
          ...form,
          id: editingId.value,
          title: form.title.trim(),
        };
        await (editingId.value
          ? updateArticle(payload)
          : createArticle(payload));
        message.success('文章保存成功');
        modalOpen.value = false;
        await tableApi.reload();
      } finally {
        saving.value = false;
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

        <AModal
          confirmLoading={saving.value}
          onOk={submitArticle}
          onUpdate:open={(value: boolean) => {
            modalOpen.value = value;
          }}
          open={modalOpen.value}
          title={modalTitle.value}
          width="760px"
        >
          <Form labelCol={{ span: 4 }} model={form} wrapperCol={{ span: 19 }}>
            <FormItem label="标题" required>
              <AInput
                onUpdate:value={(value: string) => {
                  form.title = value;
                }}
                placeholder="请输入文章标题"
                value={form.title}
              />
            </FormItem>
            <FormItem label="状态">
              <ASelect
                onUpdate:value={(value: string | undefined) => {
                  form.status = value;
                }}
                options={articleStatusOptions}
                value={form.status}
              />
            </FormItem>
            <FormItem label="别名">
              <AInput
                onUpdate:value={(value: string | undefined) => {
                  form.slug = value;
                }}
                placeholder="可选，WordPress slug"
                value={form.slug}
              />
            </FormItem>
            <FormItem label="分类">
              <ASelect
                mode="multiple"
                onUpdate:value={(value: number[] | undefined) => {
                  form.categories = value;
                }}
                options={categoryOptions.value}
                placeholder="选择分类"
                value={form.categories}
              />
            </FormItem>
            <FormItem label="标签">
              <ASelect
                mode="multiple"
                onUpdate:value={(value: number[] | undefined) => {
                  form.tags = value;
                }}
                options={tagOptions.value}
                placeholder="选择标签"
                value={form.tags}
              />
            </FormItem>
            <FormItem label="摘要">
              <ATextArea
                autoSize={{ maxRows: 4, minRows: 2 }}
                onUpdate:value={(value: string | undefined) => {
                  form.excerpt = value;
                }}
                placeholder="可选，文章摘要"
                value={form.excerpt}
              />
            </FormItem>
            <FormItem label="内容">
              <ATextArea
                autoSize={{ maxRows: 12, minRows: 6 }}
                onUpdate:value={(value: string | undefined) => {
                  form.content = value;
                }}
                placeholder="支持 HTML 内容"
                value={form.content}
              />
            </FormItem>
            <FormItem label="置顶">
              <ASwitch
                checked={form.sticky}
                onUpdate:checked={(value: boolean) => {
                  form.sticky = value;
                }}
              />
            </FormItem>
          </Form>
        </AModal>
      </Page>
    );
  },
});
