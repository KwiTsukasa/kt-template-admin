import type { TableColumnType } from 'antdv-next';

import type { QqbotApi } from '#/api/qqbot';
import type {
  KtTableApi,
  KtTableButton,
  KtTableRowAction,
} from '#/components/ktTable';

import { computed, defineComponent, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Switch,
  Tag,
  TextArea,
} from 'antdv-next';

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

const AKtTable = KtTable as any;
const AInput = Input as any;
const AInputNumber = InputNumber as any;
const AModal = Modal as any;
const ASelect = Select as any;
const ASwitch = Switch as any;
const ATextArea = TextArea as any;

export default defineComponent({
  name: 'QqBotRuleList',
  setup() {
    const saving = ref(false);
    const modalOpen = ref(false);
    const editingId = ref<string>();
    const form = reactive<QqbotApi.RuleBody>({
      cooldownMs: 1500,
      enabled: true,
      keyword: '',
      matchType: 'keyword',
      name: '',
      priority: 0,
      replyContent: '',
      targetType: 'all',
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

    function openCreate() {
      editingId.value = undefined;
      Object.assign(form, {
        cooldownMs: 1500,
        enabled: true,
        keyword: '',
        matchType: 'keyword',
        name: '',
        priority: 0,
        replyContent: '',
        targetType: 'all',
      });
      modalOpen.value = true;
    }

    function openEdit(row: QqbotApi.Rule) {
      editingId.value = row.id;
      Object.assign(form, { ...row });
      modalOpen.value = true;
    }

    async function submitRule() {
      if (!form.keyword.trim() || !form.replyContent.trim()) {
        message.warning('请填写关键词和回复内容');
        return;
      }

      saving.value = true;
      try {
        await (editingId.value
          ? updateQqbotRule({ ...form, id: editingId.value })
          : createQqbotRule(form));
        message.success('规则保存成功');
        modalOpen.value = false;
        await tableApi.reload();
      } finally {
        saving.value = false;
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
                return (
                  <Tag color={row.enabled ? 'success' : 'default'}>
                    {row.enabled ? '启用' : '停用'}
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
        <AModal
          confirmLoading={saving.value}
          onOk={submitRule}
          {...{
            'onUpdate:open': (value: boolean) => {
              modalOpen.value = value;
            },
          }}
          open={modalOpen.value}
          title={modalTitle.value}
          width="720px"
        >
          <Form labelCol={{ span: 5 }} model={form} wrapperCol={{ span: 18 }}>
            <FormItem label="规则名称">
              <AInput
                {...{
                  'onUpdate:value': (value: string) => {
                    form.name = value;
                  },
                }}
                value={form.name}
              />
            </FormItem>
            <FormItem label="匹配方式" required>
              <ASelect
                {...{
                  'onUpdate:value': (value: QqbotApi.RuleBody['matchType']) => {
                    form.matchType = value;
                  },
                }}
                options={qqbotRuleMatchOptions}
                value={form.matchType}
              />
            </FormItem>
            <FormItem label="关键词" required>
              <AInput
                {...{
                  'onUpdate:value': (value: string) => {
                    form.keyword = value;
                  },
                }}
                value={form.keyword}
              />
            </FormItem>
            <FormItem label="目标范围">
              <ASelect
                {...{
                  'onUpdate:value': (
                    value: QqbotApi.RuleBody['targetType'],
                  ) => {
                    form.targetType = value;
                  },
                }}
                options={qqbotRuleTargetOptions}
                value={form.targetType}
              />
            </FormItem>
            <FormItem label="回复内容" required>
              <ATextArea
                autoSize={{ maxRows: 6, minRows: 3 }}
                {...{
                  'onUpdate:value': (value: string) => {
                    form.replyContent = value;
                  },
                }}
                value={form.replyContent}
              />
            </FormItem>
            <FormItem label="优先级">
              <AInputNumber
                {...{
                  'onUpdate:value': (value: number) => {
                    form.priority = value || 0;
                  },
                }}
                value={form.priority}
              />
            </FormItem>
            <FormItem label="冷却时间">
              <AInputNumber
                addonAfter="ms"
                min={0}
                {...{
                  'onUpdate:value': (value: number) => {
                    form.cooldownMs = value || 0;
                  },
                }}
                value={form.cooldownMs}
              />
            </FormItem>
            <FormItem label="启用">
              <ASwitch
                checked={form.enabled}
                {...{
                  'onUpdate:checked': (value: boolean) => {
                    form.enabled = value;
                  },
                }}
              />
            </FormItem>
          </Form>
        </AModal>
      </Page>
    );
  },
});
