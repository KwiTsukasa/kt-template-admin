import type { PropType } from 'vue';

import type { WordpressBlogApi } from '#/api/blog';

import {
  computed,
  defineComponent,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
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
  Table,
  TextArea,
} from 'antdv-next';

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

const AButton = Button as any;
const AInput = Input as any;
const AModal = Modal as any;
const ASelect = Select as any;
const ATable = Table as any;
const ATextArea = TextArea as any;

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
    const { hasAccessByCodes } = useAccess();

    const loading = ref(false);
    const saving = ref(false);
    const modalOpen = ref(false);
    const rows = ref<WordpressBlogApi.Term[]>([]);
    const total = ref(0);
    const editingId = ref<number>();

    const query = reactive({
      pageNo: 1,
      pageSize: 10,
      search: '',
    });

    const form = reactive<WordpressBlogApi.TermBody>({
      description: '',
      name: '',
      parent: undefined,
      slug: '',
    });

    const modalTitle = computed(() =>
      editingId.value ? `编辑${props.title}` : `新建${props.title}`,
    );
    const permissionModule = computed(() =>
      props.kind === 'category' ? 'Blog:Category' : 'Blog:Tag',
    );
    const canCreate = computed(() =>
      hasAccessByCodes([`${permissionModule.value}:Create`]),
    );
    const canEdit = computed(() =>
      hasAccessByCodes([`${permissionModule.value}:Edit`]),
    );
    const canDelete = computed(() =>
      hasAccessByCodes([`${permissionModule.value}:Delete`]),
    );
    const canViewArticles = computed(() =>
      hasAccessByCodes(['Blog:Article:List']),
    );
    const canOperate = computed(
      () => canViewArticles.value || canEdit.value || canDelete.value,
    );
    const columns = computed(() => {
      const baseColumns = [
        { dataIndex: 'name', key: 'name', title: '名称' },
        { dataIndex: 'slug', key: 'slug', title: '别名', width: 180 },
        { dataIndex: 'count', key: 'count', title: '文章数', width: 100 },
        { dataIndex: 'description', key: 'description', title: '描述' },
      ];

      return canOperate.value
        ? [...baseColumns, { key: 'action', title: '操作', width: 220 }]
        : baseColumns;
    });

    const parentOptions = computed(() =>
      rows.value
        .filter((item) => item.id !== editingId.value)
        .map((item) => ({ label: item.name, value: item.id })),
    );

    function getRouteSearch() {
      const value = route.query.search;
      return Array.isArray(value) ? value[0] || '' : value || '';
    }

    async function requestList() {
      const params = {
        hide_empty: false,
        pageNo: query.pageNo,
        pageSize: query.pageSize,
        search: query.search,
      };
      return props.kind === 'category'
        ? await getCategoryList(params)
        : await getTagList(params);
    }

    async function loadTerms() {
      loading.value = true;
      try {
        const result = await requestList();
        rows.value = result.list;
        total.value = result.total;
      } finally {
        loading.value = false;
      }
    }

    function resetSearch() {
      query.search = '';
      query.pageNo = 1;
      loadTerms();
    }

    function openCreate() {
      editingId.value = undefined;
      Object.assign(form, {
        description: '',
        name: '',
        parent: undefined,
        slug: '',
      });
      modalOpen.value = true;
    }

    function openEdit(row: Record<string, any> | WordpressBlogApi.Term) {
      const term = row as WordpressBlogApi.Term;
      editingId.value = term.id;
      Object.assign(form, {
        description: term.description || '',
        id: term.id,
        name: term.name,
        parent: term.parent || undefined,
        slug: term.slug || '',
      });
      modalOpen.value = true;
    }

    async function submitTerm() {
      if (!form.name.trim()) {
        message.warning(`请填写${props.title}名称`);
        return;
      }
      saving.value = true;
      try {
        const payload = {
          ...form,
          id: editingId.value,
          name: form.name.trim(),
        };
        if (props.kind === 'category') {
          await (editingId.value
            ? updateCategory(payload)
            : createCategory(payload));
        } else {
          await (editingId.value ? updateTag(payload) : createTag(payload));
        }
        message.success(`${props.title}保存成功`);
        modalOpen.value = false;
        loadTerms();
      } finally {
        saving.value = false;
      }
    }

    function confirmDelete(row: Record<string, any> | WordpressBlogApi.Term) {
      const term = row as WordpressBlogApi.Term;
      Modal.confirm({
        content: `确认删除${props.title}「${term.name}」吗？`,
        onOk: async () => {
          await (props.kind === 'category'
            ? deleteCategory(term.id)
            : deleteTag(term.id));
          message.success(`${props.title}删除成功`);
          loadTerms();
        },
        title: `删除${props.title}`,
      });
    }

    function openRelatedArticles(
      row: Record<string, any> | WordpressBlogApi.Term,
    ) {
      const term = row as WordpressBlogApi.Term;
      router.push({
        name: 'BlogArticle',
        query:
          props.kind === 'category'
            ? { category: `${term.id}` }
            : { tag: `${term.id}` },
      });
    }

    function handleTableChange(pagination: any) {
      query.pageNo = pagination.current || 1;
      query.pageSize = pagination.pageSize || 10;
      loadTerms();
    }

    watch(
      () => props.kind,
      () => {
        query.search = getRouteSearch();
        query.pageNo = 1;
        loadTerms();
      },
    );

    onMounted(() => {
      query.search = getRouteSearch();
      loadTerms();
    });

    return () => (
      <Page autoContentHeight>
        <div class="flex h-full min-h-0 flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-3 bg-card px-4 py-3">
            <Space wrap>
              <AInput
                allowClear
                class="w-[260px]"
                onPressEnter={loadTerms}
                onUpdate:value={(value: string) => {
                  query.search = value;
                }}
                placeholder={`搜索${props.title}名称`}
                value={query.search}
              />
              <AButton onClick={loadTerms}>查询</AButton>
              <AButton onClick={resetSearch}>
                <RotateCw class="size-4" />
                重置
              </AButton>
            </Space>
            {canCreate.value ? (
              <AButton onClick={openCreate} type="primary">
                <Plus class="size-4" />
                新建{props.title}
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
              scroll={{ x: 820 }}
              v-slots={{
                bodyCell: ({ column, record }: any) => {
                  if (column.key === 'description') {
                    return (
                      <span class="line-clamp-2">
                        {record.description || '-'}
                      </span>
                    );
                  }

                  if (column.key === 'action') {
                    return (
                      <Space>
                        {canViewArticles.value ? (
                          <AButton
                            onClick={() => openRelatedArticles(record)}
                            type="link"
                          >
                            查看文章
                          </AButton>
                        ) : null}
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
          onOk={submitTerm}
          onUpdate:open={(value: boolean) => {
            modalOpen.value = value;
          }}
          open={modalOpen.value}
          title={modalTitle.value}
          width="620px"
        >
          <Form labelCol={{ span: 5 }} model={form} wrapperCol={{ span: 18 }}>
            <FormItem label="名称" required>
              <AInput
                onUpdate:value={(value: string) => {
                  form.name = value;
                }}
                placeholder={`请输入${props.title}名称`}
                value={form.name}
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
            {props.kind === 'category' ? (
              <FormItem label="父级分类">
                <ASelect
                  allowClear
                  onUpdate:value={(value: number | undefined) => {
                    form.parent = value;
                  }}
                  options={parentOptions.value}
                  placeholder="选择父级分类"
                  value={form.parent}
                />
              </FormItem>
            ) : null}
            <FormItem label="描述">
              <ATextArea
                autoSize={{ maxRows: 6, minRows: 3 }}
                onUpdate:value={(value: string | undefined) => {
                  form.description = value;
                }}
                placeholder="可选"
                value={form.description}
              />
            </FormItem>
          </Form>
        </AModal>
      </Page>
    );
  },
});
