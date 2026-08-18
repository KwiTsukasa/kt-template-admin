<script lang="ts" setup>
import { computed, onBeforeMount, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import { Bell } from '@vben/icons';
import { BasicLayout, LockScreen, UserDropdown } from '@vben/layouts';
import { preferences } from '@vben/preferences';
import { useAccessStore, useTabbarStore, useUserStore } from '@vben/stores';

import { VbenIconButton } from '@vben-core/shadcn-ui';

import { Badge } from 'antdv-next';

import { $t } from '#/locales';
import { useAuthStore, useMessageCenterStore } from '#/store';
import LoginForm from '#/views/_core/authentication/login';

const { setMenuList } = useTabbarStore();
setMenuList([
  'close',
  'affix',
  'maximize',
  'reload',
  'open-in-new-window',
  'close-left',
  'close-right',
  'close-other',
  'close-all',
]);

const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const messageCenterStore = useMessageCenterStore();
const router = useRouter();
const { destroyWatermark, updateWatermark } = useWatermark();

const avatar = computed(() => {
  return userStore.userInfo?.avatar || preferences.app.defaultAvatar;
});

const canAccessMessageCenter = computed(() =>
  accessStore.accessCodes.includes('System:Notice:List'),
);

const userDropdownMenus = computed(() => [
  {
    handler: handleOpenProfile,
    icon: 'lucide:user',
    text: $t('page.auth.profile'),
  },
]);

async function handleOpenProfile() {
  await router.push({ name: 'Profile' });
}

/**
 * 从顶部铃铛进入隐藏菜单的消息中心路由。
 */
async function handleOpenMessageCenter() {
  await router.push({ name: 'SystemNotice' });
}

async function handleLogout() {
  await authStore.logout(false);
}

function handleClickLogo() {}

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
  }),
  async ({ enable, content }) => {
    if (enable) {
      await updateWatermark({
        content:
          content ||
          `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);

watch(
  canAccessMessageCenter,
  (allowed) => {
    if (allowed) {
      void messageCenterStore.start();
      return;
    }
    messageCenterStore.stop();
  },
  { immediate: true },
);

onBeforeMount(() => {
  if (preferences.app.watermark) {
    destroyWatermark();
  }
});

onBeforeUnmount(() => {
  messageCenterStore.stop();
});
</script>

<template>
  <BasicLayout
    @clear-preferences-and-logout="handleLogout"
    @click-logo="handleClickLogo"
  >
    <template v-if="canAccessMessageCenter" #header-right-85>
      <div class="flex-center mr-2 h-full">
        <Badge
          :count="messageCenterStore.unreadCount"
          :overflow-count="99"
          :show-zero="false"
          :offset="[-4, 4]"
          size="small"
        >
          <VbenIconButton
            class="text-foreground"
            :tooltip="$t('system.notice.openMessageCenter')"
            @click="handleOpenMessageCenter"
          >
            <Bell class="size-4" />
          </VbenIconButton>
        </Badge>
      </div>
    </template>
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :description="userStore.userInfo?.username"
        :menus="userDropdownMenus"
        :text="userStore.userInfo?.realName"
        trigger="both"
        @logout="handleLogout"
      />
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>
