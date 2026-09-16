import type { PropType } from 'vue';

import type {
  DefinitionClient,
  DefinitionDocument,
  DefinitionRevision,
  PublishedReference,
} from '#/api/automation/definition';

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';

import { Alert, Button, Select, Space } from 'antdv-next';

export default defineComponent({
  name: 'DefinitionReferencePicker',
  props: {
    api: { type: Object as PropType<DefinitionClient<any>>, required: true },
    value: {
      type: Object as PropType<null | PublishedReference>,
      default: null,
    },
    basePath: { type: String, required: true },
    label: { type: String, required: true },
    versionError: {
      type: Function as PropType<
        (version: DefinitionRevision<any>) => string | undefined
      >,
      default: undefined,
    },
  },
  emits: { change: (_value: null | PublishedReference) => true },
  setup(props, { emit }) {
    const router = useRouter();
    const resources = ref<DefinitionDocument<unknown>[]>([]);
    const selectedId = ref('');
    const versions = ref<DefinitionRevision<unknown>[]>([]);
    const loading = ref(false);
    const error = ref('');
    let searchGeneration = 0;
    let versionGeneration = 0;
    let searchTimer: ReturnType<typeof setTimeout> | undefined;
    const search = async (name = '') => {
      const current = ++searchGeneration;
      try {
        const page = await props.api.page({ name, pageSize: 100 });
        if (current !== searchGeneration) return;
        resources.value = page.list;
        const reference = props.value;
        if (
          reference &&
          !resources.value.some((item) => item.id === reference.id)
        ) {
          const selected = await props.api.detail(reference.id);
          if (current === searchGeneration) resources.value.unshift(selected);
        }
      } catch {
        if (current === searchGeneration)
          error.value = `${props.label}目录加载失败`;
      }
    };
    const chooseResource = async (id: string, selectLatest = false) => {
      const current = ++versionGeneration;
      selectedId.value = id;
      versions.value = [];
      error.value = '';
      loading.value = true;
      if (selectLatest) emit('change', null);
      try {
        const rows = await props.api.versions(id);
        if (current !== versionGeneration) return;
        versions.value = rows;
        const available = rows.find((row) => !props.versionError?.(row));
        if (selectLatest && available)
          emit('change', { id, version: available.version });
        if (rows.length === 0) {
          error.value = '该资源尚未发布，请先到所属模块发布版本。';
        } else if (!available) {
          const firstVersion = rows[0];
          error.value = '没有可用的发布版本';
          if (firstVersion)
            error.value = props.versionError?.(firstVersion) || error.value;
        } else if (props.value) {
          const selected = rows.find(
            (row) => row.version === props.value?.version,
          );
          if (selected) error.value = props.versionError?.(selected) || '';
        }
      } catch {
        if (current === versionGeneration) error.value = '发布版本加载失败';
      } finally {
        if (current === versionGeneration) loading.value = false;
      }
    };
    watch(
      () => props.value?.id,
      (id) => {
        if (id && id !== selectedId.value) void chooseResource(id);
      },
      { immediate: true },
    );
    onMounted(() => void search());
    onBeforeUnmount(() => {
      searchGeneration += 1;
      versionGeneration += 1;
      if (searchTimer) clearTimeout(searchTimer);
    });
    const versionOptions = computed(() => {
      const options = versions.value.map((item) => {
        const reason = props.versionError?.(item);
        let label = `v${item.version}`;
        if (reason) label += `（${reason}）`;
        return { label, value: item.version, disabled: Boolean(reason) };
      });
      const reference = props.value;
      if (
        reference &&
        !options.some((item) => item.value === reference.version)
      )
        options.unshift({
          label: `v${reference.version}（固定引用）`,
          value: reference.version,
          disabled: true,
        });
      return options;
    });
    return () => (
      <div class="space-y-2">
        <label class="block">{props.label}</label>
        <div class="flex gap-2">
          <Select
            class="min-w-0 flex-1"
            filterOption={false}
            onChange={(value) => void chooseResource(String(value), true)}
            onSearch={(value) => {
              if (searchTimer) clearTimeout(searchTimer);
              searchTimer = setTimeout(() => void search(String(value)), 250);
            }}
            options={resources.value.map((item) => ({
              label: item.name,
              value: item.id,
            }))}
            placeholder={`搜索${props.label}`}
            showSearch
            value={selectedId.value || undefined}
          />
          <Select
            loading={loading.value}
            onChange={(value) => {
              const version = versions.value.find(
                (item) => item.version === Number(value),
              );
              if (!version || props.versionError?.(version)) return;
              error.value = '';
              emit('change', {
                id: selectedId.value,
                version: version.version,
              });
            }}
            options={versionOptions.value}
            placeholder="发布版本"
            style={{ width: '150px' }}
            value={props.value?.version}
          />
        </div>
        <Space>
          <Button
            disabled={!selectedId.value}
            onClick={() =>
              router.push(`${props.basePath}/${selectedId.value}/designer`)
            }
            size="small"
          >
            打开所属模块
          </Button>
          <Button onClick={() => search()} size="small">
            刷新目录
          </Button>
        </Space>
        {error.value && <Alert message={error.value} type="warning" />}
      </div>
    );
  },
});
