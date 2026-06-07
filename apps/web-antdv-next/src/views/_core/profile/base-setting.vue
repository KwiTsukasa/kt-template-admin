<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, onMounted, ref } from 'vue';

import { ProfileBaseSetting } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { message } from 'antdv-next';

import { getUserInfoApi, updateCurrentUserProfileApi } from '#/api';

const userStore = useUserStore();
const profileBaseSettingRef = ref();

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      fieldName: 'realName',
      component: 'Input',
      label: '姓名',
      componentProps: {
        placeholder: '请输入姓名',
      },
    },
    {
      fieldName: 'homePath',
      component: 'Input',
      label: '首页路径',
      componentProps: {
        placeholder: '请输入登录后的默认首页路径',
      },
    },
  ];
});

async function setFormValues(data: Record<string, any>) {
  await profileBaseSettingRef.value?.getFormApi().setValues({
    homePath: data.homePath,
    realName: data.realName,
  });
}

async function refreshUserInfo() {
  const data = await getUserInfoApi();
  userStore.setUserInfo(data);
  await setFormValues(data);
}

async function handleSubmit(values: Record<string, any>) {
  const data = await updateCurrentUserProfileApi({
    homePath: values.homePath,
    realName: values.realName,
  });
  userStore.setUserInfo(data);
  await setFormValues(data);
  message.success('个人资料已更新');
}

onMounted(async () => {
  await refreshUserInfo();
});
</script>
<template>
  <ProfileBaseSetting
    ref="profileBaseSettingRef"
    :form-schema="formSchema"
    @submit="handleSubmit"
  />
</template>
