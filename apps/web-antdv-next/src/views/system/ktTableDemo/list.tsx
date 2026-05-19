import type { TableColumnType } from 'antdv-next';

import type {
  KtTableApi,
  KtTableButton,
  KtTableHook,
  KtTableRowAction,
  KtTableStatistic,
} from '#/components/ktTable';

import { computed, defineComponent, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon, Plus, SvgDownloadIcon } from '@vben/icons';

import { message, Progress, Space, Tag } from 'antdv-next';

import {
  defineKtTableHook,
  defineKtTableModule,
  KtTable,
  useKtTable,
} from '#/components/ktTable';

import './style.scss';

const AKtTable = KtTable as any;
const AProgress = Progress as any;
const ASpace = Space as any;

type DemoLevel = 'business' | 'core' | 'template';
type DemoStatus = 'disabled' | 'draft' | 'released' | 'testing';
type DemoChannel = 'admin' | 'playground' | 'web';

type DemoRow = {
  channel: DemoChannel;
  code: string;
  coverage: number;
  description: string;
  groupName: string;
  id: number;
  level: DemoLevel;
  name: string;
  owner: string;
  status: DemoStatus;
  updatedAt: string;
  usageCount: number;
  version: string;
};

type DemoSearchValues = {
  channel?: DemoChannel;
  endDate?: string;
  keyword?: string;
  level?: DemoLevel;
  owner?: string;
  startDate?: string;
  status?: DemoStatus;
  updatedAt?: unknown;
};

const levelOptions: Array<{
  color: string;
  label: string;
  value: DemoLevel;
}> = [
  { color: 'blue', label: '核心组件', value: 'core' },
  { color: 'green', label: '业务组件', value: 'business' },
  { color: 'purple', label: '模板组件', value: 'template' },
];

const statusOptions: Array<{
  color: string;
  label: string;
  value: DemoStatus;
}> = [
  { color: 'default', label: '草稿', value: 'draft' },
  { color: 'processing', label: '测试中', value: 'testing' },
  { color: 'success', label: '已发布', value: 'released' },
  { color: 'error', label: '已停用', value: 'disabled' },
];

const channelOptions: Array<{
  color: string;
  label: string;
  value: DemoChannel;
}> = [
  { color: 'blue', label: 'Admin', value: 'admin' },
  { color: 'cyan', label: 'Web', value: 'web' },
  { color: 'gold', label: 'Playground', value: 'playground' },
];

function wait(milliseconds = 240) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function pickOption<T extends string>(
  options: Array<{ color: string; label: string; value: T }>,
  value: T,
) {
  return options.find((item) => item.value === value);
}

function readDate(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (
    typeof value === 'object' &&
    value !== null &&
    'format' in value &&
    typeof value.format === 'function'
  ) {
    return value.format('YYYY-MM-DD');
  }

  return String(value).slice(0, 10);
}

function createRows() {
  const names = [
    '权限按钮',
    '可编辑表格',
    '统计汇总',
    '远程搜索',
    '发布抽屉',
    '字典标签',
    '图表卡片',
    '文件上传',
    '权限树',
    '审计日志',
  ];
  const groups = ['系统基础', '博客运营', '组件中心', '数据看板'];
  const owners = ['Admin', '产品组', '研发组', '运营组'];
  const levels: DemoLevel[] = ['core', 'business', 'template'];
  const statuses: DemoStatus[] = ['released', 'testing', 'draft', 'disabled'];
  const channels: DemoChannel[] = ['admin', 'web', 'playground'];

  return Array.from({ length: 72 }, (_, index) => {
    const id = index + 1;
    const name = names[index % names.length] || names[0];

    return {
      channel: channels[index % channels.length] || 'admin',
      code: `KT-CMP-${String(id).padStart(4, '0')}`,
      coverage: 58 + ((index * 7) % 42),
      description: `用于${groups[index % groups.length]}的${name}能力验证`,
      groupName: groups[index % groups.length] || '系统基础',
      id,
      level: levels[index % levels.length] || 'business',
      name: `${name} ${id}`,
      owner: owners[index % owners.length] || 'Admin',
      status: statuses[index % statuses.length] || 'draft',
      updatedAt: `2026-05-${String((index % 19) + 1).padStart(2, '0')}`,
      usageCount: 20 + ((index * 13) % 260),
      version: `v${1 + (index % 3)}.${index % 10}.${index % 6}`,
    } satisfies DemoRow;
  });
}

