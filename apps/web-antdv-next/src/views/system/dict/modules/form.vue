<script lang="ts" setup>
import type { SystemDictApi } from '#/api/system/dict';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { createDict, updateDict } from '#/api/system/dict';
import { clearDictCache } from '#/hooks/useDict';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits<{
  success: [];
}>();

const formData = ref<Partial<SystemDictApi.DictItem>>();
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('system.dict.name')])
    : $t('ui.actionTitle.create', [$t('system.dict.name')]);
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
    const data = (await formApi.getValues()) as SystemDictApi.DictInput;
    try {
      const currentId = formData.value?.id;
      await (currentId ? updateDict(currentId, data) : createDict(data));
      if (formData.value?.dictCode) clearDictCache(formData.value.dictCode);
      if (data.dictCode) clearDictCache(data.dictCode);
      modalApi.close();
      emit('success');
    } finally {
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = modalApi.getData<Partial<SystemDictApi.DictItem>>();
    formData.value = data || undefined;
    resetForm();
  },
});

function getFormValues() {
  return {
    childrenCode: formData.value?.childrenCode || undefined,
    dictCode: formData.value?.dictCode || '',
    label: formData.value?.label || '',
    sort: formData.value?.sort ?? 0,
    status: formData.value?.status ?? 1,
    value: formData.value?.value || '',
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
