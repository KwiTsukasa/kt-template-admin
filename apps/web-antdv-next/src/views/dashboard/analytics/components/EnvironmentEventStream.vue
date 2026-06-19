<script lang="ts" setup>
import type { EnvironmentEvent, EnvironmentHealthStatus } from '../types';

import { Empty, Tag } from 'antdv-next';

defineProps<{
  events: EnvironmentEvent[];
}>();

/**
 * Maps event severity to a compact tag color.
 *
 * @param status Event severity from the API stream or snapshot.
 * @returns Antdv tag color value.
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
  <section class="environment-event-stream">
    <div class="environment-event-stream__header">
      <h2>事件流</h2>
      <span>{{ events.length }} events</span>
    </div>
    <Empty v-if="events.length === 0" />
    <ol v-else class="environment-event-stream__list">
      <li v-for="event in events" :key="event.eventId">
        <span class="environment-event-stream__time">
          {{ event.observedAt }}
        </span>
        <strong>{{ event.summary }}</strong>
        <span class="environment-event-stream__tags">
          <Tag :color="getStatusColor(event.severity)">
            {{ event.severity }}
          </Tag>
          <Tag>{{ event.sourceKind }}</Tag>
        </span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.environment-event-stream {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 12px;
  overflow: hidden;
  color: hsl(var(--card-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.environment-event-stream__header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.environment-event-stream__header h2 {
  margin: 0;
  font-size: 16px;
  color: hsl(var(--foreground));
}

.environment-event-stream__header span,
.environment-event-stream__time {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.environment-event-stream__list {
  display: grid;
  flex: 1 1 0;
  gap: 6px;
  min-height: 0;
  padding: 0;
  margin: 0;
  overflow: hidden;
  list-style: none;
}

.environment-event-stream__list li {
  display: grid;
  grid-template-columns: minmax(120px, auto) 1fr auto;
  gap: 10px;
  align-items: center;
  min-height: 44px;
  padding: 7px 10px;
  overflow: hidden;
  background: hsl(var(--accent));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.environment-event-stream__list strong {
  min-width: 0;
  font-size: 13px;
  color: hsl(var(--foreground));
  overflow-wrap: anywhere;
}

.environment-event-stream__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

@media (width <= 640px) {
  .environment-event-stream__list li {
    grid-template-columns: 1fr;
  }

  .environment-event-stream__tags {
    justify-content: flex-start;
  }
}
</style>
