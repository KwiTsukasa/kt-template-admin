import type { PropType } from 'vue';

import { defineComponent, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm, z } from '#/adapter/form';

interface ManifestFormValues {
  manifest: string;
}

interface PackageFormValues {
  packageHash: string;
  packagePath: string;
}

export default defineComponent({
  name: 'PluginPlatformManifestModal',
  props: {
    loading: {
      default: false,
      type: Boolean,
    },
    open: {
      default: false,
      type: Boolean,
    },
    mode: {
      default: 'validate',
      type: String as PropType<'install' | 'upload' | 'validate'>,
    },
    packageHash: {
      default: '',
      type: String,
    },
    packagePath: {
      default: '',
      type: String,
    },
    title: {
      default: '',
      type: String,
    },
    value: {
      default: '',
      type: String,
    },
  },
  emits: [
    'close',
    'submit',
    'update:packageHash',
    'update:packagePath',
    'update:value',
  ],
  setup(props, { emit }) {
    const [ManifestForm, manifestFormApi] = useVbenForm({
      layout: 'vertical',
      schema: [
        {
          component: 'Textarea',
          componentProps: {
            class: 'font-mono',
            rows: 18,
          },
          fieldName: 'manifest',
          hideLabel: true,
          label: 'Manifest JSON',
          rules: z.string().trim().min(1, '请输入 Manifest JSON'),
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const [PackageForm, packageFormApi] = useVbenForm({
      layout: 'vertical',
      schema: [
        {
          component: 'Input',
          componentProps: {
            allowClear: true,
            maxlength: 500,
            placeholder:
              '.kt-workspace/bot-plugin-packages/demo.bot-plugin.json',
          },
          fieldName: 'packagePath',
          label: '插件包路径',
          rules: z.string().trim().min(1, '请输入受控插件包路径').max(500),
        },
        {
          component: 'Input',
          componentProps: {
            allowClear: true,
            maxlength: 128,
            placeholder: '上传校验可留空，安装时用于校验包内容',
          },
          fieldName: 'packageHash',
          label: '包 Hash',
          rules: z.string().trim().max(128).optional().or(z.literal('')),
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const [Modal, modalApi] = useVbenModal({
      class: 'w-[760px]',
      fullscreenButton: false,
      /**
       * 确认插件弹窗时校验当前模式对应的 VbenForm，并按原受控事件合同提交字段。
       */
      async onConfirm() {
        await submit();
      },
      /**
       * 打开时按校验或包操作模式恢复对应表单，关闭时同步外部受控状态以避免双状态源分叉。
       *
       * @param isOpen - 通用 Modal 最新显隐状态。
       */
      onOpenChange(isOpen: boolean) {
        if (isOpen) {
          void resetActiveForm();
          return;
        }
        if (props.open) emit('close');
      },
    });

    watch(
      () => props.open,
      async () => {
        if (!props.open) {
          await modalApi.close();
          return;
        }
        modalApi.open();
      },
      { immediate: true },
    );

    watch(
      () => props.loading,
      (loading) => {
        if (loading) {
          modalApi.lock();
          return;
        }
        modalApi.unlock();
      },
      { immediate: true },
    );

    /**
     * 在插件 Modal 已挂载后按当前模式恢复 Manifest 或插件包 VbenForm。
     */
    async function resetActiveForm() {
      if (props.mode === 'validate') {
        await manifestFormApi.resetForm();
        await manifestFormApi.setValues({
          manifest: props.value,
        } satisfies ManifestFormValues);
        await manifestFormApi.resetValidate();
        return;
      }
      await packageFormApi.resetForm();
      await packageFormApi.setValues({
        packageHash: props.packageHash,
        packagePath: props.packagePath,
      } satisfies PackageFormValues);
      await packageFormApi.resetValidate();
    }

    /**
     * 把当前模式对应的 VbenForm 值同步回父页面，再沿用原 submit 事件发起业务请求。
     */
    async function submit() {
      if (props.mode === 'validate') {
        const { valid } = await manifestFormApi.validate();
        if (!valid) return;
        const values = await manifestFormApi.getValues<ManifestFormValues>();
        emit('update:value', values.manifest);
        emit('submit');
        return;
      }
      const { valid } = await packageFormApi.validate();
      if (!valid) return;
      const values = await packageFormApi.getValues<PackageFormValues>();
      emit('update:packagePath', values.packagePath);
      emit('update:packageHash', values.packageHash);
      emit('submit');
    }

    return () => {
      let Form = PackageForm;
      if (props.mode === 'validate') Form = ManifestForm;
      return (
        <Modal title={props.title}>
          <Form />
        </Modal>
      );
    };
  },
});
