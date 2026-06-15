import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type { QqbotPluginPlatformApi } from '#/api/qqbot/plugin';
import type { KtTableApi, KtTableButton } from '#/components/ktTable';
import type { DictOption } from '#/hooks/useDict';

import { computed, defineComponent, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Drawer, message, Modal, Tag } from 'antdv-next';

import {
  getQqbotPluginHealth,
  getQqbotPluginList,
  getQqbotPluginOperationPage,
} from '#/api/qqbot';
import {
  disableQqbotPluginInstallation,
  enableQqbotPluginInstallation,
  getQqbotPluginAccountBindings,
  getQqbotPluginPlatformInstallations,
  getQqbotPluginRuntimeEvents,
  installLocalQqbotPluginPackage,
  uninstallQqbotPluginInstallation,
  uploadQqbotPluginPackage,
  validateQqbotPluginManifest,
} from '#/api/qqbot/plugin';
import { KtTable, useKtTable } from '#/components/ktTable';
import { useDict } from '#/hooks/useDict';

import { renderQqbotActions } from '../modules/actions';
import { getQqbotStatusColor, getQqbotStatusLabel } from '../modules/status';

const ADrawer = Drawer as any;
const AModal = Modal as any;
const AKtTable = KtTable as any;
const QQBOT_PLUGIN_TRIGGER_MODE_DICT = 'QQBOT_PLUGIN_TRIGGER_MODE';
const qqbotPluginTriggerModeFallback: Array<
  DictOption<QqbotApi.PluginTriggerMode>
> = [
  { label: '命令', value: 'command' },
  { label: '事件', value: 'event' },
];
const defaultManifest = {
  assets: [],
  configSchema: { type: 'object' },
  entry: 'src/index.ts',
  events: [],
  minApiSdkVersion: '1.0.0',
  name: 'Demo Plugin',
  operations: [
    {
      handlerName: 'echo',
      key: 'demo-plugin.echo',
      name: 'Echo',
      permissions: ['qqbot.send'],
      timeoutMs: 3000,
    },
  ],
  permissions: ['qqbot.send'],
  pluginKey: 'demo-plugin',
  runtime: {
    maxConcurrency: 1,
    memoryMb: 128,
    timeoutMs: 5000,
    workerType: 'node-worker',
  },
  version: '0.1.0',
};

