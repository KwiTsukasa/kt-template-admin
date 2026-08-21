import type { VNodeChild } from 'vue';

import type { LlmApi } from '#/api/llm';

import { computed, defineComponent, ref } from 'vue';

import { Alert, Button, Drawer, message, Space } from 'antdv-next';

import { useVbenForm, z } from '#/adapter/form';
import { createLlmConfig, updateLlmConfig } from '#/api/llm';

const AAlert = Alert as any;
const AButton = Button as any;
const ADrawer = Drawer as any;
const ASpace = Space as any;

type DrawerMode = 'create' | 'edit' | 'view';

interface ConfigFormValues {
  apiKey?: string;
  baseUrl: string;
  enabled: boolean;
  isDefault: boolean;
  name: string;
  provider: LlmApi.Provider;
}

export interface LlmConfigDrawerExposed {
  openCreate: () => void;
  openEdit: (config: LlmApi.Config) => void;
  openView: (config: LlmApi.Config) => void;
}

export default defineComponent({
  name: 'LlmConfigDrawer',
  props: {
    providers: {
      default: () => [],
      type: Array as () => LlmApi.ProviderCatalogItem[],
    },
  },
  emits: ['saved'],
  setup(props, { emit, expose }) {
    const current = ref<LlmApi.Config>();
    const mode = ref<DrawerMode>('create');
    const open = ref(false);
    const saving = ref(false);
    const formValues = ref<ConfigFormValues>(createDefaults(props.providers));
    const [ConfigForm, formApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-28 whitespace-nowrap',
      },
      /**
       * 合并表单变化，并在供应商切换时应用其默认端点。
       * @param values - 表单当前回传的字段和值。
       * @param fieldsChanged - 本轮变化字段名集合。
       */
      handleValuesChange(values, fieldsChanged) {
        const next = {
          ...formValues.value,
          ...(values as Partial<ConfigFormValues>),
        };
        if (fieldsChanged.includes('provider')) {
          const provider = props.providers.find(
            (item) => item.provider === next.provider,
          );
          if (provider) {
            next.baseUrl = provider.defaultBaseUrl;
            void formApi.setFieldValue('baseUrl', provider.defaultBaseUrl);
          }
          if (next.provider === 'codex') {
            next.apiKey = '';
            void formApi.setFieldValue('apiKey', '');
          }
        }
        if (fieldsChanged.includes('enabled') && !next.enabled) {
          next.isDefault = false;
          void formApi.setFieldValue('isDefault', false);
        }
        formValues.value = next;
      },
      layout: 'horizontal',
      schema: [
        {
          component: 'Input',
          componentProps: {
            allowClear: true,
            maxlength: 100,
            placeholder: '例如：生产环境 OpenAI',
          },
          fieldName: 'name',
          label: '配置名称',
          rules: z.string().trim().min(1, '请输入配置名称').max(100),
        },
        {
          component: 'Select',
          componentProps: () => ({
            options: props.providers.map((item) => ({
              label: item.label,
              value: item.provider,
            })),
          }),
          fieldName: 'provider',
          label: '供应商',
          rules: 'selectRequired',
        },
        {
          component: 'Input',
          componentProps: () => ({
            allowClear: true,
            disabled: formValues.value.provider === 'codex',
            maxlength: 1000,
            placeholder: '请输入 API Base URL 或私有 Codex gateway 地址',
          }),
          fieldName: 'baseUrl',
          label: '连接端点',
          rules: z.string().trim().url('请输入完整 HTTP(S) 地址').max(1000),
        },
        {
          component: 'InputPassword',
          componentProps: () => ({
            autocomplete: 'new-password',
            disabled: formValues.value.provider === 'codex',
            maxlength: 4096,
            placeholder: '留空表示保留已配置密钥；本地 Codex 无需填写',
          }),
          fieldName: 'apiKey',
          help: '密钥只写入 API 加密存储，列表、详情和日志均不回显。',
          label: 'API Key',
        },
        {
          component: 'Switch',
          fieldName: 'enabled',
          label: '启用连接',
        },
        {
          component: 'Switch',
          componentProps: () => ({
            disabled: !formValues.value.enabled,
          }),
          fieldName: 'isDefault',
          label: '默认连接',
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const title = computed(() => {
      if (mode.value === 'create') return '新增大模型配置';
      if (mode.value === 'edit') return '编辑大模型配置';
      return '大模型配置详情';
    });

    /**
     * 重置表单并打开新增配置抽屉。
     */
    function openCreate() {
      mode.value = 'create';
      current.value = undefined;
      const values = createDefaults(props.providers);
      open.value = true;
      void resetForm(values);
    }

    /**
     * 把现有连接载入可编辑表单，API Key 始终留空。
     * @param config - 待编辑的脱敏连接详情。
     */
    function openEdit(config: LlmApi.Config) {
      mode.value = 'edit';
      current.value = config;
      const values = configToForm(config);
      open.value = true;
      void resetForm(values);
    }

    /**
     * 只把脱敏字段绑定到详情态，并用凭据状态替代密钥内容。
     * @param config - 待查看的脱敏连接详情。
     */
    function openView(config: LlmApi.Config) {
      mode.value = 'view';
      current.value = config;
      open.value = true;
    }

    /**
     * 重置校验和表单值，避免上次 API Key 留在下一次抽屉会话。
     * @param values - 要写入表单的完整连接值。
     */
    async function resetForm(values: ConfigFormValues) {
      formValues.value = values;
      await formApi.resetForm();
      await formApi.setValues(values);
      await formApi.resetValidate();
    }

    /**
     * 校验表单并创建或更新连接，成功后关闭抽屉并通知列表刷新。
     */
    async function submit() {
      const { valid } = await formApi.validate();
      if (!valid) return;
      const values = await formApi.getValues<ConfigFormValues>();
      const payload = toInput(values);
      saving.value = true;
      try {
        let saved: LlmApi.Config;
        if (mode.value === 'edit' && current.value) {
          saved = await updateLlmConfig(current.value.id, payload);
        } else {
          saved = await createLlmConfig(payload);
        }
        message.success('大模型配置已保存');
        open.value = false;
        emit('saved', saved);
      } finally {
        saving.value = false;
      }
    }

    /**
     * 渲染连接详情，并说明模型由对话页按供应商协议实时发现。
     * @returns 只读详情节点；缺少连接时返回提示。
     */
    function renderDetail() {
      const config = current.value;
      if (!config) return <AAlert showIcon title="连接详情不存在" />;
      let credentialLabel = '未配置';
      if (config.hasApiKey) credentialLabel = '已配置';
      return (
        <div class="grid gap-4 text-sm">
          <DetailRow label="配置名称" value={config.name} />
          <DetailRow label="供应商" value={config.providerLabel} />
          <DetailRow label="连接端点" value={config.baseUrl} />
          <DetailRow label="凭据状态" value={credentialLabel} />
          <AAlert
            showIcon
            title="模型将在进入对话页时按供应商协议实时获取"
            type="info"
          />
        </div>
      );
    }

    expose({ openCreate, openEdit, openView } satisfies LlmConfigDrawerExposed);

    return () => {
      let content: VNodeChild = <ConfigForm />;
      if (mode.value === 'view') content = renderDetail();
      let footer: VNodeChild = (
        <ASpace>
          <AButton onClick={() => (open.value = false)}>取消</AButton>
          <AButton
            loading={saving.value}
            onClick={() => void submit()}
            type="primary"
          >
            保存
          </AButton>
        </ASpace>
      );
      if (mode.value === 'view') {
        footer = <AButton onClick={() => (open.value = false)}>关闭</AButton>;
      }
      return (
        <ADrawer
          destroyOnHidden
          mask={{ closable: !saving.value }}
          onClose={() => {
            if (!saving.value) open.value = false;
          }}
          open={open.value}
          size="large"
          title={title.value}
          v-slots={{
            footer: () => <div class="flex justify-end">{footer}</div>,
          }}
        >
          {content}
        </ADrawer>
      );
    };
  },
});

/**
 * 把长端点或名称约束在可换行的只读事实布局中。
 * @param props - 同时包含详情标签和脱敏展示值的只读字段。
 * @param props.label - 左侧显示的事实名称。
 * @param props.value - 右侧显示且允许换行的脱敏值。
 * @returns 左标签右值的详情行。
 */
function DetailRow(props: { label: string; value: string }) {
  return (
    <div class="grid gap-1">
      <span class="text-muted-foreground">{props.label}</span>
      <span class="break-all">{props.value}</span>
    </div>
  );
}

/**
 * 创建新增配置默认值，优先采用供应商目录第一项。
 * @param providers - 当前可用供应商目录。
 * @returns 空名称、默认端点和启用状态的表单值。
 */
function createDefaults(
  providers: LlmApi.ProviderCatalogItem[],
): ConfigFormValues {
  const provider = providers[0];
  let providerKey: LlmApi.Provider = 'openai';
  let baseUrl = 'https://api.openai.com/v1';
  if (provider) {
    providerKey = provider.provider;
    baseUrl = provider.defaultBaseUrl;
  }
  return {
    apiKey: '',
    baseUrl,
    enabled: true,
    isDefault: false,
    name: '',
    provider: providerKey,
  };
}

/**
 * 将脱敏连接详情投影为编辑表单值，API Key 固定为空。
 * @param config - 当前连接详情。
 * @returns 可写入 Vben Form 的完整值。
 */
function configToForm(config: LlmApi.Config): ConfigFormValues {
  return {
    apiKey: '',
    baseUrl: config.baseUrl,
    enabled: config.enabled,
    isDefault: config.isDefault,
    name: config.name,
    provider: config.provider,
  };
}

/**
 * 表单提交仅含连接元数据与可选密钥，并在跨边界前裁剪名称和端点。
 * @param values - 已通过表单校验的连接值。
 * @returns 大模型连接创建或更新输入。
 */
function toInput(values: ConfigFormValues): LlmApi.ConfigInput {
  return {
    apiKey: values.apiKey,
    baseUrl: values.baseUrl.trim(),
    enabled: !!values.enabled,
    isDefault: !!values.isDefault,
    name: values.name.trim(),
    provider: values.provider,
  };
}
