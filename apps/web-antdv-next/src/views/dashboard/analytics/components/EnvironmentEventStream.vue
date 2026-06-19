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
  padding: 16px;
  border: 1px solid hsl(214deg 18% 86%);
  border-radius: 8px;
  background: hsl(0deg 0% 100%);
}

.environment-event-stream__header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.environment-event-stream__header h2 {
  margin: 0;
  color: hsl(219deg 22% 18%);
  font-size: 16px;
}

.environment-event-stream__header span,
.environment-event-stream__time {
  color: hsl(215deg 12% 38%);
  font-size: 12px;
}

.environment-event-stream__list {
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.environment-event-stream__list li {
  display: grid;
  grid-template-columns: minmax(120px, auto) 1fr auto;
  gap: 10px;
  align-items: center;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid hsl(210deg 18% 91%);
  border-radius: 8px;
  background: hsl(210deg 25% 98%);
}

.environment-event-stream__list strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: hsl(219deg 22% 18%);
  font-size: 13px;
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
