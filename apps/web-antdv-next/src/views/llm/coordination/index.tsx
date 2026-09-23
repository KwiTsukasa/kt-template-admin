import type {
  CoordinationSnapshot,
  CoordinationTask,
} from '#/api/system/workflow-coordination';

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useRoute } from 'vue-router';

import {
  Alert,
  Button,
  Empty,
  Input,
  Select,
  Space,
  Tabs,
  Tag,
  Tooltip,
} from 'antdv-next';

import {
  getCoordinationEventsUrl,
  getCoordinationSnapshot,
} from '#/api/system/workflow-coordination';
import { KtTable } from '#/components/kt-table';

import {
  claimIdentity,
  claimStatus,
  CONNECTION_STALE_MS,
  OPERATION_LABELS,
  selectCoordinationTasks,
  summarizeCoordination,
  TASK_STATUS_COLORS,
  TASK_STATUS_FILTERS,
  taskStatus,
} from './model';

import './index.scss';

const AKtTable = KtTable as any;
const ATabs = Tabs as any;
const ASelect = Select as any;
const SNAPSHOT_TABLE_PROPS = {
  showDefaultButtons: false,
  showFooter: false,
  showHeader: false,
  showIndex: false,
  showPagination: false,
};

export default defineComponent({
  name: 'WorkflowCoordination',
  setup() {
    const route = useRoute();
    const snapshot = ref<CoordinationSnapshot>();
    const search = ref('');
    const selectedId = ref('');
    const includeHistory = ref(false);
    const activeTab = ref('tasks');
    const statusFilter = ref('');
    const connection = ref('正在连接');
    const error = ref('');
    const copied = ref('');
    const loading = ref(false);
    const now = ref(Date.now());
    const lastReceivedAt = ref(0);
    let source: EventSource | undefined;
    let clock: ReturnType<typeof setInterval> | undefined;
    let generation = 0;
    const connectionState = computed(() => {
      if (
        connection.value === '实时同步' &&
        now.value - lastReceivedAt.value > CONNECTION_STALE_MS
      )
        return '实时状态待确认';
      return connection.value;
    });

    const currentId = computed(() => {
      const value = route.query.workstreamId;
      if (typeof value !== 'string') return '';
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
          value,
        )
      )
        return '';
      return value;
    });
    watch(
      currentId,
      (value) => {
        selectedId.value = value;
      },
      { immediate: true },
    );
    const taskIndex = computed(
      () =>
        new Map(
          (snapshot.value?.tasks ?? []).map((task) => [
            task.workstreamId,
            task,
          ]),
        ),
    );
    const currentTask = computed(() => taskIndex.value.get(currentId.value));
    const tasks = computed(() =>
      selectCoordinationTasks(
        snapshot.value,
        currentId.value,
        search.value,
        includeHistory.value,
        now.value,
        statusFilter.value,
      ),
    );
    const selected = computed(() => taskIndex.value.get(selectedId.value));
    const resources = computed(() =>
      (snapshot.value?.claims ?? []).map((claim) => ({
        ...claim,
        id: claimIdentity(claim),
        acquiredAtText: formatTime(claim.acquiredAt),
        owner:
          taskIndex.value.get(claim.workstreamId)?.objective ??
          claim.workstreamId,
        status: claimStatus(
          claim,
          taskIndex.value.get(claim.workstreamId),
          now.value,
        ),
      })),
    );
    const events = computed(() => (snapshot.value?.events ?? []).toReversed());
    const taskColumns = [
      {
        key: 'objective',
        dataIndex: 'objective',
        title: '任务',
        ellipsis: true,
      },
      { key: 'status', title: '状态', width: 100 },
      { key: 'updatedAt', title: '更新时间', width: 156 },
    ];
    const resourceColumns = [
      { key: 'kind', dataIndex: 'kind', title: '类型', width: 90 },
      { key: 'key', dataIndex: 'key', title: '资源', ellipsis: true },
      { key: 'owner', dataIndex: 'owner', title: '所有者', ellipsis: true },
      {
        key: 'acquiredAt',
        dataIndex: 'acquiredAtText',
        title: '取得时间',
        width: 170,
      },
      {
        key: 'actionId',
        dataIndex: 'actionId',
        title: '动作',
        width: 200,
        ellipsis: true,
      },
      {
        key: 'status',
        dataIndex: 'status',
        title: '归属状态',
        width: 220,
        ellipsis: true,
      },
    ];
    const eventColumns = [
      { key: 'operation', title: '操作', width: 110 },
      { key: 'message', dataIndex: 'message', title: '记录', ellipsis: true },
      {
        key: 'workstreamId',
        dataIndex: 'workstreamId',
        title: '任务身份',
        width: 300,
        ellipsis: true,
      },
      { key: 'at', title: '时间', width: 170 },
    ];
    const taskActions = [
      {
        key: 'detail',
        label: '查看',
        onClick: (task: CoordinationTask) => selectTask(task.workstreamId),
      },
    ];
    const ownerActions = [
      {
        key: 'owner',
        label: '所有者',
        disabled: (claim: CoordinationSnapshot['claims'][number]) =>
          !taskIndex.value.has(claim.workstreamId),
        onClick: (claim: CoordinationSnapshot['claims'][number]) =>
          locateTask(claim.workstreamId),
      },
    ];
    const capsule = computed(() => {
      const state = snapshot.value;
      const task = selected.value;
      if (!state || !task) return '';
      let receivedAt: null | string = null;
      if (lastReceivedAt.value)
        receivedAt = new Date(lastReceivedAt.value).toISOString();
      return JSON.stringify(
        {
          readOnly: true,
          executionRequiresOwnResumeCheckGuard: true,
          snapshotId: state.snapshotId,
          observedAt: state.observedAt,
          connection: connectionState.value,
          receivedAt,
          warning: error.value || null,
          unreadableTasks: state.unreadableTasks,
          unreadableTaskDetails: state.unreadableTaskDetails ?? [],
          currentWorkstreamId: currentId.value || null,
          inspectedTask: task,
          claims: state.claims.filter(
            (claim) => claim.workstreamId === task.workstreamId,
          ),
        },
        null,
        2,
      );
    });
    const statistics = computed(() => {
      if (!snapshot.value)
        return [
          ['进行中', '—'],
          ['占用资源', '—'],
          ['近15分钟冲突', '—'],
          ['状态待确认', '—'],
        ];
      const counts = summarizeCoordination(
        snapshot.value,
        currentId.value,
        now.value,
      );
      return [
        ['进行中', counts.active],
        ['占用资源', counts.resources],
        ['近15分钟冲突', counts.conflicts],
        ['状态待确认', counts.pending],
      ];
    });

    /**
     * 在任务页签定位所选记录并清除上次复制反馈，不改写当前入口身份。
     * @param workstreamId - 用户选中的可读任务标识。
     */
    function selectTask(workstreamId: string) {
      selectedId.value = workstreamId;
      copied.value = '';
      activeTab.value = 'tasks';
    }

    /**
     * 从当前任务或资源所有者入口定位任务，清除会隐藏该行的筛选条件。
     * @param workstreamId - 需要在列表和检查点同时显示的任务身份。
     */
    function locateTask(workstreamId: string) {
      search.value = '';
      statusFilter.value = '';
      selectTask(workstreamId);
    }

    onMounted(() => {
      void connect();
      clock = setInterval(() => {
        now.value = Date.now();
      }, 5000);
    });
    onBeforeUnmount(() => {
      generation += 1;
      source?.close();
      clearInterval(clock);
    });

    /**
     * 先读取当前快照，再订阅变化；较早请求和卸载后的响应不会覆盖新连接。
     */
    async function connect() {
      const current = ++generation;
      source?.close();
      source = undefined;
      loading.value = true;
      connection.value = '正在连接';
      error.value = '';
      try {
        const initial = await getCoordinationSnapshot();
        if (current !== generation) return;
        snapshot.value = initial;
        const stream = new EventSource(getCoordinationEventsUrl(), {
          withCredentials: true,
        });
        source = stream;
        stream.addEventListener('coordination-snapshot', (event) => {
          if (current !== generation) return;
          try {
            const value = JSON.parse(
              (event as MessageEvent<string>).data,
            ) as CoordinationSnapshot;
            if (
              value.schemaVersion !== 1 ||
              !Array.isArray(value.tasks) ||
              !Array.isArray(value.claims) ||
              !Array.isArray(value.events)
            )
              throw new Error('invalid snapshot');
            snapshot.value = value;
            lastReceivedAt.value = Date.now();
            connection.value = '实时同步';
            error.value = '';
          } catch {
            connection.value = '数据异常';
            error.value = '协调快照无法读取，请重新连接。';
          }
        });
        stream.addEventListener('coordination-unavailable', () => {
          if (current === generation) {
            connection.value = '上游不可用';
            error.value = 'PC 状态暂不可用，当前显示最后一次快照。';
          }
        });
        stream.addEventListener('error', () => {
          if (current === generation) connection.value = '连接中断，正在重连';
        });
      } catch {
        if (current !== generation) return;
        connection.value = 'PC 不可用';
        error.value =
          '无法连接协调中心，请确认 Windows PC 和 Remote Index 服务在线。';
      } finally {
        if (current === generation) loading.value = false;
      }
    }

    /**
     * 将快照时间转换为本地可读时间，缺失值显示占位符。
     * @param value - ISO 时间字符串。
     * @returns 本地日期时间或占位文本。
     */
    function formatTime(value?: string) {
      if (!value) return '—';
      return new Date(value).toLocaleString();
    }

    /**
     * 根据事件操作返回简短中文标签。
     * @param operation - 协调记录的操作类型。
     * @returns 页面显示的操作名称。
     */
    function operationLabel(operation: string) {
      return OPERATION_LABELS[operation] ?? operation;
    }

    /**
     * 复制页面可见的只读协调胶囊，供当前智能体核对身份与占用。
     */
    async function copyCapsule() {
      try {
        await navigator.clipboard.writeText(capsule.value);
        copied.value = '只读协调胶囊已复制';
      } catch {
        copied.value = '剪贴板不可用，可直接读取下方协调胶囊。';
      }
    }

    /**
     * 展示选中任务的准确下一步与占用，未选中时提供选择提示。
     * @returns 任务详情区域。
     */
    function renderDetail() {
      const task = selected.value;
      if (!task) return <Empty description="选择任务查看检查点" />;
      const claims =
        snapshot.value?.claims.filter(
          (claim) => claim.workstreamId === task.workstreamId,
        ) ?? [];
      return (
        <div class="kt-coordination__detail">
          <Tag color={TASK_STATUS_COLORS[taskStatus(task, now.value)]}>
            {taskStatus(task, now.value)}
          </Tag>
          <h3>{task.objective}</h3>
          <code>{task.workstreamId}</code>
          <p class="kt-coordination__muted">
            更新于 {formatTime(task.updatedAt)} · 修订 {task.revision} ·
            执行层级 {task.executionDepth}
          </p>
          <p>
            栈顶动作：<code>{task.actionId || '无活动动作'}</code>
          </p>
          <h4>下一步</h4>
          <p class="kt-coordination__next">
            {task.nextStep || '当前任务没有待执行步骤'}
          </p>
          <h4>占用资源 · {claims.length}</h4>
          <ul>
            {claims.map((claim) => (
              <li key={claimIdentity(claim)}>
                <Tag>{claim.kind}</Tag>
                <code>{claim.key}</code>
                <p class="kt-coordination__muted">
                  动作 <code>{claim.actionId}</code> ·{' '}
                  {claimStatus(claim, task, now.value)}
                </p>
                <p class="kt-coordination__muted">
                  取得于 {formatTime(claim.acquiredAt)}
                </p>
              </li>
            ))}
          </ul>
          <details class="kt-coordination__technical">
            <summary>技术详情</summary>
            <Button onClick={() => void copyCapsule()}>复制协调胶囊</Button>
            <p class="kt-coordination__muted" role="status">
              {copied.value}
            </p>
            <pre aria-label="只读协调胶囊" class="kt-coordination__capsule">
              {capsule.value}
            </pre>
          </details>
        </div>
      );
    }

    /**
     * 汇总连接与读取异常，同时保留最后一次可读快照供核对。
     * @returns 异常提示；状态正常时不渲染内容。
     */
    function renderWarning() {
      if (error.value)
        return <Alert showIcon title={error.value} type="warning" />;
      if (snapshot.value?.unreadableTasks)
        return (
          <Alert
            description={
              <div>
                {snapshot.value.unreadableTaskDetails?.map((detail) => (
                  <p key={detail.workstreamId}>
                    <code>{detail.workstreamId}</code> · {detail.reason}
                  </p>
                ))}
              </div>
            }
            showIcon
            title={`${snapshot.value.unreadableTasks} 个任务状态无法读取，不能据此判断资源空闲。`}
            type="warning"
          />
        );
      return null;
    }

    return () => (
      <main class="kt-coordination">
        <header class="kt-coordination__header">
          <Space wrap>
            <Tooltip title={`快照 ${formatTime(snapshot.value?.observedAt)}`}>
              <Tag>{connectionState.value}</Tag>
            </Tooltip>
            {statistics.value.map(([label, value]) => (
              <span class="kt-coordination__muted" key={String(label)}>
                {label} {value}
              </span>
            ))}
          </Space>
          <Space wrap>
            <Tooltip
              title={currentTask.value?.objective ?? '当前入口未绑定任务'}
            >
              <Button
                disabled={!currentTask.value}
                onClick={() => locateTask(currentId.value)}
              >
                定位当前任务
              </Button>
            </Tooltip>
            <Button loading={loading.value} onClick={() => void connect()}>
              重新连接
            </Button>
          </Space>
        </header>
        {renderWarning()}
        <ATabs
          activeKey={activeTab.value}
          class="kt-coordination__tabs"
          items={[
            {
              key: 'tasks',
              label: '任务',
              content: () => (
                <div class="kt-coordination__task-view">
                  <div class="kt-coordination__filters">
                    <Input
                      aria-label="搜索任务"
                      onUpdate:value={(value) => {
                        search.value = value;
                      }}
                      placeholder="搜索任务或 ID"
                      value={search.value}
                    />
                    <ASelect
                      aria-label="任务状态"
                      onChange={(value: string) => {
                        statusFilter.value = value;
                      }}
                      options={[
                        { label: '全部状态', value: '' },
                        ...TASK_STATUS_FILTERS.map((value) => ({
                          label: value,
                          value,
                        })),
                      ]}
                      value={statusFilter.value}
                    />
                    <Button
                      aria-pressed={includeHistory.value}
                      onClick={() => {
                        includeHistory.value = !includeHistory.value;
                      }}
                    >
                      包含历史与已完成任务
                    </Button>
                  </div>
                  <div class="kt-coordination__workspace">
                    <AKtTable
                      {...SNAPSHOT_TABLE_PROPS}
                      activeRowKey={selectedId.value}
                      columns={taskColumns}
                      dataSource={tasks.value}
                      onRowClick={(task: CoordinationTask) =>
                        selectTask(task.workstreamId)
                      }
                      rowActions={taskActions}
                      rowKey="workstreamId"
                      v-slots={{
                        bodyCell: ({
                          column,
                          record,
                        }: {
                          column: { key: string };
                          record: CoordinationTask;
                        }) => {
                          if (column.key === 'status')
                            return (
                              <Tag
                                color={
                                  TASK_STATUS_COLORS[
                                    taskStatus(record, now.value)
                                  ]
                                }
                              >
                                {taskStatus(record, now.value)}
                              </Tag>
                            );
                          if (column.key === 'updatedAt')
                            return formatTime(record.updatedAt);
                          return undefined;
                        },
                      }}
                    />
                    <aside class="kt-coordination__checkpoint">
                      <h2>任务检查点</h2>
                      <div class="kt-coordination__detail-body">
                        {renderDetail()}
                      </div>
                    </aside>
                  </div>
                </div>
              ),
            },
            {
              key: 'resources',
              label: `共享资源 · ${resources.value.length}`,
              content: () => (
                <AKtTable
                  {...SNAPSHOT_TABLE_PROPS}
                  columns={resourceColumns}
                  dataSource={resources.value}
                  rowActions={ownerActions}
                  rowKey="id"
                />
              ),
            },
            {
              key: 'events',
              label: '协调记录',
              content: () => (
                <AKtTable
                  {...SNAPSHOT_TABLE_PROPS}
                  columns={eventColumns}
                  dataSource={events.value}
                  rowKey="id"
                  v-slots={{
                    bodyCell: ({
                      column,
                      record,
                    }: {
                      column: { key: string };
                      record: CoordinationSnapshot['events'][number];
                    }) => {
                      if (column.key === 'operation')
                        return <Tag>{operationLabel(record.operation)}</Tag>;
                      if (column.key === 'at') return formatTime(record.at);
                      return undefined;
                    },
                  }}
                />
              ),
            },
          ]}
          onUpdate:activeKey={(value: string) => {
            activeTab.value = value;
          }}
        />
      </main>
    );
  },
});
