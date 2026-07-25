import type { RouteLocationNormalized } from 'vue-router';

export interface TabDefinition extends RouteLocationNormalized {
  key?: string;
}
