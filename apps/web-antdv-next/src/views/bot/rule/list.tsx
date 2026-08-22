import type { TableColumnType } from 'antdv-next';

import type { BotApi } from '#/api/bot';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/kt-table';

import { computed, defineComponent, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createBotRule,
  deleteBotRule,
  getBotRuleList,
  toggleBotRule,
  updateBotRule,
} from '#/api/bot';
import { KtTable, useKtTable } from '#/components/kt-table';

import {
  botRuleMatchOptions,
  botRuleTargetOptions,
  getOptionLabel,
} from '../modules/options';
import { getBotStatusColor, getBotStatusLabel } from '../modules/status';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'BotRuleList',
  setup() {
    const editingId = ref<string>();
    const [RuleForm, ruleFormApi] = useVbenForm({
      commonConfig: {
        labelClass: 'w-24',
      },
      layout: 'horizontal',
      schema: [
        {
          component: 'Input',
          fieldName: 'name',
          label: '规则名称',
        },
        {
          component: 'Select',
          componentProps: {
            options: botRuleMatchOptions,
          },
          fieldName: 'matchType',
          label: '匹配方式',
          rules: 'selectRequired',
        },
        {
          component: 'Input',
          fieldName: 'keyword',
          label: '关键词',
          rules: 'required',
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
            autoSize: { maxRows: 6, minRows: 3 },
          },
          fieldName: 'replyContent',
          label: '回复内容',
          rules: 'required',
        },
        {
          component: 'InputNumber',
          fieldName: 'priority',
          label: '优先级',
        },
        {
          component: 'InputNumber',
          componentProps: {
            min: 0,
          },
          fieldName: 'cooldownMs',
          label: '冷却时间',
          suffix: () => 'ms',
        },
        {
          component: 'Switch',
          fieldName: 'enabled',
          label: '启用',
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });

    const columns: Array<TableColumnType<BotApi.Rule>> = [
      { dataIndex: 'name', key: 'name', title: '规则名称', width: 180 },
      { dataIndex: 'keyword', key: 'keyword', title: '关键词', width: 220 },
      {
        dataIndex: 'matchType',
        key: 'matchType',
        title: '匹配方式',
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
    const api: KtTableApi<BotApi.Rule> = {
      list: async (params) => await getBotRuleList(params),
    };
    const buttons: Array<KtTableButton<BotApi.Rule>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: '新建规则',
        onClick: openCreate,
        permissionCodes: ['Bot:Rule:Create'],
        type: 'primary',
      },
    ];
    const rowActions: Array<KtTableRowAction<BotApi.Rule>> = [
      {
        key: 'toggle',
        label: '启停',
        onClick: async (row, context) => {
          await toggleBotRule(row.id, !row.enabled);
          message.success(
            (() => {
              if (row.enabled) {
                return '规则已停用';
              }
              return '规则已启用';
            })(),
          );
          await context.reload();
        },
        permissionCodes: ['Bot:Rule:Toggle'],
      },
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        permissionCodes: ['Bot:Rule:Edit'],
      },
      {
        confirm: (row) => `确认删除规则「${row.name || row.keyword}」吗？`,
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: async (row, context) => {
          await deleteBotRule(row.id);
          message.success('规则删除成功');
          await context.reload();
        },
        permissionCodes: ['Bot:Rule:Delete'],
      },
    ];
    const [registerTable, tableApi] = useKtTable<BotApi.Rule>({
      api,
      buttons,
      columns,
      formOptions: {
        schema: [
          {
            component: 'Input',
            componentProps: {
              allowClear: true,
              placeholder: '规则名称/关键词',
            },
            fieldName: 'keyword',
            label: '关键词',
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
      tableTitle: '自动回复规则',
    });
    const modalTitle = computed(() => {
      if (editingId.value) {
        return '编辑规则';
      }
      return '新建规则';
    });

    const [RuleModal, ruleModalApi] = useVbenModal({
      class: 'w-[720px]',
      fullscreenButton: false,
      /**
       * 确认规则弹窗时校验并提交 Bot 规则。
       */
      async onConfirm() {
        await submitRule();
      },
      /**
       * 仅在规则弹窗打开时读取上下文值，并重置规则字段与校验状态。
       *
       * @param isOpen - 弹窗或抽屉最新显隐状态；true 表示已打开。
       */
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = ruleModalApi.getData<{
          values?: BotApi.RuleBody;
        }>();
        void resetRuleForm(values || getRuleFormDefaults());
      },
    });

    /**
     * 提供 Bot 规则新建表单的固定初值，包括默认关键字匹配、全目标、启用及零优先级。
     *
     * @returns 编辑时为当前规则的可编辑字段，新建时为规则表单所需初值。
     */
    function getRuleFormDefaults(): BotApi.RuleBody {
      return {
        cooldownMs: 1500,
        enabled: true,
        keyword: '',
        matchType: 'keyword',
        name: '',
        priority: 0,
        replyContent: '',
        targetType: 'all',
      };
    }

    /**
     * 清空 Bot 规则表单后写入目标字段值，并移除上一轮校验错误。
     *
     * @param values - 重置后要写入 Bot 规则表单的完整字段。
     */
    async function resetRuleForm(values: BotApi.RuleBody) {
      await ruleFormApi.resetForm();
      await ruleFormApi.setValues(values);
      await ruleFormApi.resetValidate();
    }

    /**
     * 清除规则编辑标识，并用默认匹配条件打开新建弹窗。
     */
    function openCreate() {
      editingId.value = undefined;
      ruleModalApi.setData({ values: getRuleFormDefaults() }).open();
    }

    /**
     * 把选中 Bot 规则复制到表单上下文，并打开编辑弹窗。
     *
     * @param row - 要加载到规则编辑弹窗的自动回复规则。
     */
    function openEdit(row: BotApi.Rule) {
      editingId.value = row.id;
      ruleModalApi.setData({ values: { ...row } }).open();
    }

    /**
     * 校验并修剪 Bot 规则关键词与回复，补齐冷却和优先级后新建或更新并刷新列表。
     */
    async function submitRule() {
      const { valid } = await ruleFormApi.validate();
      if (!valid) return;

      const values = await ruleFormApi.getValues<BotApi.RuleBody>();
      const keyword = values.keyword?.trim();
      const replyContent = values.replyContent?.trim();
      if (!keyword || !replyContent) {
        message.warning('请填写关键词和回复内容');
        return;
      }

      ruleModalApi.lock();
      try {
        const payload: BotApi.RuleBody = {
          ...values,
          cooldownMs: values.cooldownMs || 0,
          keyword,
          priority: values.priority || 0,
          replyContent,
        };
        await (() => {
          if (editingId.value) {
            return updateBotRule({ ...payload, id: editingId.value });
          }
          return createBotRule(payload);
        })();
        message.success('规则保存成功');
        await ruleModalApi.close();
        await tableApi.reload();
      } finally {
        ruleModalApi.unlock();
      }
    }

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            bodyCell: ({ column, record }: any) => {
              const row = record as BotApi.Rule;
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
              if (column.key === 'matchType') {
                return getOptionLabel(botRuleMatchOptions, row.matchType);
              }
              if (column.key === 'targetType') {
                return getOptionLabel(botRuleTargetOptions, row.targetType);
              }
              return undefined;
            },
          }}
        />
        <RuleModal title={modalTitle.value}>
          <RuleForm class="mx-2" />
        </RuleModal>
      </Page>
    );
  },
});
