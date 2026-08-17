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

import '@milkdown/crepe/theme/common/style.css';
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

/**
 * 将数字尺寸转换为像素值，字符串尺寸保持原样，空值回退为 undefined。
 *
 * @param value - 编辑器宽高值；数字转换为像素，字符串原样使用，空值返回 undefined。
 * @returns 可直接用于 CSS 的尺寸字符串；输入为空时返回 undefined。
 */
function toCssSize(value?: number | string) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') {
    return `${value}px`;
  }
  return value;
}

/**
 * 把事件名称集合转换为订阅注册器，统一管理监听与取消函数。
 *
 * @param value - 单个或多个编辑器事件名；空值表示不注册事件。
 * @returns 与每个事件名对应的订阅注册器数组；输入为空时返回空数组。
 */
function toEventRegistrars(
  value?: KtMilkdownEventRegistrar | KtMilkdownEventRegistrar[],
) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
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

    /**
     * 销毁当前 Milkdown 编辑器、清空容器与引用，并使在途创建任务失效。
     */
    async function destroyEditor() {
      const currentEditor = editor.value;
      editor.value = null;

      if (!currentEditor) return;
      await currentEditor.destroy();
      emit('destroyed');
    }

    /**
     * 把 Milkdown 内容、焦点与失焦事件转发给组件，并注册调用方扩展监听器。
     *
     * @param nextEditor - 刚创建、需要注册事件的 Milkdown 编辑器实例。
     */
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

    /**
     * 销毁旧 Milkdown 实例后按最新 Markdown 创建编辑器；过期创建任务会自行销毁而不覆盖当前实例。
     *
     * @param markdown - 文章或编辑器当前使用的 Markdown 源文本；未传入时使用 `props.modelValue ?? ''`。
     */
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

    /**
     * 把当前 Milkdown 编辑器切换为只读或可编辑；编辑器尚未创建时保持待初始化状态。
     *
     * @param value - 编辑器新的只读标志；true 时禁止修改正文。
     */
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
        {(() => {
          if (loading.value) {
            return (
              <div class="kt-milkdown-editor__placeholder">编辑器加载中...</div>
            );
          }
          return null;
        })()}
      </div>
    );
  },
});
