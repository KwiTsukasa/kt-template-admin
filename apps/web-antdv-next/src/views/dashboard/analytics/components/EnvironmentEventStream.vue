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
    <Empty v-if="events.length === 0" description="所选范围暂无近期事件" />
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
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  color: hsl(var(--card-foreground));
  background: hsl(var(--card));
}

.environment-event-stream__header {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
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
  flex: 1;
  align-content: start;
  min-height: 0;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
}

.environment-event-stream__list li {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid hsl(var(--border));
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
  gap: 8px;
  justify-content: flex-start;
}

.environment-event-stream__list li:first-child {
  padding-top: 0;
}

.environment-event-stream__list li:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.environment-event-stream__tags :deep(.ant-tag) {
  margin: 0;
}
</style>
