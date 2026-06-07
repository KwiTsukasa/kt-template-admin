<script setup lang="ts">
import type { Props } from './types';

import { preferences } from '@vben-core/preferences';
import {
  Card,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  VbenAvatar,
} from '@vben-core/shadcn-ui';
import { cn } from '@vben-core/shared/utils';

import { Page } from '../../components';

defineOptions({
  name: 'ProfileUI',
});

const props = withDefaults(defineProps<Props>(), {
  avatarEditable: false,
  title: '关于项目',
  tabs: () => [],
});

const emit = defineEmits<{
  avatarClick: [];
}>();

const tabsValue = defineModel<string>('modelValue');

function handleAvatarClick() {
  if (props.avatarEditable) {
    emit('avatarClick');
  }
}
</script>
<template>
  <Page auto-content-height :title="props.title">
    <div class="flex h-full w-full">
      <Card class="w-1/6 flex-none">
        <div class="mt-4 flex h-40 flex-col items-center justify-center gap-4">
          <button
            type="button"
            :aria-label="props.avatarEditable ? '更换头像' : '用户头像'"
            :class="
              cn(
                'rounded-full outline-none transition',
                props.avatarEditable &&
                  'cursor-pointer hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary',
              )
            "
            @click="handleAvatarClick"
          >
            <VbenAvatar
              :src="props.userInfo?.avatar || preferences.app.defaultAvatar"
              class="size-20"
            />
          </button>
          <span class="text-lg font-semibold">
            {{ props.userInfo?.realName ?? '' }}
          </span>
          <span class="text-foreground/80 text-sm">
            {{ props.userInfo?.username ?? '' }}
          </span>
        </div>
        <Separator class="my-4" />
        <Tabs v-model="tabsValue" orientation="vertical" class="m-4">
          <TabsList class="bg-card grid w-full grid-cols-1">
            <TabsTrigger
              v-for="tab in props.tabs"
              :key="tab.value"
              :value="tab.value"
              class="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-12 justify-start"
            >
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>
      <Card class="ml-4 w-5/6 flex-auto p-8">
        <slot name="content"></slot>
      </Card>
    </div>
  </Page>
</template>
