/* @vitest-environment happy-dom */
/* eslint-disable vue/one-component-per-file */

import type { ComponentPublicInstance, Ref } from 'vue';

import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import KtTiptapHtmlEditor from './KtTiptapHtmlEditor';

type FakeEditorOptions = {
  content?: string;
  editable?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
  onUpdate?: (payload: { editor: FakeEditor }) => void;
};

type TiptapExpose = ComponentPublicInstance & {
  getHtml: () => string;
  setHtml: (value: string) => void;
};

/**
 * 模拟 Tiptap Editor 的最小行为，支持组件测试 HTML 同步和禁用态。
 */
class FakeEditor {
  public html = '';

  public commands = {
    focus: () => true,
    setContent: (value: string) => {
      this.html = value;
      return true;
    },
  };

  public destroyed = false;

  public editable = true;

  public options: FakeEditorOptions;

  /**
   * 记录传入配置并初始化测试用 HTML。
   *
   * @param options 编辑器初始化配置，测试只关心内容、可编辑态和更新回调。
   */
  constructor(options: FakeEditorOptions) {
    this.options = options;
    this.html = options.content || '';
    this.editable = options.editable !== false;
  }

  public chain = () => ({
    focus: () => ({
      run: () => true,
      setImage: ({ src }: { src: string }) => ({
        run: () => {
          this.html = `<img src="${src}">`;
          this.options.onUpdate?.({ editor: this });
          return true;
        },
      }),
      setLink: ({ href }: { href: string }) => ({
        run: () => {
          this.html = `<p><a href="${href}">${href}</a></p>`;
          this.options.onUpdate?.({ editor: this });
          return true;
        },
      }),
      toggleBold: () => ({
        run: () => {
          this.html = '<p><strong>粗体</strong></p>';
          this.options.onUpdate?.({ editor: this });
          return true;
        },
      }),
    }),
  });

  /**
   * 标记编辑器已销毁，便于组件卸载路径保持可调用。
   */
  public destroy() {
    this.destroyed = true;
  }

  /**
   * 返回当前 HTML，模拟 Tiptap 的 getHTML。
   */
  public getHTML() {
    return this.html;
  }

  /**
   * 查询命令激活态，测试中默认未激活。
   */
  public isActive() {
    return false;
  }

  /**
   * 同步只读状态给测试替身。
   *
   * @param value false 表示 readonly/disabled。
   */
  public setEditable(value: boolean) {
    this.editable = value;
  }
}

const editorRefs: Array<Ref<FakeEditor | null>> = [];

vi.mock('@tiptap/vue-3', () => ({
  EditorContent: defineComponent({
    name: 'MockEditorContent',
    props: {
      editor: {
        default: null,
        type: Object,
      },
    },
    /**
     * 渲染当前 FakeEditor HTML，使测试能观察组件传入内容。
     *
     * @param props EditorContent 入参，包含当前编辑器实例。
     */
    setup(props) {
      return () =>
        h('div', {
          class: 'kt-tiptap-editor__prosemirror ProseMirror',
          innerHTML: (props.editor as FakeEditor | null)?.getHTML() || '',
        });
    },
  }),
  useEditor: (options: FakeEditorOptions) => {
    const editor = ref(new FakeEditor(options));
    editorRefs.push(editor);
    return editor;
  },
}));

