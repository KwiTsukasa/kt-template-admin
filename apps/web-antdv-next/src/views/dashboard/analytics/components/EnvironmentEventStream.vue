<script lang="ts" setup>
import type { EnvironmentEvent } from '../types';

import { Empty, Tag } from 'antdv-next';

import { HEALTH_PRESENTATION } from '../presentation';

defineProps<{
  events: EnvironmentEvent[];
}>();
</script>

<template>
  <section class="environment-event-stream">
    <div class="environment-event-stream__header">
      <h2>近期事件</h2>
      <span>{{ events.length }} 条</span>
    </div>
    <Empty v-if="events.length === 0" />
    <ol v-else class="environment-event-stream__list">
      <li v-for="event in events" :key="event.eventId">
        <span class="environment-event-stream__time">
          {{ event.observedAt }}
        </span>
        <strong>{{ event.summary }}</strong>
        <span class="environment-event-stream__tags">
          <Tag :color="HEALTH_PRESENTATION[event.severity].color">
            {{ HEALTH_PRESENTATION[event.severity].label }}
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
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: hsl(var(--card-foreground));
  background: hsl(var(--card));
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
  align-content: start;
  min-height: 0;
  padding: 0;
  margin: 0;
  overflow: auto;
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
