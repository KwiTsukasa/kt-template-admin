import type { PropType } from 'vue';

import { defineComponent } from 'vue';

import { Input, Modal } from 'antdv-next';

const AModal = Modal as any;
const AInput = Input as any;

export default defineComponent({
  name: 'QqBotPluginManifestModal',
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
    return () => (
      <AModal
        confirmLoading={props.loading}
        onCancel={() => emit('close')}
        onOk={() => emit('submit')}
        open={props.open}
        title={props.title}
        width={760}
      >
        {props.mode === 'validate' ? (
          <textarea
            class="w-full resize-y rounded border border-solid border-gray-200 p-3 font-mono text-sm outline-none"
            onInput={(event) => {
              emit('update:value', (event.target as HTMLTextAreaElement).value);
            }}
            rows={18}
            value={props.value}
          />
        ) : (
          <div class="space-y-3">
            <label class="block">
              <span class="mb-1 block text-sm text-gray-600">插件包路径</span>
              <AInput
                onUpdate:value={(value: string) => {
                  emit('update:packagePath', value);
                }}
                placeholder=".kt-workspace/qqbot-plugin-packages/demo.qqbot-plugin.json"
                value={props.packagePath}
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-sm text-gray-600">包 Hash</span>
              <AInput
                onUpdate:value={(value: string) => {
                  emit('update:packageHash', value);
                }}
                placeholder="上传校验可留空，安装时用于校验包内容"
                value={props.packageHash}
              />
            </label>
          </div>
        )}
      </AModal>
    );
  },
});
