import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/ktTable';

import { computed, defineComponent, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import {
  createQqbotRule,
  deleteQqbotRule,
  getQqbotRuleList,
  toggleQqbotRule,
  updateQqbotRule,
} from '#/api/qqbot';
import { KtTable, useKtTable } from '#/components/ktTable';

import {
  getOptionLabel,
  qqbotRuleMatchOptions,
  qqbotRuleTargetOptions,
} from '../modules/options';
import { getQqbotStatusColor, getQqbotStatusLabel } from '../modules/status';

const AKtTable = KtTable as any;

export default defineComponent({
  name: 'QqBotRuleList',
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
            options: qqbotRuleMatchOptions,
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
            options: qqbotRuleTargetOptions,
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

    const columns: Array<TableColumnType<QqbotApi.Rule>> = [
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
    const api: KtTableApi<QqbotApi.Rule> = {
      list: async (params) => await getQqbotRuleList(params),
    };
    const buttons: Array<KtTableButton<QqbotApi.Rule>> = [
      {
        icon: <Plus class="kt-table__button-icon" />,
        key: 'create',
        label: '新建规则',
        onClick: openCreate,
        permissionCodes: ['QqBot:Rule:Create'],
        type: 'primary',
      },
    ];
    const rowActions: Array<KtTableRowAction<QqbotApi.Rule>> = [
      {
        key: 'toggle',
        label: '启停',
        onClick: async (row, context) => {
          await toggleQqbotRule(row.id, !row.enabled);
          message.success(row.enabled ? '规则已停用' : '规则已启用');
          await context.reload();
        },
        permissionCodes: ['QqBot:Rule:Toggle'],
      },
      {
        key: 'edit',
        label: '编辑',
        onClick: openEdit,
        permissionCodes: ['QqBot:Rule:Edit'],
      },
      {
        confirm: (row) => `确认删除规则「${row.name || row.keyword}」吗？`,
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: async (row, context) => {
          await deleteQqbotRule(row.id);
          message.success('规则删除成功');
          await context.reload();
        },
        permissionCodes: ['QqBot:Rule:Delete'],
      },
    ];
    const [registerTable, tableApi] = useKtTable<QqbotApi.Rule>({
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
      tableTitle: '自动回复规则',
    });
    const modalTitle = computed(() =>
      editingId.value ? '编辑规则' : '新建规则',
    );

    const [RuleModal, ruleModalApi] = useVbenModal({
      class: 'w-[720px]',
      fullscreenButton: false,
      async onConfirm() {
        await submitRule();
      },
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = ruleModalApi.getData<{
          values?: QqbotApi.RuleBody;
        }>();
        void resetRuleForm(values || getRuleFormDefaults());
      },
    });

    function getRuleFormDefaults(): QqbotApi.RuleBody {
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

    async function resetRuleForm(values: QqbotApi.RuleBody) {
      await ruleFormApi.resetForm();
      await ruleFormApi.setValues(values);
      await ruleFormApi.resetValidate();
    }

    function openCreate() {
      editingId.value = undefined;
      ruleModalApi.setData({ values: getRuleFormDefaults() }).open();
    }

    function openEdit(row: QqbotApi.Rule) {
      editingId.value = row.id;
      ruleModalApi.setData({ values: { ...row } }).open();
    }

    async function submitRule() {
      const { valid } = await ruleFormApi.validate();
      if (!valid) return;

      const values = await ruleFormApi.getValues<QqbotApi.RuleBody>();
      const keyword = values.keyword?.trim();
      const replyContent = values.replyContent?.trim();
      if (!keyword || !replyContent) {
        message.warning('请填写关键词和回复内容');
        return;
      }

      ruleModalApi.lock();
      try {
        const payload: QqbotApi.RuleBody = {
          ...values,
          cooldownMs: values.cooldownMs || 0,
          keyword,
          priority: values.priority || 0,
          replyContent,
        };
        await (editingId.value
          ? updateQqbotRule({ ...payload, id: editingId.value })
          : createQqbotRule(payload));
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
              const row = record as QqbotApi.Rule;
              if (column.key === 'enabled') {
                const status = row.enabled ? 'enabled' : 'disabled';
                return (
                  <Tag color={getQqbotStatusColor(status)}>
                    {getQqbotStatusLabel(status)}
                  </Tag>
                );
              }
              if (column.key === 'matchType') {
                return getOptionLabel(qqbotRuleMatchOptions, row.matchType);
              }
              if (column.key === 'targetType') {
                return getOptionLabel(qqbotRuleTargetOptions, row.targetType);
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