export default defineComponent({
  name: 'SystemKtTableDemo',
  setup() {
    const rows = ref<DemoRow[]>(createRows());
    const requestTimes = ref(0);
    const actionTimes = ref(0);

    const columns: Array<TableColumnType<DemoRow>> = [
      {
        dataIndex: 'name',
        fixed: 'left',
        key: 'name',
        sorter: true,
        title: '组件名称',
        width: 260,
      },
      {
        dataIndex: 'status',
        key: 'status',
        sorter: true,
        title: '状态',
        width: 120,
      },
      {
        dataIndex: 'level',
        key: 'level',
        sorter: true,
        title: '等级',
        width: 120,
      },
      {
        dataIndex: 'owner',
        key: 'owner',
        sorter: true,
        title: '负责人',
        width: 130,
      },
      {
        dataIndex: 'coverage',
        key: 'coverage',
        sorter: true,
        title: '覆盖率',
        width: 160,
      },
      {
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        sorter: true,
        title: '更新时间',
        width: 150,
      },
    ];

    const api: KtTableApi<DemoRow, DemoSearchValues> = {
      list: async (params) => {
        await wait();

        let list = [...rows.value];
        const keyword = params.keyword?.trim();
        const startDate = readDate(params.startDate);
        const endDate = readDate(params.endDate);

        if (keyword) {
          list = list.filter((item) =>
            [item.code, item.name, item.description, item.groupName]
              .join(' ')
              .includes(keyword),
          );
        }
        if (params.owner) {
          list = list.filter((item) => item.owner.includes(params.owner || ''));
        }
        if (params.status) {
          list = list.filter((item) => item.status === params.status);
        }
        if (params.level) {
          list = list.filter((item) => item.level === params.level);
        }
        if (params.channel) {
          list = list.filter((item) => item.channel === params.channel);
        }
        if (startDate) {
          list = list.filter((item) => item.updatedAt >= startDate);
        }
        if (endDate) {
          list = list.filter((item) => item.updatedAt <= endDate);
        }

        if (params.sortField && params.sortOrder) {
          const field = String(params.sortField) as keyof DemoRow;
          list.sort((first, second) => {
            const firstValue = first[field];
            const secondValue = second[field];
            if (firstValue === secondValue) return 0;
            const result = firstValue > secondValue ? 1 : -1;
            return params.sortOrder === 'descend' ? -result : result;
          });
        }

        const pageNo = Number(params.pageNo || 1);
        const pageSize = Number(params.pageSize || 20);
        const start = (pageNo - 1) * pageSize;

        return {
          list: list.slice(start, start + pageSize),
          total: list.length,
        };
      },
    };

    const demoHook: KtTableHook<DemoRow, DemoSearchValues> = defineKtTableHook({
      name: 'ktTableDemoCounter',
      onAfterAction: () => {
        actionTimes.value += 1;
      },
      onAfterFetch: () => {
        requestTimes.value += 1;
      },
    });

    const channelModule = defineKtTableModule<DemoRow, DemoSearchValues>({
      buttons: [
        {
          icon: <IconifyIcon class="kt-table-demo__icon" icon="lucide:plug" />,
          key: 'moduleSync',
          label: '同步渠道',
          onClick: () => {
            message.info('可插拔模块按钮已触发');
          },
        },
      ],
      columns: [
        {
          dataIndex: 'channel',
          key: 'channel',
          sorter: true,
          title: '渠道',
          width: 130,
        },
        {
          dataIndex: 'usageCount',
          key: 'usageCount',
          sorter: true,
          title: '使用次数',
          width: 130,
        },
      ],
      formOptions: {
        schema: [
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: channelOptions,
            },
            fieldName: 'channel',
            label: '渠道',
          },
        ],
      },
      name: 'channelModule',
      statistics: [
        {
          columnKey: 'channel',
          key: 'requestTimes',
          label: '请求',
          value: () => `${requestTimes.value} 次`,
        },
      ],
    });

    const buttons: Array<KtTableButton<DemoRow, DemoSearchValues>> = [
      {
        icon: <Plus class="kt-table-demo__icon" />,
        key: 'create',
        label: '新增组件',
        onClick: async (context) => {
          createDemoRow();
          await context.reload();
        },
        permissionCodes: ['System:KtTableDemo:Create'],
        type: 'primary',
      },
      {
        icon: (
          <IconifyIcon class="kt-table-demo__icon" icon="lucide:badge-check" />
        ),
        key: 'batchRelease',
        label: '批量发布',
        onClick: async (context) => {
          const selectedRows = context.selectedRows();
          if (selectedRows.length === 0) {
            message.warning('请先选择要发布的组件');
            return;
          }

          updateRows(selectedRows, { status: 'released' });
          message.success(`已发布 ${selectedRows.length} 个组件`);
          await context.reload();
        },
        permissionCodes: ['System:KtTableDemo:Edit'],
      },
      {
        icon: <SvgDownloadIcon class="kt-table-demo__icon" />,
        key: 'export',
        label: '导出当前页',
        onClick: (context) => {
          message.info(`当前页 ${context.getRows().length} 条数据`);
        },
      },
    ];

    const rowActions: Array<KtTableRowAction<DemoRow, DemoSearchValues>> = [
      {
        key: 'preview',
        label: '预览',
        onClick: (row) => {
          message.info(`预览组件：${row.code}`);
        },
      },
      {
        disabled: (row) => row.status === 'released',
        key: 'release',
        label: '发布',
        onClick: async (row, context) => {
          updateRows([row], { status: 'released' });
          message.success(`已发布：${row.name}`);
          await context.reload();
        },
        permissionCodes: ['System:KtTableDemo:Edit'],
      },
      {
        key: 'copy',
        label: '复制',
        onClick: (row) => {
          message.info(`已复制组件编号：${row.code}`);
        },
      },
      {
        key: 'log',
        label: '日志',
        onClick: (row) => {
          message.info(`查看操作日志：${row.code}`);
        },
      },
      {
        key: 'detail',
        label: '详情',
        onClick: (row) => {
          message.info(`查看组件详情：${row.name}`);
        },
      },
      {
        confirm: (row) => `确认删除「${row.name}」吗？`,
        danger: true,
        key: 'delete',
        label: '删除',
        onClick: async (row, context) => {
          removeRows([row]);
          message.success('组件已删除');
          await context.reload();
        },
        permissionCodes: ['System:KtTableDemo:Delete'],
      },
    ];

    const statistics: Array<KtTableStatistic<DemoRow, DemoSearchValues>> = [
      {
        columnKey: 'name',
        key: 'pageCount',
        label: '本页',
        value: (context) => `${context.getRows().length} 条`,
      },
      {
        columnKey: 'status',
        key: 'releaseCount',
        label: '已发布',
        value: (context) =>
          context.getRows().filter((item) => item.status === 'released').length,
      },
      {
        columnKey: 'coverage',
        key: 'averageCoverage',
        label: '平均覆盖率',
        value: (context) => {
          const currentRows = context.getRows();
          if (currentRows.length === 0) return '0%';
          const total = currentRows.reduce(
            (sum, item) => sum + item.coverage,
            0,
          );

          return `${Math.round(total / currentRows.length)}%`;
        },
      },
      {
        columnKey: 'usageCount',
        key: 'usageCount',
        label: '调用',
        value: (context) =>
          context.getRows().reduce((sum, item) => sum + item.usageCount, 0),
      },
    ];

    function createDemoRow() {
      const nextId = Math.max(0, ...rows.value.map((item) => item.id)) + 1;
      rows.value = [
        {
          channel: 'admin',
          code: `KT-CMP-${String(nextId).padStart(4, '0')}`,
          coverage: 86,
          description: '用于演示新增后的刷新和统计联动',
          groupName: '组件中心',
          id: nextId,
          level: 'business',
          name: `新建组件 ${nextId}`,
          owner: 'Admin',
          status: 'draft',
          updatedAt: '2026-05-19',
          usageCount: 0,
          version: 'v1.0.0',
        },
        ...rows.value,
      ];
      message.success('已新增一条组件数据');
    }

    function updateRows(targets: DemoRow[], patch: Partial<DemoRow>) {
      const ids = new Set(targets.map((item) => item.id));
      rows.value = rows.value.map((item) =>
        ids.has(item.id) ? { ...item, ...patch } : item,
      );
    }

    function removeRows(targets: DemoRow[]) {
      const ids = new Set(targets.map((item) => item.id));
      rows.value = rows.value.filter((item) => !ids.has(item.id));
    }

    const [registerTable] = useKtTable<DemoRow, DemoSearchValues>({
      api,
      buttons,
      columns,
      formOptions: {
        fieldMappingTime: [['updatedAt', ['startDate', 'endDate']]],
        schema: [
          {
            component: 'Input',
            componentProps: {
              allowClear: true,
              placeholder: '组件名称 / 编码 / 描述',
            },
            fieldName: 'keyword',
            label: '关键词',
          },
          {
            component: 'Input',
            componentProps: {
              allowClear: true,
              placeholder: '负责人',
            },
            fieldName: 'owner',
            label: '负责人',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: statusOptions,
            },
            fieldName: 'status',
            label: '状态',
          },
          {
            component: 'Select',
            componentProps: {
              allowClear: true,
              options: levelOptions,
            },
            fieldName: 'level',
            label: '等级',
          },
          {
            component: 'RangePicker',
            fieldName: 'updatedAt',
            label: '更新时间',
          },
        ],
      },
      hooks: [demoHook],
      modules: [channelModule],
      pageSize: 20,
      rowActions,
      showSelection: true,
      statistics,
      tableTitle: 'KT 组件发布清单 Demo',
    });

    const summaryText = computed(
      () => `请求 ${requestTimes.value} 次 / 操作 ${actionTimes.value} 次`,
    );

    function renderStatus(status: DemoStatus) {
      const option = pickOption(statusOptions, status);
      return <Tag color={option?.color}>{option?.label || status}</Tag>;
    }

    function renderLevel(level: DemoLevel) {
      const option = pickOption(levelOptions, level);
      return <Tag color={option?.color}>{option?.label || level}</Tag>;
    }

    function renderChannel(channel: DemoChannel) {
      const option = pickOption(channelOptions, channel);
      return <Tag color={option?.color}>{option?.label || channel}</Tag>;
    }

    return () => (
      <Page autoContentHeight>
        <AKtTable
          onRegister={registerTable}
          v-slots={{
            title: () => <span>KT 组件发布清单 Demo</span>,
            footer: () => (
              <span class="kt-table-demo__footer-note">
                {summaryText.value}
              </span>
            ),
            bodyCell: ({ column, record }: any) => {
              const row = record as DemoRow;

              if (column.key === 'name') {
                return (
                  <div class="kt-table-demo__component">
                    <div class="kt-table-demo__component-title">
                      <span class="kt-table-demo__component-name">
                        {row.name}
                      </span>
                      <span class="kt-table-demo__component-version">
                        {row.version}
                      </span>
                    </div>
                    <div class="kt-table-demo__component-meta">
                      {row.code} / {row.groupName}
                    </div>
                    <div class="kt-table-demo__component-desc">
                      {row.description}
                    </div>
                  </div>
                );
              }

              if (column.key === 'status') {
                return renderStatus(row.status);
              }

              if (column.key === 'level') {
                return renderLevel(row.level);
              }

              if (column.key === 'channel') {
                return renderChannel(row.channel);
              }

              if (column.key === 'coverage') {
                return (
                  <ASpace class="kt-table-demo__coverage" size={8}>
                    <AProgress
                      percent={row.coverage}
                      showInfo={false}
                      size="small"
                      status={row.coverage >= 80 ? 'success' : 'normal'}
                    />
                    <span>{row.coverage}%</span>
                  </ASpace>
                );
              }

              return undefined;
            },
          }}
        />
      </Page>
    );
  },
});
