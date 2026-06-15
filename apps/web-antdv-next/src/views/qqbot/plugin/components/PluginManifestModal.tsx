import { defineComponent } from 'vue';

import { Modal } from 'antdv-next';

const AModal = Modal as any;

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
    title: {
      default: '',
      type: String,
    },
    value: {
      default: '',
      type: String,
    },
  },
  emits: ['close', 'submit', 'update:value'],
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
        <textarea
          class="w-full resize-y rounded border border-solid border-gray-200 p-3 font-mono text-sm outline-none"
          onInput={(event) => {
            emit('update:value', (event.target as HTMLTextAreaElement).value);
          }}
          rows={18}
          value={props.value}
        />
      </AModal>
    );
  },
});
