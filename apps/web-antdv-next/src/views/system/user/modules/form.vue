<script lang="ts" setup>
import type { SystemUserApi } from '#/api/system/user';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createUser, updateUser } from '#/api/system/user';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);

const formData = ref<SystemUserApi.SystemUser>();
const id = ref<string>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    const values = await formApi.getValues();
    if (id.value && !values.password) {
      delete values.password;
    }

    drawerApi.lock();
    try {
      await (id.value ? updateUser(id.value, values) : createUser(values));
      emit('success');
      drawerApi.close();
    } finally {
      drawerApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) return;

    const data = drawerApi.getData<SystemUserApi.SystemUser>();
    formData.value = data || undefined;
    id.value = data?.id;
    formApi.resetForm();
    formApi.setValues({
      ...data,
      homePath: data?.homePath || '/analytics',
      password: '',
      status: data?.status ?? 1,
      timezone: data?.timezone || 'Asia/Shanghai',
    });
  },
});

const getDrawerTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('system.user.name')])
    : $t('ui.actionTitle.create', [$t('system.user.name')]);
});
</script>

<template>
  <Drawer :title="getDrawerTitle">
    <Form class="system-user-form" />
  </Drawer>
</template>

<style lang="scss" scoped>
.system-user-form {
  padding: 0 8px;
}
</style>
