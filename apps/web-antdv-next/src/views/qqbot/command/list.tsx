import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/ktTable';

import { computed, defineComponent, onMounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createQqbotCommand,
  deleteQqbotCommand,
  getQqbotCommandList,
  getQqbotPluginList,
  getQqbotPluginOperationList,
  testQqbotCommand,
  toggleQqbotCommand,
  updateQqbotCommand,
} from '#/api/qqbot';
import { KtTable, useKtTable } from '#/components/ktTable';

import {
  getOptionLabel,
  qqbotCommandParserOptions,
  qqbotRuleTargetOptions,
} from '../modules/options';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'QqBotCommandList',
  setup() {
    const editingId = ref<string>();
    const pluginOptions = ref<Array<{ label: string; value: string }>>([]);
    const pluginOperations = ref<QqbotApi.PluginOperation[]>([]);
    const pluginMetadataLoaded = ref(false);
    const selectedPluginKey = ref('');
    const testResult = ref<QqbotApi.CommandTestResult>();
    let pluginMetadataPromise: Promise<void> | undefined;
    let isRestoringCommandForm = false;

    const operationOptions = computed(() =>
      pluginOperations.value
        .filter((item) => item.pluginKey === selectedPluginKey.value)
        .map((item) => ({
          label: `${item.name} (${item.key})`,
          value: item.key,
        })),
    );
    const modalTitle = computed(() =>
      editingId.value ? '编辑命令' : '新建命令',
    );

    const [CommandForm, commandFormApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      handleValuesChange(values, fieldsChanged) {
        if (fieldsChanged.includes('pluginKey')) {
          selectedPluginKey.value = values.pluginKey || '';
          if (!isRestoringCommandForm) {
            void commandFormApi.setFieldValue('operationKey', undefined);
          }
        }
      },
      layout: 'horizontal',
      schema: [
        {
          component: 'Input',
          componentProps: { placeholder: '如 ff14_price' },
          fieldName: 'code',
          label: '命令编码',
          rules: 'required',
        },
        {
          component: 'Input',
          fieldName: 'name',
          label: '命令名称',
          rules: 'required',
        },
        {
          component: 'Textarea',
          componentProps: {
            autoSize: { maxRows: 3, minRows: 2 },
            placeholder: '逗号分隔，如 查价,price,ff14price',
          },
          fieldName: 'aliases',
          label: '命令别名',
        },
        {
          component: 'Input',
          componentProps: {
            placeholder: '逗号分隔，如 /,!,！',
          },
          fieldName: 'prefixes',
          label: '命令前缀',
        },
        {
          component: 'Select',
          componentProps: () => ({
            options: pluginOptions.value,
          }),
          fieldName: 'pluginKey',
          label: '插件',
          rules: 'selectRequired',
        },
        {
          component: 'Select',
          componentProps: () => ({
            options: operationOptions.value,
          }),
          fieldName: 'operationKey',
          label: '插件能力',
          rules: 'selectRequired',
        },
        {
          component: 'Select',
          componentProps: {
            options: qqbotCommandParserOptions,
          },
          fieldName: 'parserKey',
          label: '解析器',
        },
        {
          component: 'Select',
          componentProps: {
            options: qqbotRuleTargetOptions,
          },
          fieldName: 'targetType',
          label: '目标范围',
        },
        {
          component: 'Textarea',
          componentProps: {
            autoSize: { maxRows: 8, minRows: 4 },
            placeholder: '{\n  "world": "中国",\n  "language": "zh"\n}',
          },
          fieldName: 'defaultParams',
          label: '默认参数',
        },
        {
          component: 'Textarea',
          componentProps: {
            autoSize: { maxRows: 5, minRows: 3 },
            placeholder:
              '留空时使用插件返回的 replyText；可用 {{output.xxx}} / {{input.xxx}}',
          },
          fieldName: 'replyTemplate',
          label: '回复模板',
        },
        {
          component: 'Textarea',
          componentProps: {
            autoSize: { maxRows: 4, minRows: 2 },
            placeholder: '如 FF14 查价失败：{{error}}',
          },
          fieldName: 'errorTemplate',
          label: '错误模板',
        },
        {
          component: 'InputNumber',
          fieldName: 'priority',
          label: '优先级',
        },
        {
          component: 'InputNumber',
          componentProps: { min: 0 },
          fieldName: 'cooldownMs',
          label: '冷却时间',
          suffix: () => 'ms',
        },
        {
          component: 'Switch',
          fieldName: 'enabled',
          label: '启用',
        },
        {
          component: 'Input',
          fieldName: 'remark',
          label: '备注',
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });

    const [TestForm, testFormApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      layout: 'horizontal',
      schema: [
        {
          component: 'Input',
          componentProps: {
            placeholder: '如 /查价 魔匠药酒 莫古力 hq',
          },
          fieldName: 'text',
          label: '测试消息',
          rules: 'required',
        },
        {
          component: 'Select',
          componentProps: {
            options: [
              { label: '私聊', value: 'private' },
              { label: '群聊', value: 'group' },
              { label: '频道', value: 'channel' },
            ],
          },
          fieldName: 'targetType',
          label: '消息类型',
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });

    const columns: Array<TableColumnType<QqbotApi.Command>> = [
      { dataIndex: 'code', key: 'code', title: '命令编码', width: 150 },
      { dataIndex: 'name', key: 'name', title: '命令名称', width: 150 },
      { dataIndex: 'aliases', key: 'aliases', title: '别名', width: 220 },
      { dataIndex: 'pluginKey', key: 'pluginKey', title: '插件', width: 140 },
      {
        dataIndex: 'operationKey',
        key: 'operationKey',
        title: '能力',
        width: 180,
      },
      {
        dataIndex: 'parserKey',
        key: 'parserKey',
        title: '解析器',
        width: 120,
      },
      {
        dataIndex: 'targetType',
        key: 'targetType',
        title: '目标范围',
        width: 120,
      },
      { dataIndex: 'enabled', key: 'enabled', title: '状态', width: 100 },
      { dataIndex: 'priority', key: 'priority', title: '优先级', width: 100 },
      {
        dataIndex: 'lastHitAt',
        key: 'lastHitAt',
        title: '最后命中',
        width: 190,
      },
    ];
    const api: KtTableApi<QqbotApi.Command> = {
      list: async (params) => await getQqbotCommandList(params),
    };
    const buttons: Array<KtTableButton<QqbotApi.Command>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: '新建命令',
        onClick: openCreate,
        permissionCodes: ['QqBot:Command:Create'],
        type: 'primary',
      },
    ];
    const rowActions: Array<KtTableRowAction<QqbotApi.Command>> = [
      {
        key: 'toggle',
        label: '启停',
        onClick: async (row, context) => {
          await toggleQqbotCommand(row.id, !row.enabled);
          message.success(row.enabled ? '命令已停用' : '命令已启用');
          await context.reload();
        },
        permissionCodes: ['QqBot:Command:Toggle'],
      },
      {
        key: 'test',
        label: '测试',
        onClick: openTest,
        permissionCodes: ['QqBot:Command:Test'],
      },
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        permissionCodes: ['QqBot:Command:Edit'],
      },
      {
        confirm: (row) => `确认删除命令「${row.name || row.code}」吗？`,
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: async (row, context) => {
          await deleteQqbotCommand(row.id);
          message.success('命令删除成功');
          await context.reload();
        },
        permissionCodes: ['QqBot:Command:Delete'],
      },
    ];
    const [registerTable, tableApi] = useKtTable<QqbotApi.Command>({
      api,
      buttons,
      columns,
      formOptions: {
        schema: [
          {
            component: 'Input',
            componentProps: {
              allowClear: true,
              placeholder: '命令编码/名称/别名',
            },
            fieldName: 'keyword',
            label: '关键词',
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
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: qqbotRuleTargetOptions,
            },
            fieldName: 'targetType',
            label: '目标范围',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: [
                { label: '启用', value: true },
                { label: '停用', value: false },
              ],
            },
            fieldName: 'enabled',
            label: '状态',
          },
        ],
      },
      rowActions,
      tableTitle: '在线命令',
    });

    const [CommandModal, commandModalApi] = useVbenModal({
      class: 'w-[820px]',
      fullscreenButton: false,
      async onConfirm() {
        await submitCommand();
      },
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = commandModalApi.getData<{
          values?: QqbotApi.CommandBody;
        }>();
        void resetCommandForm(values || getCommandFormDefaults());
      },
    });
    const [TestModal, testModalApi] = useVbenModal({
      class: 'w-[680px]',
      fullscreenButton: false,
      async onConfirm() {
        await submitTest();
      },
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        testResult.value = undefined;
        const { row } = testModalApi.getData<{ row?: QqbotApi.Command }>();
        void resetTestForm(row);
      },
    });

    onMounted(() => {
      void ensurePluginMetadata();
    });

    async function loadPlugins() {
      const [plugins, operations] = await Promise.all([
        getQqbotPluginList('command'),
        getQqbotPluginOperationList(undefined, 'command'),
      ]);
      pluginOptions.value = plugins.map((item) => ({
        label: `${item.name} (${item.key})`,
        value: item.key,
      }));
      pluginOperations.value = operations;
      pluginMetadataLoaded.value = true;
    }

    async function ensurePluginMetadata() {
      if (pluginMetadataLoaded.value) {
        return;
      }
      pluginMetadataPromise ||= loadPlugins().finally(() => {
        pluginMetadataPromise = undefined;
      });
      await pluginMetadataPromise;
    }

    function getCommandFormDefaults(): QqbotApi.CommandBody {
      return {
        aliases: '',
        code: '',
        cooldownMs: 1500,
        defaultParams: '{\n  "language": "zh",\n  "world": "中国"\n}',
        enabled: true,
        errorTemplate: '命令执行失败：{{error}}',
        name: '',
        operationKey: '',
        parserKey: 'plain',
        pluginKey: '',
        prefixes: '/,!,！',
        priority: 0,
        replyTemplate: '',
        targetType: 'all',
      };
    }

    async function resetCommandForm(values: QqbotApi.CommandBody) {
      await ensurePluginMetadata();
      isRestoringCommandForm = true;
      selectedPluginKey.value = values.pluginKey || '';
      try {
        await commandFormApi.resetForm();
        await commandFormApi.setValues({
          ...values,
          aliases: normalizeListText(values.aliases),
          defaultParams: normalizeJsonText(values.defaultParams),
          prefixes: normalizeListText(values.prefixes),
        });
        await commandFormApi.resetValidate();
      } finally {
        isRestoringCommandForm = false;
      }
    }

    async function resetTestForm(row?: QqbotApi.Command) {
      await testFormApi.resetForm();
      await testFormApi.setValues({
        targetType: 'private',
        text: row?.aliases?.[0] ? `/${row.aliases[0]} ` : '',
      });
      await testFormApi.resetValidate();
    }

    function openCreate() {
      editingId.value = undefined;
      commandModalApi.setData({ values: getCommandFormDefaults() }).open();
    }

    function openEdit(row: QqbotApi.Command) {
      editingId.value = row.id;
      commandModalApi.setData({ values: { ...row } }).open();
    }

    function openTest(row: QqbotApi.Command) {
      testModalApi.setData({ row }).open();
    }

    async function submitCommand() {
      const { valid } = await commandFormApi.validate();
      if (!valid) return;

      const values = await commandFormApi.getValues<QqbotApi.CommandBody>();
      const payload = normalizeCommandPayload(values);
      commandModalApi.lock();
      try {
        await (editingId.value
          ? updateQqbotCommand({ ...payload, id: editingId.value })
          : createQqbotCommand(payload));
        message.success('命令保存成功');
        await commandModalApi.close();
        await tableApi.reload();
      } finally {
        commandModalApi.unlock();
      }
    }

    async function submitTest() {
      const { valid } = await testFormApi.validate();
      if (!valid) return;
      const values = await testFormApi.getValues<{
        targetType: 'channel' | 'group' | 'private';
        text: string;
      }>();
      const { row } = testModalApi.getData<{ row?: QqbotApi.Command }>();
      testModalApi.lock();
      try {
        testResult.value = await testQqbotCommand({
          commandId: row?.id,
          targetType: values.targetType || 'private',
          text: values.text,
        });
      } finally {
        testModalApi.unlock();
      }
    }

    function normalizeCommandPayload(
      values: QqbotApi.CommandBody,
    ): QqbotApi.CommandBody {
      return {
        ...values,
        aliases: normalizeList(values.aliases),
        code: values.code.trim(),
        cooldownMs: values.cooldownMs || 0,
        defaultParams: parseJsonText(values.defaultParams),
        name: values.name.trim(),
        prefixes: normalizeList(values.prefixes),
        priority: values.priority || 0,
      };
    }

    function normalizeList(value?: string | string[]) {
      if (Array.isArray(value)) return value;
      return `${value || ''}`
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    function normalizeListText(value?: string | string[]) {
      return Array.isArray(value) ? value.join(',') : value || '';
    }

    function normalizeJsonText(value?: Record<string, any> | string) {
      if (!value) return '';
      return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    }

    function parseJsonText(value?: Record<string, any> | string) {
      if (!value || typeof value !== 'string') return value || {};
      const source = value.trim();
      if (!source) return {};
      try {
        return JSON.parse(source);
      } catch {
        message.warning('默认参数必须是合法 JSON');
        throw new Error('默认参数必须是合法 JSON');
      }
    }

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as QqbotApi.Command;
              if (column.key === 'enabled') {
                return (
                  <Tag color={row.enabled ? 'success' : 'default'}>
                    {row.enabled ? '启用' : '停用'}
                  </Tag>
                );
              }
              if (column.key === 'aliases') {
                return row.aliases?.join(' / ') || '-';
              }
              if (column.key === 'parserKey') {
                return getOptionLabel(qqbotCommandParserOptions, row.parserKey);
              }
              if (column.key === 'targetType') {
                return getOptionLabel(qqbotRuleTargetOptions, row.targetType);
              }
              return undefined;
            },
          }}
        />
        <CommandModal title={modalTitle.value}>
          <CommandForm class="mx-2" />
        </CommandModal>
        <TestModal title="测试命令">
          <div class="mx-2">
            <TestForm />
            {testResult.value ? (
              <div class="mt-4 rounded border border-border p-3 text-sm">
                <div>
                  匹配结果：{testResult.value.matched ? '已匹配' : '未匹配'}
                </div>
                {testResult.value.replyText ? (
                  <pre class="mt-2 whitespace-pre-wrap">
                    {testResult.value.replyText}
                  </pre>
                ) : null}
                {testResult.value.message ? (
                  <div class="mt-2 text-warning">
                    {testResult.value.message}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </TestModal>
      </Page>
    );
  },
});