export default defineComponent({
  name: 'QqBotPluginList',
  setup() {
    const accountBindings = ref<QqbotPluginPlatformApi.AccountBinding[]>([]);
    const drawerMode = ref<'bindings' | 'events' | 'installations'>(
      'installations',
    );
    const drawerOpen = ref(false);
    const installations = ref<QqbotPluginPlatformApi.Installation[]>([]);
    const manifestMode = ref<'install' | 'upload' | 'validate'>('validate');
    const manifestModalOpen = ref(false);
    const manifestText = ref(JSON.stringify(defaultManifest, null, 2));
    const pluginOptions = ref<Array<{ label: string; value: string }>>([]);
    const pluginMap = ref<Record<string, QqbotApi.Plugin>>({});
    const platformLoading = ref(false);
    const runtimeEvents = ref<QqbotPluginPlatformApi.RuntimeEvent[]>([]);
    const drawerTitle = computed(() => {
      if (drawerMode.value === 'events') return '插件运行事件';
      if (drawerMode.value === 'bindings') return '插件账号绑定';
      return '插件安装记录';
    });
    const manifestModalTitle = computed(() => {
      if (manifestMode.value === 'install') return '安装插件 Manifest';
      if (manifestMode.value === 'upload') return '上传插件 Manifest';
      return '校验插件 Manifest';
    });
    const {
      labelOf: getTriggerModeLabel,
      options: triggerModeOptions,
      reload: reloadTriggerModeDict,
    } = useDict<QqbotApi.PluginTriggerMode>(QQBOT_PLUGIN_TRIGGER_MODE_DICT, {
      fallbackOptions: qqbotPluginTriggerModeFallback,
      immediate: false,
    });

    const columns: Array<TableColumnType<QqbotApi.PluginOperation>> = [
      { dataIndex: 'pluginKey', key: 'pluginKey', title: '插件', width: 160 },
      {
        dataIndex: 'triggerMode',
        key: 'triggerMode',
        title: '触发方式',
        width: 120,
      },
      { dataIndex: 'key', key: 'key', title: '能力 Key', width: 220 },
      { dataIndex: 'name', key: 'name', title: '能力名称', width: 160 },
      {
        dataIndex: 'description',
        key: 'description',
        title: '说明',
        width: 360,
      },
      {
        dataIndex: 'cacheTtlMs',
        key: 'cacheTtlMs',
        title: '建议缓存',
        width: 120,
      },
    ];
    const api: KtTableApi<QqbotApi.PluginOperation> = {
      list: async (params) => await getQqbotPluginOperationPage(params),
    };
    const buttons: Array<KtTableButton<QqbotApi.PluginOperation>> = [
      {
        key: 'manifestValidate',
        label: '校验 Manifest',
        onClick: () => openManifestModal('validate'),
      },
      {
        key: 'manifestUpload',
        label: '上传插件',
        onClick: () => openManifestModal('upload'),
      },
      {
        key: 'manifestInstall',
        label: '本地安装',
        onClick: () => openManifestModal('install'),
      },
      {
        key: 'installations',
        label: '安装记录',
        onClick: () => void loadInstallations(),
      },
      {
        key: 'runtimeEvents',
        label: '运行事件',
        onClick: () => void loadRuntimeEvents(),
      },
      {
        key: 'accountBindings',
        label: '账号绑定',
        onClick: () => void loadAccountBindings(),
      },
      {
        key: 'health',
        label: '健康检查',
        onClick: async () => {
          const health = await getQqbotPluginHealth();
          const content = health
            .map(
              (item) =>
                `${getTriggerModeLabel(item.triggerMode, '-')} ${item.name || item.pluginKey || ''}: ${item.status}${item.message ? ` ${item.message}` : ''}`,
            )
            .join('；');
          message.success(content || '插件健康检查完成');
        },
      },
    ];
    const [registerTable] = useKtTable<QqbotApi.PluginOperation>({
      api,
      buttons,
      columns,
      formOptions: {
        schema: [
          {
            component: 'Select',
            componentProps: () => ({
              allowClear: true,
              options: triggerModeOptions.value,
            }),
            fieldName: 'triggerMode',
            label: '触发方式',
          },
          {
            component: 'Select',
            componentProps: () => ({
              allowClear: true,
              options: pluginOptions.value,
            }),
            fieldName: 'pluginKey',
            label: '插件',
          },
        ],
      },
      showSelection: false,
      tableTitle: '插件能力',
    });

    onMounted(() => {
      void loadMetadata();
    });

    async function loadMetadata() {
      const [plugins] = await Promise.all([
        getQqbotPluginList(),
        reloadTriggerModeDict(),
      ]);
      const nextPluginMap: Record<string, QqbotApi.Plugin> = {};
      for (const item of plugins) {
        nextPluginMap[item.key] = item;
      }
      pluginMap.value = nextPluginMap;
      pluginOptions.value = plugins.map((item) => ({
        label: `${item.name} (${item.key} / ${getTriggerModeLabel(item.triggerMode, '-')})`,
        value: item.key,
      }));
    }

    function openManifestModal(mode: typeof manifestMode.value) {
      manifestMode.value = mode;
      manifestText.value = JSON.stringify(defaultManifest, null, 2);
      manifestModalOpen.value = true;
    }

    function parseManifestText() {
      try {
        return JSON.parse(manifestText.value);
      } catch {
        message.error('Manifest JSON 格式不正确');
        return undefined;
      }
    }

    async function submitManifest() {
      const manifest = parseManifestText();
      if (!manifest) return;

      platformLoading.value = true;
      try {
        if (manifestMode.value === 'upload') {
          await uploadQqbotPluginPackage({ manifest });
          message.success('插件包上传校验通过');
        } else if (manifestMode.value === 'install') {
          await installLocalQqbotPluginPackage({ manifest });
          message.success('插件已安装');
          await loadInstallations(false);
        } else {
          await validateQqbotPluginManifest(manifest);
          message.success('Manifest 校验通过');
        }
        manifestModalOpen.value = false;
      } finally {
        platformLoading.value = false;
      }
    }

    async function loadInstallations(openDrawer = true) {
      installations.value = await getQqbotPluginPlatformInstallations();
      drawerMode.value = 'installations';
      drawerOpen.value = openDrawer || drawerOpen.value;
    }

    async function loadRuntimeEvents() {
      runtimeEvents.value = await getQqbotPluginRuntimeEvents();
      drawerMode.value = 'events';
      drawerOpen.value = true;
    }

    async function loadAccountBindings() {
      accountBindings.value = await getQqbotPluginAccountBindings();
      drawerMode.value = 'bindings';
      drawerOpen.value = true;
    }

    async function updateInstallationStatus(
      row: QqbotPluginPlatformApi.Installation,
      action: 'disable' | 'enable' | 'uninstall',
    ) {
      if (action === 'enable') {
        await enableQqbotPluginInstallation(row.id);
        message.success('插件已启用');
      } else if (action === 'disable') {
        await disableQqbotPluginInstallation(row.id);
        message.success('插件已禁用');
      } else {
        await uninstallQqbotPluginInstallation(row.id);
        message.success('插件已卸载');
      }
      await loadInstallations(false);
    }

    const renderStatusTag = (status?: string) => {
      if (!status) return <Tag color="default">-</Tag>;
      const color =
        status === 'uninstalled' ? 'error' : getQqbotStatusColor(status);
      return <Tag color={color}>{getQqbotStatusLabel(status)}</Tag>;
    };

    const renderDrawerContent = () => {
      if (drawerMode.value === 'events') {
        return runtimeEvents.value.length > 0 ? (
          <div class="space-y-3">
            {runtimeEvents.value.map((item) => (
              <div
                class="border-b border-solid border-gray-100 pb-3"
                key={item.id}
              >
                <div>
                  <Tag color={item.level === 'error' ? 'error' : 'processing'}>
                    {item.level}
                  </Tag>
                  <span>{item.eventType}</span>
                </div>
                <pre class="mt-2 whitespace-pre-wrap text-xs">
                  {JSON.stringify(item.safeSummary || {}, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <span>暂无运行事件</span>
        );
      }

      if (drawerMode.value === 'bindings') {
        return accountBindings.value.length > 0 ? (
          <div class="space-y-3">
            {accountBindings.value.map((item) => (
              <div
                class="border-b border-solid border-gray-100 pb-3"
                key={item.id}
              >
                {renderStatusTag(item.enabled ? 'enabled' : 'disabled')}
                <span>
                  插件 {item.pluginId} / 账号 {item.accountId}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span>暂无账号绑定</span>
        );
      }

      return installations.value.length > 0 ? (
        <div class="space-y-3">
          {installations.value.map((item) => (
            <div
              class="border-b border-solid border-gray-100 pb-3"
              key={item.id}
            >
              <div class="mb-2 flex items-center gap-2">
                {renderStatusTag(item.status)}
                <Tag>{item.runtimeStatus || '-'}</Tag>
                <span>
                  插件 {item.pluginId} / 版本 {item.versionId}
                </span>
              </div>
              {renderQqbotActions([
                {
                  disabled: item.status === 'enabled',
                  key: 'enable',
                  label: '启用',
                  onClick: () => updateInstallationStatus(item, 'enable'),
                },
                {
                  disabled: item.status === 'disabled',
                  key: 'disable',
                  label: '禁用',
                  onClick: () => updateInstallationStatus(item, 'disable'),
                },
                {
                  danger: true,
                  key: 'uninstall',
                  label: '卸载',
                  onClick: () => updateInstallationStatus(item, 'uninstall'),
                },
              ])}
            </div>
          ))}
        </div>
      ) : (
        <span>暂无安装记录</span>
      );
    };

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as QqbotApi.PluginOperation;
              if (column.key === 'pluginKey') {
                const plugin = pluginMap.value[row.pluginKey];
                return plugin ? (
                  <Tag color="processing">
                    {plugin.name} v{plugin.version}
                  </Tag>
                ) : (
                  row.pluginKey
                );
              }
              if (column.key === 'triggerMode') {
                return (
                  <Tag color={row.triggerMode === 'event' ? 'warning' : 'blue'}>
                    {getTriggerModeLabel(row.triggerMode, '-')}
                  </Tag>
                );
              }
              if (column.key === 'cacheTtlMs') {
                return row.cacheTtlMs ? `${row.cacheTtlMs} ms` : '-';
              }
              return undefined;
            },
          }}
        />
        <AModal
          confirmLoading={platformLoading.value}
          onCancel={() => {
            manifestModalOpen.value = false;
          }}
          onOk={() => void submitManifest()}
          open={manifestModalOpen.value}
          title={manifestModalTitle.value}
          width={760}
        >
          <textarea
            class="w-full resize-y rounded border border-solid border-gray-200 p-3 font-mono text-sm outline-none"
            onInput={(event) => {
              manifestText.value = (event.target as HTMLTextAreaElement).value;
            }}
            rows={18}
            value={manifestText.value}
          />
        </AModal>
        <ADrawer
          onClose={() => {
            drawerOpen.value = false;
          }}
          open={drawerOpen.value}
          title={drawerTitle.value}
          width={760}
        >
          {renderDrawerContent()}
        </ADrawer>
      </Page>
    );
  },
});
