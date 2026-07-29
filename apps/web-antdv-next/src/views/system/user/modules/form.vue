<script lang="ts" setup>
import type { SystemUserApi } from '#/api/system/user';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createUser, resetUserPassword, updateUser } from '#/api/system/user';
import { $t } from '#/locales';

import { buildSystemUserFormSubmission, useFormSchema } from '../data';

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
    const submission = buildSystemUserFormSubmission(values, id.value);

    drawerApi.lock();
    try {
      if (submission.mode === 'create') {
        await createUser(submission.user);
      } else {
        await updateUser(id.value as string, submission.user);
        if (submission.passwordReset) {
          await resetUserPassword(id.value as string, submission.passwordReset);
        }
      }
      emit('success');
      drawerApi.close();
    } finally {
      drawerApi.lock(false);
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;

    const data = drawerApi.getData<SystemUserApi.SystemUser>();
    formData.value = data || undefined;
    id.value = data?.id;
    formApi.setState({
      schema: useFormSchema(Boolean(data?.id)),
    });
    await formApi.resetForm();
    await formApi.setValues({
      ...data,
      homePath: data?.homePath || '/analytics',
      password: '',
      resetPassword: false,
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
