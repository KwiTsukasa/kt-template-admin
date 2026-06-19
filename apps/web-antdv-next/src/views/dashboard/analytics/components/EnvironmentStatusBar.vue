<script lang="ts" setup>
import type { EnvironmentStreamConnectionState } from '../composables/useEnvironmentDashboardStream';
import type { EnvironmentDashboard, EnvironmentHealthStatus } from '../types';

import { Alert, Button, Space, Spin, Tag } from 'antdv-next';

const props = defineProps<{
  dashboard?: EnvironmentDashboard;
  errorText?: string;
  loading: boolean;
  selfChecking: boolean;
  streamState: EnvironmentStreamConnectionState;
}>();

defineEmits<{
  refresh: [];
  selfCheck: [];
}>();

/**
 * Chooses the strongest global status from summary counters.
 *
 * @returns Status tag value used by the top dashboard bar.
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

/**
 * Maps health status to antdv tag colors without hiding unwired integrations.
 *
 * @param status Global or signal health status from the API.
 * @returns Antdv tag color name.
 */
function getStatusColor(status: EnvironmentHealthStatus) {
  if (status === 'ok') return 'success';
  if (status === 'degraded') return 'warning';
  if (status === 'blocked' || status === 'down') return 'error';
  if (status === 'isolated') return 'purple';
  return 'default';
}
</script>

<template>
  <section class="environment-status-bar">
    <div class="environment-status-bar__summary">
      <Spin :spinning="loading">
        <div class="environment-status-bar__heading">
          <div>
            <p class="environment-status-bar__eyebrow">Environment Command</p>
            <h1>环境总览</h1>
          </div>
          <Tag :color="getStatusColor(getGlobalStatus())">
            {{ getGlobalStatus() }}
          </Tag>
        </div>
        <div class="environment-status-bar__meta">
          <span>生成 {{ dashboard?.generatedAt || 'unknown' }}</span>
          <span>刷新 {{ dashboard?.refreshedAt || 'unknown' }}</span>
          <span>SSE {{ streamState }}</span>
        </div>
      </Spin>
    </div>
    <div class="environment-status-bar__counts">
      <span>Signals {{ dashboard?.summary.totalSignals ?? 0 }}</span>
      <span>OK {{ dashboard?.summary.ok ?? 0 }}</span>
      <span>Unwired {{ dashboard?.summary.unwired ?? 0 }}</span>
      <span>Degraded {{ dashboard?.summary.degraded ?? 0 }}</span>
      <span>Down {{ dashboard?.summary.down ?? 0 }}</span>
    </div>
    <Space class="environment-status-bar__actions">
      <Button :loading="loading" @click="$emit('refresh')">刷新快照</Button>
      <Button
        :loading="selfChecking"
        type="primary"
        @click="$emit('selfCheck')"
      >
        只读自检
      </Button>
    </Space>
    <Alert
      v-if="errorText"
      :message="errorText"
      class="environment-status-bar__alert"
      type="error"
    />
  </section>
</template>

<style scoped>
.environment-status-bar {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(260px, auto) auto;
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding: 14px;
  color: hsl(var(--card-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.environment-status-bar__summary {
  min-width: 0;
}

.environment-status-bar__heading {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.environment-status-bar__heading h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  color: hsl(var(--foreground));
}

.environment-status-bar__eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.environment-status-bar__meta,
.environment-status-bar__counts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.environment-status-bar__counts span {
  white-space: nowrap;
}

.environment-status-bar__actions {
  justify-content: flex-end;
}

.environment-status-bar__alert {
  grid-column: 1 / -1;
}

@media (width <= 900px) {
  .environment-status-bar {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 12px;
  }

  .environment-status-bar__actions {
    justify-content: flex-start;
  }
}
</style>
