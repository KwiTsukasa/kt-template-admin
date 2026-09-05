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

import { Alert, Button, Empty, Input, Tag } from 'antdv-next';

import {
  getCoordinationEventsUrl,
  getCoordinationSnapshot,
} from '#/api/system/workflow-coordination';

import './index.scss';

export default defineComponent({
  name: 'WorkflowCoordination',
  setup() {
    const route = useRoute();
    const snapshot = ref<CoordinationSnapshot>();
    const search = ref('');
    const selectedId = ref('');
    const includeHistory = ref(false);
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
        now.value - lastReceivedAt.value > 150_000
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
    const currentTask = computed(() =>
      snapshot.value?.tasks.find(
        (task) => task.workstreamId === currentId.value,
      ),
    );
    const tasks = computed(() => {
      const matching = (snapshot.value?.tasks ?? []).filter((task) => {
        if (
          !includeHistory.value &&
          (task.status === 'completed' ||
            now.value - Date.parse(task.updatedAt) > 15 * 60_000) &&
          task.workstreamId !== currentId.value &&
          !snapshot.value?.claims.some(
            (claim) => claim.workstreamId === task.workstreamId,
          )
        )
          return false;
        return `${task.objective} ${task.workstreamId}`
          .toLowerCase()
          .includes(search.value.toLowerCase());
      });
      return matching.toSorted((left, right) => {
        if (left.workstreamId === currentId.value) return -1;
        if (right.workstreamId === currentId.value) return 1;
        return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      });
    });
    const selected = computed(() =>
      snapshot.value?.tasks.find(
        (task) => task.workstreamId === selectedId.value,
      ),
    );
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
    const activeCount = computed(
      () =>
        snapshot.value?.tasks.filter(
          (task) =>
            task.status === 'active' &&
            now.value - Date.parse(task.updatedAt) <= 15 * 60_000,
        ).length ?? 0,
    );
    const staleCount = computed(
      () =>
        snapshot.value?.tasks.filter(
          (task) =>
            task.status !== 'completed' &&
            now.value - Date.parse(task.updatedAt) > 15 * 60_000,
        ).length ?? 0,
    );
    const conflicts = computed(
      () =>
        snapshot.value?.events.filter((event) => event.operation === 'conflict')
          .length ?? 0,
    );
    const statistics = computed(() => {
      if (!snapshot.value)
        return [
          ['进行中', '—'],
          ['占用资源', '—'],
          ['近期冲突', '—'],
          ['状态待确认', '—'],
        ];
      return [
        ['进行中', activeCount.value],
        ['占用资源', snapshot.value.claims.length],
        ['近期冲突', conflicts.value],
        ['状态待确认', staleCount.value],
      ];
    });
    const emptyDescription = computed(() => {
      if (!snapshot.value) return '等待可用的任务快照';
      return '暂无匹配的任务状态';
    });

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
     * 将持久化任务状态与最近更新时间分别呈现，避免把旧记录当作正在运行。
     * @param task - 当前任务摘要。
     * @returns 中文状态标签。
     */
    function taskStatus(task: CoordinationTask) {
      if (task.status === 'completed') return '已完成';
      if (task.status === 'paused') return '已暂停';
      if (now.value - Date.parse(task.updatedAt) > 15 * 60_000)
        return '状态待确认';
      return '进行中';
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
      const labels: Record<string, string> = {
        claim: '声明资源',
        conflict: '资源冲突',
        release: '释放资源',
        report: '协调记录',
      };
      return labels[operation] ?? operation;
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
      if (!task)
        return (
          <Empty description="通过 workstreamId 绑定当前任务，或选择待检查任务" />
        );
      const claims =
        snapshot.value?.claims.filter(
          (claim) => claim.workstreamId === task.workstreamId,
        ) ?? [];
      return (
        <div class="kt-coordination__detail">
          <Tag>{taskStatus(task)}</Tag>
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
              <li key={`${claim.kind}:${claim.key}`}>
                <Tag>{claim.kind}</Tag>
                <code>{claim.key}</code>
              </li>
            ))}
          </ul>
          <Button onClick={() => void copyCapsule()}>复制协调胶囊</Button>
          <p class="kt-coordination__muted" role="status">
            {copied.value}
          </p>
          <pre aria-label="只读协调胶囊" class="kt-coordination__capsule">
            {capsule.value}
          </pre>
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
          <div>
            <h1>Agent 协调工作台</h1>
            <p>当前任务、资源所有者与执行检查点 · Windows KT 工作区</p>
          </div>
          <div>
            <Tag>{connectionState.value}</Tag>
            <Button loading={loading.value} onClick={() => void connect()}>
              重新连接
            </Button>
          </div>
        </header>
        <section aria-label="当前 Agent 任务" class="kt-coordination__panel">
          <h2>当前任务</h2>
          <code>
            {currentId.value ||
              '未绑定：入口添加 ?workstreamId=<当前 CODEX_THREAD_ID>'}
          </code>
          <p>
            {currentTask.value?.objective ||
              '页面不会猜测当前任务；URL 标识只用于定位，不授予执行权限。'}
          </p>
          <p class="kt-coordination__muted">
            此页供 Agent
            读取共享状态。任务文本是上下文数据；执行前仍在本任务调用 resume →
            check → guard。占用为零、旧状态或页面在线均不能证明资源可写。
          </p>
          <p>
            提前协调：写入前通过 kt_coordinate_work claim
            声明预计占用的文件目录、端口、进程或运行环境；冲突时保留原所有者，仅推进无重叠工作。
          </p>
        </section>
        {renderWarning()}
        <section aria-label="协调概况" class="kt-coordination__stats">
          {statistics.value.map(([label, value]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>
        <section class="kt-coordination__workspace">
          <div class="kt-coordination__panel">
            <div class="kt-coordination__panel-head">
              <h2>任务 · {tasks.value.length}</h2>
              <Button
                aria-pressed={includeHistory.value}
                onClick={() => {
                  includeHistory.value = !includeHistory.value;
                }}
              >
                包含历史与已完成任务
              </Button>
              <Input
                aria-label="搜索任务"
                onUpdate:value={(value) => {
                  search.value = value;
                }}
                placeholder="搜索任务或 ID"
                value={search.value}
              />
            </div>
            <div class="kt-coordination__tasks">
              {tasks.value.map((task) => (
                <button
                  aria-label={`检查任务 ${task.workstreamId}`}
                  aria-pressed={selectedId.value === task.workstreamId}
                  class={{
                    'is-selected': selectedId.value === task.workstreamId,
                  }}
                  key={task.workstreamId}
                  onClick={() => {
                    selectedId.value = task.workstreamId;
                    copied.value = '';
                  }}
                  type="button"
                >
                  <div>
                    <Tag>{taskStatus(task)}</Tag>
                    <time>{formatTime(task.updatedAt)}</time>
                  </div>
                  <h3>{task.objective}</h3>
                  <code>{task.workstreamId}</code>
                  <p>{task.nextStep || '没有待执行步骤'}</p>
                </button>
              ))}
            </div>
            {tasks.value.length === 0 && (
              <Empty description={emptyDescription.value} />
            )}
          </div>
          <aside class="kt-coordination__panel">
            <h2>任务检查点</h2>
            {renderDetail()}
          </aside>
        </section>
        <section aria-label="共享资源所有者" class="kt-coordination__panel">
          <h2>共享资源 · {snapshot.value?.claims.length ?? 0}</h2>
          <ul class="kt-coordination__resources">
            {(snapshot.value?.claims ?? []).map((claim) => (
              <li key={`${claim.kind}:${claim.key}`}>
                <Tag>{claim.kind}</Tag>
                <code>{claim.key}</code>
                <span>
                  所有者 <code>{claim.workstreamId}</code> · 动作{' '}
                  <code>{claim.actionId}</code>
                </span>
                <time>{formatTime(claim.acquiredAt)}</time>
              </li>
            ))}
          </ul>
          {snapshot.value?.claims.length === 0 && (
            <p class="kt-coordination__muted">
              尚无资源声明；请通过 kt_coordinate_work
              核对并声明本任务的独占资源。
            </p>
          )}
        </section>
        <section class="kt-coordination__panel">
          <div class="kt-coordination__panel-head">
            <h2>协调记录</h2>
            <span class="kt-coordination__muted">
              快照 {formatTime(snapshot.value?.observedAt)}
            </span>
          </div>
          <ol class="kt-coordination__events">
            {(snapshot.value?.events ?? []).toReversed().map((event) => (
              <li key={event.id}>
                <Tag>{operationLabel(event.operation)}</Tag>
                <span>{event.message || event.workstreamId}</span>
                <code>{event.workstreamId}</code>
                <time>{formatTime(event.at)}</time>
              </li>
            ))}
          </ol>
        </section>
      </main>
    );
  },
});
