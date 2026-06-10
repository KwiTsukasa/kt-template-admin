<script lang="ts" setup>
import type { SystemNoticeApi } from '#/api/system/notice';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { createNotice, updateNotice } from '#/api/system/notice';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<Partial<SystemNoticeApi.NoticeItem>>();
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('system.notice.name')])
    : $t('ui.actionTitle.create', [$t('system.notice.name')]);
});

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    modalApi.lock();
    const data = (await formApi.getValues()) as SystemNoticeApi.NoticeInput;

    try {
      const currentId = formData.value?.id;
      await (currentId ? updateNotice(currentId, data) : createNotice(data));
      modalApi.close();
      emit('success');
    } finally {
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = modalApi.getData<Partial<SystemNoticeApi.NoticeItem>>();
    formData.value = data || undefined;
    resetForm();
  },
});

function getFormValues() {
  return {
    content: formData.value?.content || '',
    isTop: formData.value?.isTop ?? false,
    level: formData.value?.level ?? 1,
    notifyUsers: formData.value?.notifyUsers || '',
    status: formData.value?.status ?? 1,
    summary: formData.value?.summary || '',
    title: formData.value?.title || '',
  };
}

function resetForm() {
  formApi.resetForm();
  formApi.setValues(getFormValues());
}
</script>

<template>
  <Modal :title="getTitle">
    <Form class="mx-4" />
    <template #prepend-footer>
      <div class="flex-auto">
        <Button type="primary" danger @click="resetForm">
          {{ $t('common.reset') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
