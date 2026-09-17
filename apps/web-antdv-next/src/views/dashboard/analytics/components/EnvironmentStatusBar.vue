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
      <Space wrap>
        <slot></slot>
        <Tag :color="HEALTH_PRESENTATION[status].color">
          {{ HEALTH_PRESENTATION[status].label }}
        </Tag>
        <span class="environment-status-bar__meta">
          信号 {{ dashboard?.summary.totalSignals ?? 0 }} · 正常
          {{ dashboard?.summary.ok ?? 0 }}
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
  gap: 12px;
  min-width: 0;
  padding: 12px 16px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
}

.environment-status-bar__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.environment-status-bar__meta {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
</style>
