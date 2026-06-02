# KtTable 表格

当前项目表格统一使用 `KtTable + Antdv Next Table + Vben Form`。不要再引入旧表格适配器或额外表格依赖。

## 基础用法

```tsx
import type { TableColumnType } from 'antdv-next';

import type { KtTableApi, KtTableButton } from '#/components/ktTable';

import { h } from 'vue';

import { Plus } from '@vben/icons';

import { KtTable, useKtTable } from '#/components/ktTable';

interface Row {
  id: string;
  name: string;
  status: number;
}

const columns: Array<TableColumnType<Row>> = [
  { dataIndex: 'name', key: 'name', title: '名称', width: 200 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 100 },
];

const api: KtTableApi<Row> = {
  list: async (params) => {
    return await getListApi({
      page: params.pageNo,
      pageSize: params.pageSize,
      ...params,
    });
  },
};

const buttons: Array<KtTableButton<Row>> = [
  {
    icon: () => h(Plus, { class: 'kt-table__button-icon' }),
    key: 'create',
    label: '新增',
    onClick: onCreate,
    type: 'primary',
  },
];

const [registerTable, tableApi] = useKtTable<Row>({
  api,
  buttons,
  columns,
  rowActions,
});
```

```tsx
<KtTable
  onRegister={registerTable}
  v-slots={{
    bodyCell: ({ column, record }) => {
      if (column.key === 'status') {
        return record.status === 1 ? '启用' : '停用';
      }
      return undefined;
    },
  }}
/>
```

## 搜索表单

```ts
const [registerTable] = useKtTable<Row>({
  api,
  columns,
  formOptions: {
    fieldMappingTime: [['createTime', ['startTime', 'endTime']]],
    labelInInput: true,
    schema: [
      { component: 'Input', fieldName: 'keyword', label: '关键词' },
      {
        component: 'Select',
        fieldName: 'status',
        label: '状态',
        componentProps: {
          allowClear: true,
          options: [
            { label: '启用', value: 1 },
            { label: '停用', value: 0 },
          ],
        },
      },
    ],
  },
});
```

## 操作按钮

按钮完全由业务页面注册，组件里不写死新增、编辑、删除等业务逻辑。

```ts
const rowActions = [
  {
    key: 'edit',
    label: '编辑',
    onClick: onEdit,
    permissionCodes: ['System:Role:Edit'],
  },
  {
    confirm: (row) => `确认删除「${row.name}」吗？`,
    danger: true,
    key: 'delete',
    label: '删除',
    onClick: onDelete,
    permissionCodes: ['System:Role:Delete'],
  },
];
```

## 可插拔模块

```ts
import { defineKtTableHook, defineKtTableModule } from '#/components/ktTable';

const requestLogger = defineKtTableHook<Row>({
  name: 'requestLogger',
  onBeforeFetch(params) {
    console.log(params);
  },
});

const statusModule = defineKtTableModule<Row>({
  columns: [{ dataIndex: 'status', key: 'status', title: '状态', width: 100 }],
  hooks: [requestLogger],
  name: 'statusModule',
});

const [registerTable] = useKtTable<Row>({
  columns,
  modules: [statusModule],
});
```

## 常用配置

| 属性 | 说明 |
| --- | --- |
| `api.list` | 远程数据接口，组件自动带分页和搜索参数 |
| `columns` | Antdv Next `TableColumnType[]` |
| `formOptions` | Vben Form 搜索表单配置 |
| `buttons` | 表格头部按钮 |
| `rowActions` | 行操作按钮，超过可见数量自动折叠 |
| `statistics` | 行列级统计，固定在表格底部 |
| `showIndex` | 是否显示序号列，默认显示 |
| `showSelection` | 是否显示选择列 |
| `showPagination` | 是否显示分页 |
| `rowResizable` | 是否允许调整单行行高 |

## 约束

- 表格列使用 Antdv Next 原生 `TableColumnType`。
- 自定义单元格使用 `bodyCell` 插槽或页面内 TSX 渲染。
- 搜索表单必须使用 Vben Form，不在外部维护独立 `searchValue`。
- 业务按钮、权限码和请求逻辑都由页面通过 `useKtTable` 注册。
