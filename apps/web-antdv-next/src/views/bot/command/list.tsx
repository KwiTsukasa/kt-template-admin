import type { TableColumnType } from 'antdv-next';

import type { BotApi } from '#/api/bot';
import type { PluginPlatformApi } from '#/api/plugin-platform/plugin';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/kt-table';

import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
} from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Alert, Button, message, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createBotCommand,
  deleteBotCommand,
  getBotCommandList,
  testBotCommand,
  toggleBotCommand,
  updateBotCommand,
} from '#/api/bot';
import {
  getPluginList,
  getPluginOperationList,
} from '#/api/plugin-platform/plugin';
import { KtTable, useKtTable } from '#/components/kt-table';
import { useModalSessionIntent } from '#/hooks/useModalSessionIntent';

import {
  botCommandParserOptions,
  botRuleTargetOptions,
  getOptionLabel,
} from '../modules/options';
import { getBotStatusColor, getBotStatusLabel } from '../modules/status';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'BotCommandList',
  setup() {
    const editingId = ref<string>();
    const commandSession = useModalSessionIntent();
    const testSession = useModalSessionIntent();
    const commandPreparing = ref(false);
    const metadataError = ref(false);
    const commandFormClass = computed(() => {
      if (metadataError.value) return 'pointer-events-none mx-2 opacity-50';
      return 'mx-2';
    });
    let commandLockedRevision: number | undefined;
    let testLockedRevision: number | undefined;
    let commandInitializationStarted: number | undefined;
    let testInitializationStarted: number | undefined;
    let disposed = false;
    const pluginOptions = ref<Array<{ label: string; value: string }>>([]);
    const pluginOperations = ref<PluginPlatformApi.PluginOperation[]>([]);
    const pluginMetadataLoaded = ref(false);
    const selectedPluginKey = ref('');
    const testResult = ref<BotApi.CommandTestResult>();
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
    const modalTitle = computed(() => {
      if (editingId.value) {
        return '编辑命令';
      }
      return '新建命令';
    });

    const [CommandForm, commandFormApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      /**
       * 命令插件变化时同步插件键，并在非表单恢复阶段清空旧操作键。
       *
       * @param values - 命令表单当前的插件键和操作键；插件变化后同步选择并清空旧操作。
       * @param fieldsChanged - 本次发生变化的表单字段名集合，用于只处理相关依赖字段。
       */
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
            options: botCommandParserOptions,
          },
          fieldName: 'parserKey',
          label: '解析器',
        },
        {
          component: 'Select',
          componentProps: {
            options: botRuleTargetOptions,
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

    const columns: Array<TableColumnType<BotApi.Command>> = [
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
    const api: KtTableApi<BotApi.Command> = {
      list: async (params) => await getBotCommandList(params),
    };
    const buttons: Array<KtTableButton<BotApi.Command>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: '新建命令',
        onClick: openCreate,
        permissionCodes: ['Bot:Command:Create'],
        type: 'primary',
      },
    ];
    const rowActions: Array<KtTableRowAction<BotApi.Command>> = [
      {
        key: 'toggle',
        label: '启停',
        onClick: async (row, context) => {
          await toggleBotCommand(row.id, !row.enabled);
          message.success(
            (() => {
              if (row.enabled) {
                return '命令已停用';
              }
              return '命令已启用';
            })(),
          );
          await context.reload();
        },
        permissionCodes: ['Bot:Command:Toggle'],
      },
      {
        key: 'test',
        label: '测试',
        onClick: openTest,
        permissionCodes: ['Bot:Command:Test'],
      },
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        permissionCodes: ['Bot:Command:Edit'],
      },
      {
        confirm: (row) => `确认删除命令「${row.name || row.code}」吗？`,
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: async (row, context) => {
          await deleteBotCommand(row.id);
          message.success('命令删除成功');
          await context.reload();
        },
        permissionCodes: ['Bot:Command:Delete'],
      },
    ];
    const [registerTable, tableApi] = useKtTable<BotApi.Command>({
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
              options: botRuleTargetOptions,
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
      /**
       * 确认命令编辑弹窗时校验并提交 Bot 命令配置。
       */
      async onConfirm() {
        try {
          await submitCommand();
        } catch {
          // 表单与请求层展示错误，保留当前命令字段供修正。
        }
      },
      /**
       * 仅在命令编辑弹窗打开时读取上下文值，并重置命令字段与校验状态。
       *
       * @param isOpen - 弹窗或抽屉最新显隐状态；true 表示已打开。
       */
      async onOpenChange(isOpen: boolean) {
        if (!isOpen) {
          commandSession.invalidate();
          return;
        }
        const revision = commandSession.current();
        if (!commandSession.isCurrent(revision)) return;
        const { values } = commandModalApi.getData<{
          values?: BotApi.CommandBody;
        }>();
        await initializeCommandSession(
          values || getCommandFormDefaults(),
          revision,
        );
      },
    });
    const [TestModal, testModalApi] = useVbenModal({
      class: 'w-[680px]',
      fullscreenButton: false,
      /**
       * 确认命令测试弹窗时提交账号、命令文本与目标参数，并展示服务端执行结果。
       */
      async onConfirm() {
        try {
          await submitTest();
        } catch {
          // 命令试发失败由请求层展示，当前参数和弹窗保留。
        }
      },
      /**
       * 仅在命令测试弹窗打开时清除旧结果，并用所选命令重置测试表单。
       *
       * @param isOpen - 弹窗或抽屉最新显隐状态；true 表示已打开。
       */
      async onOpenChange(isOpen: boolean) {
        if (!isOpen) {
          testSession.invalidate();
          return;
        }
        const revision = testSession.current();
        if (!testSession.isCurrent(revision)) return;
        const { row } = testModalApi.getData<{ row?: BotApi.Command }>();
        await initializeTestSession(row, revision);
      },
    });

    onMounted(() => {
      void ensurePluginMetadata().catch(() => {
        // 打开命令表单时仍可对同一元数据请求给出重试入口。
      });
    });
    onDeactivated(() => {
      commandSession.invalidate();
      testSession.invalidate();
    });
    onBeforeUnmount(() => {
      disposed = true;
      commandSession.dispose();
      testSession.dispose();
    });

    /**
     * 并行加载 Bot 命令插件与操作元数据，生成插件下拉选项并标记元数据就绪。
     */
    async function loadPlugins() {
      const [plugins, operations] = await Promise.all([
        getPluginList('command'),
        getPluginOperationList(undefined, 'command'),
      ]);
      if (disposed) return;
      pluginOptions.value = plugins.map((item) => ({
        label: `${item.name} (${item.key})`,
        value: item.key,
      }));
      pluginOperations.value = operations;
      pluginMetadataLoaded.value = true;
    }

    /**
     * 复用进行中的插件元数据请求，确保命令表单使用插件信息前完成一次加载。
     */
    async function ensurePluginMetadata() {
      if (pluginMetadataLoaded.value) {
        return;
      }
      pluginMetadataPromise ||= loadPlugins().finally(() => {
        pluginMetadataPromise = undefined;
      });
      await pluginMetadataPromise;
    }

    /**
     * 将默认前缀、解析器、冷却时间、示例参数与错误模板组合为命令表单值。
     *
     * @returns 编辑时为当前命令的可编辑字段，新建时为命令表单所需初值。
     */
    function getCommandFormDefaults(): BotApi.CommandBody {
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

    /**
     * 等待插件元数据就绪后恢复命令表单，并把别名、前缀和默认参数转成可编辑文本。
     *
     * @param values - 重置后要写入命令表单的字段，其中别名、前缀和默认参数会转为文本。
     * @param revision - 发起命令编辑初始化的会话身份。
     */
    async function resetCommandForm(
      values: BotApi.CommandBody,
      revision: number,
    ) {
      await commandSession.initialize(revision, async (stillCurrent) => {
        await ensurePluginMetadata();
        if (!stillCurrent()) return;
        isRestoringCommandForm = true;
        selectedPluginKey.value = values.pluginKey || '';
        try {
          await commandFormApi.resetForm();
          if (!stillCurrent()) return;
          await commandFormApi.setValues({
            ...values,
            aliases: normalizeListText(values.aliases),
            defaultParams: normalizeJsonText(values.defaultParams),
            prefixes: normalizeListText(values.prefixes),
          });
          if (!stillCurrent()) return;
          await commandFormApi.resetValidate();
        } finally {
          isRestoringCommandForm = false;
        }
      });
    }

    /**
     * 等待插件元数据与表单复位完成；失败保持未就绪并允许当前会话重试。
     * @param values - 本轮命令编辑的完整稳定字段。
     * @param revision - 打开命令弹窗时取得的会话身份。
     */
    async function initializeCommandSession(
      values: BotApi.CommandBody,
      revision: number,
    ) {
      if (
        !commandSession.isCurrent(revision) ||
        commandInitializationStarted === revision
      )
        return;
      commandInitializationStarted = revision;
      commandPreparing.value = true;
      metadataError.value = false;
      try {
        await resetCommandForm(values, revision);
      } catch {
        if (commandSession.isCurrent(revision)) {
          metadataError.value = true;
          commandInitializationStarted = undefined;
        }
      } finally {
        if (commandSession.isCurrent(revision)) commandPreparing.value = false;
      }
    }

    /**
     * 元数据读取失败后为当前命令会话重新尝试初始化，不复用旧会话字段。
     */
    function retryCommandInitialization() {
      const revision = commandSession.current();
      if (!commandSession.isCurrent(revision)) return;
      const { values } = commandModalApi.getData<{
        values?: BotApi.CommandBody;
      }>();
      void initializeCommandSession(
        values || getCommandFormDefaults(),
        revision,
      );
    }

    /**
     * 重置 Bot 命令测试表单，默认选择私聊并用首个命令别名预填调用文本。
     *
     * @param row - 用于预填测试命令文本的命令记录；缺省时清空命令文本。
     * @param revision - 本次试发弹窗的会话身份。
     */
    async function resetTestForm(
      row: BotApi.Command | undefined,
      revision: number,
    ) {
      await testSession.initialize(revision, async (stillCurrent) => {
        await testFormApi.resetForm();
        if (!stillCurrent()) return;
        await testFormApi.setValues({
          targetType: 'private',
          text: (() => {
            if (row?.aliases?.[0]) return `/${row.aliases[0]} `;
            return '';
          })(),
        });
        if (!stillCurrent()) return;
        await testFormApi.resetValidate();
      });
    }

    /**
     * 同轮试发只重置一次表单，切换命令时清除旧执行结果。
     * @param row - 本轮试发绑定的命令快照。
     * @param revision - 打开试发弹窗时固定的会话身份。
     */
    async function initializeTestSession(
      row: BotApi.Command | undefined,
      revision: number,
    ) {
      if (
        !testSession.isCurrent(revision) ||
        testInitializationStarted === revision
      )
        return;
      testInitializationStarted = revision;
      testResult.value = undefined;
      await resetTestForm(row, revision);
    }

    /**
     * 清除命令编辑标识，并用默认插件、前缀和参数打开新建弹窗。
     */
    function openCreate() {
      const revision = commandSession.begin();
      editingId.value = undefined;
      if (commandLockedRevision !== undefined) {
        commandModalApi.unlock();
        commandLockedRevision = undefined;
      }
      const values = getCommandFormDefaults();
      commandModalApi.setData({ values }).open();
      void nextTick(() => {
        if (commandSession.isCurrent(revision))
          void initializeCommandSession(values, revision);
      });
    }

    /**
     * 把选中命令复制到表单上下文，并以对应记录标识打开编辑弹窗。
     *
     * @param row - 要加载到命令编辑弹窗的 Bot 命令记录。
     */
    function openEdit(row: BotApi.Command) {
      const revision = commandSession.begin();
      editingId.value = row.id;
      if (commandLockedRevision !== undefined) {
        commandModalApi.unlock();
        commandLockedRevision = undefined;
      }
      const values = { ...row };
      commandModalApi.setData({ values }).open();
      void nextTick(() => {
        if (commandSession.isCurrent(revision))
          void initializeCommandSession(values, revision);
      });
    }

    /**
     * 把选中命令写入测试弹窗上下文并打开弹窗。
     *
     * @param row - 要写入测试弹窗上下文并执行试运行的 Bot 命令。
     */
    function openTest(row: BotApi.Command) {
      const revision = testSession.begin();
      if (testLockedRevision !== undefined) {
        testModalApi.unlock();
        testLockedRevision = undefined;
      }
      testResult.value = undefined;
      testModalApi.setData({ row }).open();
      void nextTick(() => {
        if (testSession.isCurrent(revision))
          void initializeTestSession(row, revision);
      });
    }

    /**
     * 固定点击时命令编辑身份并互斥确认；旧请求完成不关闭新会话。
     */
    async function submitCommand() {
      const revision = commandSession.current();
      if (!commandSession.claimConfirm(revision)) return;
      const targetId = editingId.value;
      try {
        const { valid } = await commandFormApi.validate();
        if (!commandSession.isCurrent(revision) || !valid) return;
        const values = await commandFormApi.getValues<BotApi.CommandBody>();
        if (!commandSession.isCurrent(revision)) return;
        const payload = normalizeCommandPayload(values);
        commandModalApi.lock();
        commandLockedRevision = revision;
        if (targetId) {
          await updateBotCommand({ ...payload, id: targetId });
        } else {
          await createBotCommand(payload);
        }
        if (!commandSession.isCurrent(revision)) return;
        message.success('命令保存成功');
        await commandModalApi.close();
        await tableApi.reload();
      } finally {
        if (commandLockedRevision === revision) {
          commandModalApi.unlock();
          commandLockedRevision = undefined;
        }
        commandSession.releaseConfirm(revision);
      }
    }

    /**
     * 固定试发命令 id 和完整文本，旧会话结果不得覆盖新命令测试。
     */
    async function submitTest() {
      const revision = testSession.current();
      if (!testSession.claimConfirm(revision)) return;
      const { row } = testModalApi.getData<{ row?: BotApi.Command }>();
      try {
        const { valid } = await testFormApi.validate();
        if (!testSession.isCurrent(revision) || !valid) return;
        const values = await testFormApi.getValues<{
          targetType: 'channel' | 'group' | 'private';
          text: string;
        }>();
        if (!testSession.isCurrent(revision)) return;
        testModalApi.lock();
        testLockedRevision = revision;
        const result = await testBotCommand({
          commandId: row?.id,
          targetType: values.targetType || 'private',
          text: values.text,
        });
        if (testSession.isCurrent(revision)) testResult.value = result;
      } finally {
        if (testLockedRevision === revision) {
          testModalApi.unlock();
          testLockedRevision = undefined;
        }
        testSession.releaseConfirm(revision);
      }
    }

    /**
     * 修剪命令字段、统一别名与前缀数组、解析默认参数并补齐数值默认值。
     *
     * @param values - 待规范化的命令代码、别名、前缀、默认参数、插件操作和数值配置。
     * @returns 修剪文本、规范化数组并解析默认参数后的命令提交载荷。
     */
    function normalizeCommandPayload(
      values: BotApi.CommandBody,
    ): BotApi.CommandBody {
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

    /**
     * 把逗号分隔文本转换为去空白的非空字符串数组，数组输入保持原样。
     *
     * @param value - 命令别名或前缀的数组、分隔文本或空值。
     * @returns 去除空白和空项后的字符串数组；数组与分隔文本均可作为输入。
     */
    function normalizeList(value?: string | string[]) {
      if (Array.isArray(value)) return value;
      return `${value || ''}`
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    /**
     * 把字符串数组连接为逗号文本，字符串保持原样，空值返回空字符串。
     *
     * @param value - 要回填文本框的字符串数组、标量或空值。
     * @returns 把数组连接为换行文本；非数组输入转换为字符串，空值返回空字符串。
     */
    function normalizeListText(value?: string | string[]) {
      if (Array.isArray(value)) {
        return value.join(',');
      }
      return value || '';
    }

    /**
     * 字符串 JSON 保持原样，对象按两空格缩进序列化，空值返回空字符串。
     *
     * @param value - 要显示在 JSON 文本框中的对象、字符串或空值。
     * @returns 对象格式化后的 JSON 文本或原字符串；空值返回空字符串。
     */
    function normalizeJsonText(value?: Record<string, any> | string) {
      if (!value) return '';
      if (typeof value === 'string') {
        return value;
      }
      return JSON.stringify(value, null, 2);
    }

    /**
     * 把命令默认参数 JSON 文本解析为对象，空值返回空对象，非法 JSON 抛出。
     *
     * @param value - 要解析为命令默认参数的 JSON 文本；空文本返回空对象。
     * @returns 空文本对应空对象；非空合法 JSON 对应其解析结果。
     * @throws 非空字符串无法解析为合法 JSON 时抛出。
     */
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
              const row = record as BotApi.Command;
              if (column.key === 'enabled') {
                const status = (() => {
                  if (row.enabled) {
                    return 'enabled';
                  }
                  return 'disabled';
                })();
                return (
                  <Tag color={getBotStatusColor(status)}>
                    {getBotStatusLabel(status)}
                  </Tag>
                );
              }
              if (column.key === 'aliases') {
                return row.aliases?.join(' / ') || '-';
              }
              if (column.key === 'parserKey') {
                return getOptionLabel(botCommandParserOptions, row.parserKey);
              }
              if (column.key === 'targetType') {
                return getOptionLabel(botRuleTargetOptions, row.targetType);
              }
              return undefined;
            },
          }}
        />
        <CommandModal
          confirmDisabled={!commandSession.ready.value}
          loading={commandPreparing.value}
          title={modalTitle.value}
        >
          {metadataError.value && (
            <div class="mx-2 mb-3 flex items-center gap-2">
              <Alert
                class="min-w-0 flex-1"
                showIcon
                title="插件元数据读取失败"
                type="error"
              />
              <Button onClick={retryCommandInitialization} size="small">
                重试
              </Button>
            </div>
          )}
          <CommandForm class={commandFormClass.value} />
        </CommandModal>
        <TestModal confirmDisabled={!testSession.ready.value} title="测试命令">
          <div class="mx-2">
            <TestForm />
            {(() => {
              if (testResult.value) {
                return (
                  <div class="mt-4 rounded border border-border p-3 text-sm">
                    <div>
                      匹配结果：
                      {(() => {
                        if (testResult.value.matched) {
                          return '已匹配';
                        }
                        return '未匹配';
                      })()}
                    </div>
                    {(() => {
                      if (testResult.value.replyText) {
                        return (
                          <pre class="mt-2 whitespace-pre-wrap">
                            {testResult.value.replyText}
                          </pre>
                        );
                      }
                      return null;
                    })()}
                    {(() => {
                      if (testResult.value.message) {
                        return (
                          <div class="mt-2 text-warning">
                            {testResult.value.message}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </TestModal>
      </Page>
    );
  },
});
