import type { CrepeConfig } from '@milkdown/crepe';

import type { CSSProperties, PropType } from 'vue';

import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from 'vue';

import { Crepe, CrepeFeature } from '@milkdown/crepe';

import '@milkdown/crepe/theme/frame.css';
import './KtMilkdownEditor.scss';

export type KtMilkdownEventRegistrar = Parameters<Crepe['on']>[0];
export type KtMilkdownCrepeOptions = Partial<
  Omit<CrepeConfig, 'defaultValue' | 'featureConfigs' | 'features' | 'root'>
>;

export interface KtMilkdownEditorExpose {
  getEditor: () => Crepe | null;
  getMarkdown: () => string;
  recreate: (value?: string) => Promise<void>;
  setReadonly: (value: boolean) => void;
}

function toCssSize(value?: number | string) {
  if (value === undefined || value === null || value === '') return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

function toEventRegistrars(
  value?: KtMilkdownEventRegistrar | KtMilkdownEventRegistrar[],
) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default defineComponent({
  name: 'KtMilkdownEditor',
  props: {
    disabled: {
      default: false,
      type: Boolean,
    },
    crepeOptions: {
      default: undefined,
      type: Object as PropType<KtMilkdownCrepeOptions>,
    },
    featureConfigs: {
      default: undefined,
      type: Object as PropType<CrepeConfig['featureConfigs']>,
    },
    features: {
      default: undefined,
      type: Object as PropType<CrepeConfig['features']>,
    },
    minHeight: {
      default: 360,
      type: [Number, String] as PropType<number | string>,
    },
    modelValue: {
      default: '',
      type: String,
    },
    placeholder: {
      default: '请输入 Markdown 内容',
      type: String,
    },
    registerEvents: {
      default: undefined,
      type: [Array, Function] as PropType<
        KtMilkdownEventRegistrar | KtMilkdownEventRegistrar[]
      >,
    },
    readonly: {
      default: false,
      type: Boolean,
    },
  },
  emits: {
    blur: () => true,
    change: (_value: string, _previousValue: string) => true,
    created: (_editor: Crepe) => true,
    destroyed: () => true,
    error: (_error: unknown) => true,
    focus: () => true,
    'update:modelValue': (_value: string) => true,
  },
  setup(props, { emit, expose }) {
    const rootRef = ref<HTMLDivElement | null>(null);
    const editor = shallowRef<Crepe | null>(null);
    const currentMarkdown = ref(props.modelValue || '');
    const loading = ref(false);
    let createVersion = 0;

    const readonlyState = computed(() => props.readonly || props.disabled);
    const editorStyle = computed<CSSProperties>(() => ({
      '--kt-milkdown-min-height': toCssSize(props.minHeight),
    }));

    async function destroyEditor() {
      const currentEditor = editor.value;
      editor.value = null;

      if (!currentEditor) return;
      await currentEditor.destroy();
      emit('destroyed');
    }

    function registerEditorEvents(nextEditor: Crepe) {
      nextEditor.on((listener) => {
        listener.markdownUpdated((_ctx, markdown, previousMarkdown) => {
          if (markdown === previousMarkdown) return;
          currentMarkdown.value = markdown;
          emit('update:modelValue', markdown);
          emit('change', markdown, previousMarkdown);
        });
        listener.focus(() => emit('focus'));
        listener.blur(() => emit('blur'));
      });

      for (const register of toEventRegistrars(props.registerEvents)) {
        nextEditor.on(register);
      }
    }

    async function createEditor(markdown = props.modelValue ?? '') {
      const root = rootRef.value;
      if (!root) return;

      const version = (createVersion += 1);
      loading.value = true;

      try {
        await destroyEditor();
        root.innerHTML = '';
        currentMarkdown.value = markdown;

        const nextEditor = new Crepe({
          ...props.crepeOptions,
          defaultValue: markdown,
          featureConfigs: {
            ...props.featureConfigs,
            [CrepeFeature.Placeholder]: {
              mode: 'block',
              text: props.placeholder,
              ...props.featureConfigs?.[CrepeFeature.Placeholder],
            },
          },
          features: {
            [CrepeFeature.AI]: false,
            [CrepeFeature.TopBar]: true,
            ...props.features,
          },
          root,
        });

        registerEditorEvents(nextEditor);
        await nextEditor.create();
        nextEditor.setReadonly(readonlyState.value);

        if (version !== createVersion) {
          await nextEditor.destroy();
          return;
        }

        editor.value = nextEditor;
        emit('created', nextEditor);
      } catch (error) {
        emit('error', error);
      } finally {
        if (version === createVersion) {
          loading.value = false;
        }
      }
    }

    function setReadonly(value: boolean) {
      editor.value?.setReadonly(value);
    }

    expose({
      getEditor: () => editor.value,
      getMarkdown: () => editor.value?.getMarkdown() || currentMarkdown.value,
      recreate: createEditor,
      setReadonly,
    } satisfies KtMilkdownEditorExpose);

    watch(
      rootRef,
      async (root) => {
        if (!root) return;
        await nextTick();
        await createEditor(props.modelValue ?? '');
      },
      { immediate: true },
    );

    watch(
      () => props.modelValue,
      async (value = '') => {
        if (value === currentMarkdown.value) return;
        await createEditor(value);
      },
    );

    watch(readonlyState, (value) => {
      setReadonly(value);
    });

    watch(
      () => [
        props.placeholder,
        props.features,
        props.featureConfigs,
        props.registerEvents,
        props.crepeOptions,
      ],
      async () => {
        await createEditor(currentMarkdown.value);
      },
      { deep: true },
    );

    onBeforeUnmount(async () => {
      createVersion += 1;
      await destroyEditor();
    });

    return () => (
      <div
        class={[
          'kt-milkdown-editor',
          {
            'kt-milkdown-editor--disabled': readonlyState.value,
            'kt-milkdown-editor--loading': loading.value,
          },
        ]}
        style={editorStyle.value}
      >
        <div class="kt-milkdown-editor__root" ref={rootRef} />
        {loading.value ? (
          <div class="kt-milkdown-editor__placeholder">编辑器加载中...</div>
        ) : null}
      </div>
    );
  },
});