vi.mock('antdv-next', () => ({
  Button: defineComponent({
    name: 'MockButton',
    props: {
      disabled: Boolean,
      type: {
        default: undefined,
        type: String,
      },
    },
    emits: ['click'],
    /**
     * 用原生 button 替代 antdv-next Button，保留 attrs/disabled/click。
     *
     * @param props 按钮入参，测试只读取 disabled。
     * @param context Vue setup context，透传 attrs 和 slots。
     * @param context.attrs 透传到原生 button 的属性。
     * @param context.emit click 事件发送器。
     * @param context.slots 按钮默认插槽。
     */
    setup(props, { attrs, emit, slots }) {
      return () =>
        h(
          'button',
          {
            ...attrs,
            disabled: props.disabled,
            onClick: () => emit('click'),
            type: 'button',
          },
          slots.default?.(),
        );
    },
  }),
  Divider: defineComponent({
    name: 'MockDivider',
    /**
     * 渲染工具栏分隔符占位。
     */
    setup() {
      return () => h('span', { class: 'mock-divider' });
    },
  }),
  Input: defineComponent({
    name: 'MockInput',
    props: {
      value: {
        default: '',
        type: String,
      },
    },
    emits: ['update:value'],
    /**
     * 用 input 替代 antdv-next Input，保留 value 双向更新。
     *
     * @param props 输入框入参，测试只使用 value。
     * @param context Vue setup context，发送 update:value。
     * @param context.emit update:value 事件发送器。
     */
    setup(props, { emit }) {
      return () =>
        h('input', {
          value: props.value,
          onInput: (event: Event) =>
            emit('update:value', (event.target as HTMLInputElement).value),
        });
    },
  }),
  Modal: defineComponent({
    name: 'MockModal',
    props: {
      open: Boolean,
      title: {
        default: '',
        type: String,
      },
    },
    emits: ['cancel', 'ok', 'update:open'],
    /**
     * 模拟 Modal，只在 open=true 时渲染内容。
     *
     * @param props 弹窗入参，测试仅关心 open。
     * @param context Vue setup context。
     * @param context.slots 弹窗默认插槽。
     */
    setup(props, { slots }) {
      return () =>
        props.open ? h('div', { role: 'dialog' }, slots.default?.()) : null;
    },
  }),
  Space: defineComponent({
    name: 'MockSpace',
    /**
     * 以 div 包装 Space 内容。
     *
     * @param _props 未使用的 Space props。
     * @param context Vue setup context，读取默认 slot。
     * @param context.slots Space 默认插槽。
     */
    setup(_props, { slots }) {
      return () => h('div', slots.default?.());
    },
  }),
  Tooltip: defineComponent({
    name: 'MockTooltip',
    props: {
      title: {
        default: '',
        type: String,
      },
    },
    /**
     * 直接渲染 Tooltip 默认 slot，避免测试依赖浮层实现。
     *
     * @param _props 未使用的 Tooltip props。
     * @param context Vue setup context，读取默认 slot。
     * @param context.slots Tooltip 默认插槽。
     */
    setup(_props, { slots }) {
      return () => h('span', slots.default?.());
    },
  }),
}));

vi.mock('@vben/icons', () => ({
  IconifyIcon: defineComponent({
    name: 'MockIconifyIcon',
    props: {
      icon: {
        default: '',
        type: String,
      },
    },
    /**
     * 渲染可识别的图标占位。
     *
     * @param props 图标入参，测试不读取但保留 data 属性。
     */
    setup(props) {
      return () => h('i', { 'data-icon': props.icon });
    },
  }),
}));

describe('ktTiptapHtmlEditor', () => {
  beforeEach(() => {
    editorRefs.length = 0;
  });

  it('renders incoming html content', () => {
    const wrapper = mount(KtTiptapHtmlEditor, {
      props: {
        modelValue: '<p>旧正文</p>',
      },
    });

    expect(wrapper.find('.kt-tiptap-editor__prosemirror').html()).toContain(
      '<p>旧正文</p>',
    );
  });

  it('emits normalized html from setHtml', async () => {
    const wrapper = mount(KtTiptapHtmlEditor, {
      props: {
        modelValue: '<p>旧正文</p>',
      },
    });

    (wrapper.vm as unknown as TiptapExpose).setHtml(
      '<h2>新标题</h2><p>新正文</p>',
    );
    await nextTick();

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      '<h2>新标题</h2><p>新正文</p>',
    ]);
    expect(wrapper.emitted('change')?.at(-1)).toEqual([
      '<h2>新标题</h2><p>新正文</p>',
      '<p>旧正文</p>',
    ]);
    expect((wrapper.vm as unknown as TiptapExpose).getHtml()).toBe(
      '<h2>新标题</h2><p>新正文</p>',
    );
  });

  it('marks disabled editor and disables bold command', () => {
    const wrapper = mount(KtTiptapHtmlEditor, {
      props: {
        disabled: true,
        modelValue: '<p>旧正文</p>',
      },
    });

    expect(wrapper.classes()).toContain('kt-tiptap-editor--disabled');
    expect(
      wrapper.find('[data-kt-tiptap-command="bold"]').attributes('disabled'),
    ).toBeDefined();
  });

  it('syncs setHtml changes through a v-model parent', async () => {
    const Parent = defineComponent({
      name: 'TiptapParentHarness',
      /**
       * 建立父子 v-model 绑定，验证编辑器 emit 会回写父级状态。
       */
      setup() {
        const html = ref('<p>旧正文</p>');
        const editorRef = ref<null | TiptapExpose>(null);

        return () => (
          <section>
            <KtTiptapHtmlEditor ref={editorRef} v-model={html.value} />
            <output data-testid="parent-html">{html.value}</output>
            <button
              data-testid="parent-update"
              onClick={() =>
                editorRef.value?.setHtml('<h2>新标题</h2><p>新正文</p>')
              }
              type="button"
            >
              更新
            </button>
          </section>
        );
      },
    });

    const wrapper = mount(Parent);
    await wrapper.find('[data-testid="parent-update"]').trigger('click');
    await nextTick();

    expect(wrapper.find('[data-testid="parent-html"]').text()).toBe(
      '<h2>新标题</h2><p>新正文</p>',
    );
  });
});
