<script lang="ts" setup>
import type { EnvironmentStreamConnectionState } from '../composables/useEnvironmentDashboardStream';
import type { EnvironmentDashboard, EnvironmentHealthStatus } from '../types';

import { computed } from 'vue';

import { Alert, Button, Space, Tag } from 'antdv-next';

import { HEALTH_PRESENTATION, STREAM_LABELS } from '../presentation';

const props = defineProps<{
  dashboard?: EnvironmentDashboard;
  errorText?: string;
  loading: boolean;
  selfChecking: boolean;
  streamState: EnvironmentStreamConnectionState;
}>();
defineEmits<{ refresh: []; selfCheck: [] }>();
const status = computed(getGlobalStatus);

/**
 * 按阻断、离线、异常和未知的优先级汇总环境健康状态。
 * @returns 当前快照最需要关注的状态；没有快照时为待确认。
 */
function getGlobalStatus(): EnvironmentHealthStatus {
  const summary = props.dashboard?.summary;
  if (!summary) return 'unknown';
  if (summary.blocked > 0) return 'blocked';
  if (summary.down > 0) return 'down';
  if (summary.degraded > 0) return 'degraded';
  if (summary.unwired > 0 || summary.unknown > 0) return 'unknown';
  return 'ok';
}
</script>

<template>
  <header class="environment-status-bar">
    <div class="environment-status-bar__toolbar">
      <div class="environment-status-bar__title">
        <h1>环境总览</h1>
        <p>汇总全部环境的节点、服务与实时信号，也可选择单个环境核对证据。</p>
      </div>
      <Space wrap>
        <slot></slot>
        <Tag :color="HEALTH_PRESENTATION[status].color">
          {{ HEALTH_PRESENTATION[status].label }}
        </Tag>
        <span class="environment-status-bar__meta">
          全局信号 {{ dashboard?.summary.totalSignals ?? '—' }} · 正常
          {{ dashboard?.summary.ok ?? '—' }}
        </span>
      </Space>
      <Space wrap>
        <span
          class="environment-status-bar__meta"
          :title="dashboard?.refreshedAt"
        >
          {{ STREAM_LABELS[streamState] }}
        </span>
        <Button :loading="loading" @click="$emit('refresh')">刷新</Button>
        <Button
          :loading="selfChecking"
          type="primary"
          @click="$emit('selfCheck')"
        >
          只读自检
        </Button>
      </Space>
    </div>
    <Alert v-if="errorText" :title="errorText" show-icon type="error" />
  </header>
</template>

<style scoped>
.environment-status-bar {
  display: grid;
  flex: none;
  gap: 16px;
  min-width: 0;
}

.environment-status-bar__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.environment-status-bar__title {
  width: 100%;
}

.environment-status-bar__title h1 {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 700;
}

.environment-status-bar__title p {
  margin: 0 0 4px;
  color: hsl(var(--muted-foreground));
}

.environment-status-bar__meta {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

@media (width <= 600px) {
  .environment-status-bar,
  .environment-status-bar__toolbar {
    gap: 8px;
  }

  .environment-status-bar__title h1 {
    margin-bottom: 0;
  }

  .environment-status-bar__title p {
    display: none;
  }
}
</style>
