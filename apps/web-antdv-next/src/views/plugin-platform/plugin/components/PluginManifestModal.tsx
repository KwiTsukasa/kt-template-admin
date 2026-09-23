import type { PropType } from 'vue';

import {
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onDeactivated,
  watch,
} from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm, z } from '#/adapter/form';
import { useModalSessionIntent } from '#/hooks/useModalSessionIntent';

interface ManifestFormValues {
  manifest: string;
}

interface PackageFormValues {
  packageHash: string;
  packagePath: string;
}

interface ManifestSessionValues {
  manifest: string;
  mode: 'install' | 'upload' | 'validate';
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
    const session = useModalSessionIntent();
    let initializationStartedRevision: number | undefined;
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
        try {
          await submit();
        } catch {
          // 表单层呈现校验错误；旧会话不得冒充提交成功。
        }
      },
      /**
       * 打开时按校验或包操作模式恢复对应表单，关闭时同步外部受控状态以避免双状态源分叉。
       *
       * @param isOpen - 通用 Modal 最新显隐状态。
       */
      onOpenChange(isOpen: boolean) {
        if (isOpen) {
          const revision = session.current();
          if (session.isCurrent(revision))
            void initializeActiveForm(revision, snapshotValues());
          return;
        }
        session.invalidate();
        if (props.open) emit('close');
      },
    });

    watch(
      () => [props.open, props.mode] as const,
      async () => {
        if (!props.open) {
          session.invalidate();
          await modalApi.close();
          return;
        }
        const revision = session.begin();
        const values = snapshotValues();
        modalApi.open();
        void nextTick(() => {
          if (session.isCurrent(revision))
            void initializeActiveForm(revision, values);
        });
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

    onDeactivated(() => session.invalidate());
    onBeforeUnmount(() => session.dispose());

    /**
     * 固定打开时的插件模式与字段，避免旧表单重置阶段读取下一模式输入。
     * @returns 本次弹窗会话使用的 Manifest 或包路径初值。
     */
    function snapshotValues(): ManifestSessionValues {
      return {
        manifest: props.value,
        mode: props.mode,
        packageHash: props.packageHash,
        packagePath: props.packagePath,
      };
    }

    /**
     * 同一会话只恢复一次对应表单，旧模式初始化完成不得覆盖新模式。
     * @param revision - 打开或切换插件模式时固定的会话身份。
     * @param values - 该轮模式及字段快照。
     */
    async function initializeActiveForm(
      revision: number,
      values: ManifestSessionValues,
    ) {
      if (
        !session.isCurrent(revision) ||
        initializationStartedRevision === revision
      )
        return;
      initializationStartedRevision = revision;
      await resetActiveForm(revision, values);
    }

    /**
     * 在插件 Modal 已挂载后按当前模式恢复 Manifest 或插件包 VbenForm。
     * @param revision - 当前插件弹窗会话身份。
     * @param values - 打开时固定的模式和字段初值。
     */
    async function resetActiveForm(
      revision: number,
      values: ManifestSessionValues,
    ) {
      await session.initialize(revision, async (stillCurrent) => {
        if (values.mode === 'validate') {
          await manifestFormApi.resetForm();
          if (!stillCurrent()) return;
          await manifestFormApi.setValues({
            manifest: values.manifest,
          } satisfies ManifestFormValues);
          if (!stillCurrent()) return;
          await manifestFormApi.resetValidate();
          return;
        }
        await packageFormApi.resetForm();
        if (!stillCurrent()) return;
        await packageFormApi.setValues({
          packageHash: values.packageHash,
          packagePath: values.packagePath,
        } satisfies PackageFormValues);
        if (!stillCurrent()) return;
        await packageFormApi.resetValidate();
      });
    }

    /**
     * 把当前模式对应的 VbenForm 值同步回父页面，再沿用原 submit 事件发起业务请求。
     */
    async function submit() {
      const revision = session.current();
      if (!session.claimConfirm(revision)) return;
      const mode = props.mode;
      try {
        if (mode === 'validate') {
          const { valid } = await manifestFormApi.validate();
          if (!valid || !session.isCurrent(revision)) return;
          const values = await manifestFormApi.getValues<ManifestFormValues>();
          if (!session.isCurrent(revision)) return;
          emit('update:value', values.manifest);
          emit('submit');
          return;
        }
        const { valid } = await packageFormApi.validate();
        if (!valid || !session.isCurrent(revision)) return;
        const values = await packageFormApi.getValues<PackageFormValues>();
        if (!session.isCurrent(revision)) return;
        emit('update:packagePath', values.packagePath);
        emit('update:packageHash', values.packageHash);
        emit('submit');
      } finally {
        session.releaseConfirm(revision);
      }
    }

    return () => {
      let Form = PackageForm;
      if (props.mode === 'validate') Form = ManifestForm;
      return (
        <Modal
          confirmDisabled={!session.ready.value || props.loading}
          title={props.title}
        >
          <Form />
        </Modal>
      );
    };
  },
});
