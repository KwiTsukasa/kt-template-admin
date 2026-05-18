import type { WordpressBlogApi } from '#/api/blog';

import { computed, defineComponent, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { Plus, RotateCw } from '@vben/icons';

import {
  Button,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Table,
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

type TermOption = {
  label: string;
  value: number;
};

const AButton = Button as any;
const AInput = Input as any;
const AModal = Modal as any;
const ASelect = Select as any;
const ASwitch = Switch as any;
const ATable = Table as any;
const ATextArea = TextArea as any;

export default defineComponent({
  name: 'BlogArticleList',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const { hasAccessByCodes } = useAccess();

    const articleStatusOptions = [
      { color: 'success', label: '已发布', value: 'publish' },
      { color: 'default', label: '草稿', value: 'draft' },
      { color: 'warning', label: '待审核', value: 'pending' },
      { color: 'processing', label: '私有', value: 'private' },
    ];

    const loading = ref(false);
    const saving = ref(false);
    const modalOpen = ref(false);
    const rows = ref<WordpressBlogApi.Article[]>([]);
    const total = ref(0);
    const editingId = ref<number>();
    const categoryOptions = ref<TermOption[]>([]);
    const tagOptions = ref<TermOption[]>([]);

    const query = reactive({
      categoryId: undefined as number | undefined,
      pageNo: 1,
      pageSize: 10,
      search: '',
      status: undefined as string | undefined,
      tagId: undefined as number | undefined,
    });

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
    const canCreate = computed(() => hasAccessByCodes(['Blog:Article:Create']));
    const canEdit = computed(() => hasAccessByCodes(['Blog:Article:Edit']));
    const canDelete = computed(() => hasAccessByCodes(['Blog:Article:Delete']));
    const canOperate = computed(() => canEdit.value || canDelete.value);
    const columns = computed(() => {
      const baseColumns = [
        { dataIndex: 'title', key: 'title', title: '标题' },
        { dataIndex: 'status', key: 'status', title: '状态', width: 110 },
        {
          dataIndex: 'categories',
          key: 'categories',
          title: '分类',
          width: 180,
        },
        { dataIndex: 'tags', key: 'tags', title: '标签', width: 180 },
        {
          dataIndex: 'modified',
          key: 'modified',
          title: '更新时间',
          width: 180,
        },
      ];

      return canOperate.value
        ? [...baseColumns, { key: 'action', title: '操作', width: 150 }]
        : baseColumns;
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

    function getRouteNumber(name: 'category' | 'tag') {
      const value = route.query[name];
      const rawValue = Array.isArray(value) ? value[0] : value;
      const id = Number(rawValue);

      return Number.isFinite(id) && id > 0 ? id : undefined;
    }

    function readRouteFilters() {
      query.categoryId = getRouteNumber('category');
      query.tagId = getRouteNumber('tag');
    }

    function syncRouteFilters() {
      const nextQuery = { ...route.query };

      if (query.categoryId) {
        nextQuery.category = `${query.categoryId}`;
      } else {
        delete nextQuery.category;
      }

      if (query.tagId) {
        nextQuery.tag = `${query.tagId}`;
      } else {
        delete nextQuery.tag;
      }

      return router.replace({
        name: 'BlogArticle',
        query: nextQuery,
      });
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
    }

    async function loadArticles() {
      loading.value = true;
      try {
        const result = await getArticleList({
          categories: query.categoryId ? `${query.categoryId}` : undefined,
          pageNo: query.pageNo,
          pageSize: query.pageSize,
          search: query.search,
          status: query.status || undefined,
          tags: query.tagId ? `${query.tagId}` : undefined,
        });
        rows.value = result.list;
        total.value = result.total;
      } finally {
        loading.value = false;
      }
    }

    async function searchArticles() {
      query.pageNo = 1;
      await syncRouteFilters();
      await loadArticles();
    }

    function resetSearch() {
      query.categoryId = undefined;
      query.search = '';
      query.status = undefined;
      query.tagId = undefined;
      query.pageNo = 1;
      syncRouteFilters();
      loadArticles();
    }

    async function filterByCategory(id: number) {
      query.categoryId = id;
      query.pageNo = 1;
      await syncRouteFilters();
      await loadArticles();
    }

    async function filterByTag(id: number) {
      query.tagId = id;
      query.pageNo = 1;
      await syncRouteFilters();
      await loadArticles();
    }

    function openCreate() {
      editingId.value = undefined;
      Object.assign(form, {
        categories: [],
        content: '',
        excerpt: '',
        slug: '',
        status: 'draft',
        sticky: false,
        tags: [],
        title: '',
      });
      modalOpen.value = true;
    }

    function openEdit(row: Record<string, any> | WordpressBlogApi.Article) {
      const article = row as WordpressBlogApi.Article;
      editingId.value = article.id;
      Object.assign(form, {
        categories: article.categories || [],
        content: getRenderedText(article.content),
        excerpt: getRenderedText(article.excerpt),
        id: article.id,
        slug: article.slug || '',
        status: article.status || 'draft',
        sticky: !!article.sticky,
        tags: article.tags || [],
        title: getRenderedText(article.title),
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
        loadArticles();
      } finally {
        saving.value = false;
      }
    }

    function confirmDelete(
      row: Record<string, any> | WordpressBlogApi.Article,
    ) {
      const article = row as WordpressBlogApi.Article;
      Modal.confirm({
        content: `确认删除文章「${getRenderedText(article.title) || article.id}」吗？`,
        onOk: async () => {
          await deleteArticle(article.id);
          message.success('文章删除成功');
          loadArticles();
        },
        title: '删除文章',
      });
    }

    function handleTableChange(pagination: any) {
      query.pageNo = pagination.current || 1;
      query.pageSize = pagination.pageSize || 10;
      loadArticles();
    }

    onMounted(async () => {
      readRouteFilters();
      await loadTermOptions();
      await loadArticles();
    });

    return () => (
      <Page autoContentHeight>
        <div class="flex h-full min-h-0 flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-3 bg-card px-4 py-3">
            <Space wrap>
              <AInput
                allowClear
                class="w-[260px]"
                onPressEnter={searchArticles}
                onUpdate:value={(value: string) => {
                  query.search = value;
                }}
                placeholder="搜索标题或内容"
                value={query.search}
              />
              <ASelect
                allowClear
                class="w-[150px]"
                onUpdate:value={(value: string | undefined) => {
                  query.status = value;
                }}
                options={articleStatusOptions}
                placeholder="文章状态"
                value={query.status}
              />
              <ASelect
                allowClear
                class="w-[150px]"
                onUpdate:value={(value: number | undefined) => {
                  query.categoryId = value;
                }}
                options={categoryOptions.value}
                placeholder="文章分类"
                value={query.categoryId}
              />
              <ASelect
                allowClear
                class="w-[150px]"
                onUpdate:value={(value: number | undefined) => {
                  query.tagId = value;
                }}
                options={tagOptions.value}
                placeholder="文章标签"
                value={query.tagId}
              />
              <AButton onClick={searchArticles}>查询</AButton>
              <AButton onClick={resetSearch}>
                <RotateCw class="size-4" />
                重置
              </AButton>
            </Space>
            {canCreate.value ? (
              <AButton onClick={openCreate} type="primary">
                <Plus class="size-4" />
                新建文章
              </AButton>
            ) : null}
          </div>

          <div class="min-h-0 flex-1 bg-card p-4">
            <ATable
              columns={columns.value}
              dataSource={rows.value}
              loading={loading.value}
              onChange={handleTableChange}
              pagination={{
                current: query.pageNo,
                pageSize: query.pageSize,
                showSizeChanger: true,
                total: total.value,
              }}
              rowKey="id"
              scroll={{ x: 980 }}
              v-slots={{
                bodyCell: ({ column, record }: any) => {
                  if (column.key === 'title') {
                    return (
                      <div class="max-w-[420px]">
                        <div class="truncate font-medium">
                          {getRenderedText(record.title) || '-'}
                        </div>
                        {record.link ? (
                          <a
                            class="text-xs text-primary"
                            href={record.link}
                            target="_blank"
                          >
                            查看原文
                          </a>
                        ) : null}
                      </div>
                    );
                  }

                  if (column.key === 'status') {
                    const status = getStatusOption(record.status);
                    return <Tag color={status?.color}>{status?.label}</Tag>;
                  }

                  if (column.key === 'categories') {
                    return record.categories?.length ? (
                      <Space size={[4, 4]} wrap>
                        {record.categories.map((item: number) => (
                          <Tag
                            class="cursor-pointer"
                            color="blue"
                            key={item}
                            onClick={() => filterByCategory(item)}
                          >
                            {getTermLabel(categoryOptions.value, item)}
                          </Tag>
                        ))}
                      </Space>
                    ) : (
                      <span>-</span>
                    );
                  }

                  if (column.key === 'tags') {
                    return record.tags?.length ? (
                      <Space size={[4, 4]} wrap>
                        {record.tags.map((item: number) => (
                          <Tag
                            class="cursor-pointer"
                            key={item}
                            onClick={() => filterByTag(item)}
                          >
                            {getTermLabel(tagOptions.value, item)}
                          </Tag>
                        ))}
                      </Space>
                    ) : (
                      <span>-</span>
                    );
                  }

                  if (column.key === 'action') {
                    return (
                      <Space>
                        {canEdit.value ? (
                          <AButton onClick={() => openEdit(record)} type="link">
                            编辑
                          </AButton>
                        ) : null}
                        {canDelete.value ? (
                          <AButton
                            danger
                            onClick={() => confirmDelete(record)}
                            type="link"
                          >
                            删除
                          </AButton>
                        ) : null}
                      </Space>
                    );
                  }

                  return undefined;
                },
              }}
            />
          </div>
        </div>

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
