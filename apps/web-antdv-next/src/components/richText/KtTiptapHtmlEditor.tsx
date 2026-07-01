import type { Editor } from '@tiptap/vue-3';

import type { CSSProperties, PropType, VNodeChild } from 'vue';

import { computed, defineComponent, onBeforeUnmount, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import { Button, Divider, Input, Modal, Space, Tooltip } from 'antdv-next';

import './KtTiptapHtmlEditor.scss';

const AButton = Button as any;
const ADivider = Divider as any;
const AInput = Input as any;
const AModal = Modal as any;
const ASpace = Space as any;
const ATooltip = Tooltip as any;
const TiptapEditorContent = EditorContent as any;

export type KtTiptapHtmlEditorEmit = {
  blur: [];
  change: [value: string, previousValue: string];
  focus: [];
  'update:modelValue': [value: string];
};

export interface KtTiptapHtmlEditorExpose {
  getEditor: () => Editor | null;
  getHtml: () => string;
  setHtml: (value: string) => void;
}

export interface KtTiptapHtmlEditorProps {
  disabled?: boolean;
  minHeight?: number | string;
  modelValue?: string;
  placeholder?: string;
  readonly?: boolean;
}

type ToolbarCommandKey =
  | 'align-center'
  | 'align-left'
  | 'align-right'
  | 'blockquote'
  | 'bold'
  | 'bullet-list'
  | 'code-block'
  | 'heading-2'
  | 'image'
  | 'italic'
  | 'link'
  | 'ordered-list'
  | 'redo'
  | 'table'
  | 'underline'
  | 'undo';

type ToolbarCommand = {
  icon: string;
  isActive?: (editor: Editor) => boolean;
  key: ToolbarCommandKey;
  run: (editor: Editor) => void;
  title: string;
};

/**
 * 将数字高度转换为 CSS 长度，字符串保持原样。
 *
 * @param value 组件 minHeight 入参，支持像素数字或 CSS 长度字符串。
 * @returns 可写入 CSS 变量的长度值。
 */
function toCssSize(value?: number | string) {
  if (value === undefined || value === null || value === '') return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

/**
 * 读取编辑器当前 HTML，编辑器未初始化时回退到缓存值。
 *
 * @param editor 当前 Tiptap 编辑器实例。
 * @param fallback 编辑器不可用时返回的 HTML。
 * @returns 当前可提交给父级的 HTML。
 */
function readEditorHtml(editor: Editor | null | undefined, fallback: string) {
  return editor?.getHTML() || fallback;
}

/**
 * 渲染工具栏图标，统一使用 Iconify 图标来源。
 *
 * @param icon 图标名称，遵循 Vben/Iconify 的 lucide 命名。
 * @returns 图标节点。
 */
const renderIcon = (icon: string) => (
  <IconifyIcon class="kt-tiptap-editor__toolbar-icon" icon={icon} />
);

export default defineComponent({
  name: 'KtTiptapHtmlEditor',
  props: {
    disabled: {
      default: false,
      type: Boolean,
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
      default: '请输入正文内容',
      type: String,
    },
    readonly: {
      default: false,
      type: Boolean,
    },
  },
  emits: {
    blur: () => true,
    change: (_value: string, _previousValue: string) => true,
    focus: () => true,
    'update:modelValue': (_value: string) => true,
  },
  /**
   * 初始化 Tiptap HTML 编辑器，桥接 toolbar 命令、v-model 和 expose API。
   *
   * @param props 组件入参，包含 HTML、禁用态、占位符和最小高度。
   * @param context Vue setup context，用于发送编辑器事件并暴露实例方法。
   * @param context.emit 组件事件发送器，用于同步 HTML、change、focus 和 blur。
   * @param context.expose 组件方法暴露器，用于公开编辑器实例与 HTML 读写方法。
   */
  setup(props, { emit, expose }) {
    const currentHtml = ref(props.modelValue || '');
    const linkModalOpen = ref(false);
    const linkValue = ref('');
    const imageModalOpen = ref(false);
    const imageValue = ref('');

    const readonlyState = computed(() => props.disabled || props.readonly);
    const editorStyle = computed<CSSProperties>(() => ({
      '--kt-tiptap-min-height': toCssSize(props.minHeight),
    }));

    /**
     * 将编辑器 HTML 变更同步给父级，避免重复值产生循环事件。
     *
     * @param nextHtml 最新 HTML。
     * @param previousHtml 变更前 HTML，用于 change 事件。
     */
    function emitHtmlChange(
      nextHtml: string,
      previousHtml = currentHtml.value,
    ) {
      if (nextHtml === previousHtml) {
        currentHtml.value = nextHtml;
        return;
      }

      currentHtml.value = nextHtml;
      emit('update:modelValue', nextHtml);
      emit('change', nextHtml, previousHtml);
    }

    const editor = useEditor({
      content: currentHtml.value,
      editable: !readonlyState.value,
      editorProps: {
        attributes: {
          class: 'kt-tiptap-editor__prosemirror',
        },
      },
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
          link: false,
          underline: false,
        }),
        Link.configure({
          autolink: true,
          defaultProtocol: 'https',
          openOnClick: false,
        }),
        Image.configure({
          allowBase64: true,
          inline: false,
        }),
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        Underline,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        Placeholder.configure({
          placeholder: props.placeholder,
        }),
      ],
      onBlur: () => emit('blur'),
      onFocus: () => emit('focus'),
      onUpdate: ({ editor }) => {
        emitHtmlChange(editor.getHTML());
      },
    });

    /**
     * 判断工具栏命令是否应禁用。
     *
     * @returns true 表示编辑器不可编辑或尚未初始化。
     */
    function isToolbarDisabled() {
      return readonlyState.value || !editor.value;
    }

    /**
     * 运行需要可编辑实例的命令。
     *
     * @param command 当前工具栏命令。
     */
    function runToolbarCommand(command: ToolbarCommand) {
      const currentEditor = editor.value;
      if (!currentEditor || readonlyState.value) return;
      command.run(currentEditor);
    }

    /**
     * 打开链接编辑弹窗，并预填当前选区链接。
     */
    function openLinkModal() {
      const currentEditor = editor.value;
      if (!currentEditor || readonlyState.value) return;

      linkValue.value = currentEditor.getAttributes('link')?.href || '';
      linkModalOpen.value = true;
    }

    /**
     * 将链接弹窗中的 URL 应用到当前选区。
     */
    function confirmLink() {
      const currentEditor = editor.value;
      if (!currentEditor) return;

      const href = linkValue.value.trim();
      if (href) {
        currentEditor
          .chain()
          .focus()
          .extendMarkRange('link')
          .setLink({ href })
          .run();
      } else {
        currentEditor.chain().focus().extendMarkRange('link').unsetLink().run();
      }
      linkModalOpen.value = false;
    }

    /**
     * 打开图片插入弹窗并清空上一轮输入。
     */
    function openImageModal() {
      if (!editor.value || readonlyState.value) return;
      imageValue.value = '';
      imageModalOpen.value = true;
    }

    /**
     * 将图片 URL 插入当前光标位置。
     */
    function confirmImage() {
      const currentEditor = editor.value;
      const src = imageValue.value.trim();
      if (!currentEditor || !src) {
        imageModalOpen.value = false;
        return;
      }

      currentEditor.chain().focus().setImage({ src }).run();
      imageModalOpen.value = false;
    }

    const toolbarCommands: ToolbarCommand[] = [
      {
        icon: 'lucide:bold',
        isActive: (editor) => editor.isActive('bold'),
        key: 'bold',
        run: (editor) => editor.chain().focus().toggleBold().run(),
        title: '加粗',
      },
      {
        icon: 'lucide:italic',
        isActive: (editor) => editor.isActive('italic'),
        key: 'italic',
        run: (editor) => editor.chain().focus().toggleItalic().run(),
        title: '斜体',
      },
      {
        icon: 'lucide:underline',
        isActive: (editor) => editor.isActive('underline'),
        key: 'underline',
        run: (editor) => editor.chain().focus().toggleUnderline().run(),
        title: '下划线',
      },
      {
        icon: 'lucide:heading-2',
        isActive: (editor) => editor.isActive('heading', { level: 2 }),
        key: 'heading-2',
        run: (editor) =>
          editor.chain().focus().toggleHeading({ level: 2 }).run(),
        title: '二级标题',
      },
      {
        icon: 'lucide:list',
        isActive: (editor) => editor.isActive('bulletList'),
        key: 'bullet-list',
        run: (editor) => editor.chain().focus().toggleBulletList().run(),
        title: '无序列表',
      },
      {
        icon: 'lucide:list-ordered',
        isActive: (editor) => editor.isActive('orderedList'),
        key: 'ordered-list',
        run: (editor) => editor.chain().focus().toggleOrderedList().run(),
        title: '有序列表',
      },
      {
        icon: 'lucide:quote',
        isActive: (editor) => editor.isActive('blockquote'),
        key: 'blockquote',
        run: (editor) => editor.chain().focus().toggleBlockquote().run(),
        title: '引用',
      },
      {
        icon: 'lucide:code-2',
        isActive: (editor) => editor.isActive('codeBlock'),
        key: 'code-block',
        run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
        title: '代码块',
      },
      {
        icon: 'lucide:align-left',
        isActive: (editor) => editor.isActive({ textAlign: 'left' }),
        key: 'align-left',
        run: (editor) => editor.chain().focus().setTextAlign('left').run(),
        title: '左对齐',
      },
      {
        icon: 'lucide:align-center',
        isActive: (editor) => editor.isActive({ textAlign: 'center' }),
        key: 'align-center',
        run: (editor) => editor.chain().focus().setTextAlign('center').run(),
        title: '居中',
      },
      {
        icon: 'lucide:align-right',
        isActive: (editor) => editor.isActive({ textAlign: 'right' }),
        key: 'align-right',
        run: (editor) => editor.chain().focus().setTextAlign('right').run(),
        title: '右对齐',
      },
      {
        icon: 'lucide:link',
        isActive: (editor) => editor.isActive('link'),
        key: 'link',
        run: openLinkModal,
        title: '链接',
      },
      {
        icon: 'lucide:image',
        key: 'image',
        run: openImageModal,
        title: '图片',
      },
      {
        icon: 'lucide:table',
        key: 'table',
        run: (editor) =>
          editor
            .chain()
            .focus()
            .insertTable({ cols: 3, rows: 3, withHeaderRow: true })
            .run(),
        title: '表格',
      },
      {
        icon: 'lucide:undo-2',
        key: 'undo',
        run: (editor) => editor.chain().focus().undo().run(),
        title: '撤销',
      },
      {
        icon: 'lucide:redo-2',
        key: 'redo',
        run: (editor) => editor.chain().focus().redo().run(),
        title: '重做',
      },
    ];

    /**
     * 渲染一个工具栏命令按钮。
     *
     * @param command 当前命令配置。
     * @returns 工具栏按钮节点。
     */
    const renderCommandButton = (command: ToolbarCommand): VNodeChild => {
      const currentEditor = editor.value;
      const active = currentEditor ? command.isActive?.(currentEditor) : false;

      return (
        <ATooltip key={command.key} title={command.title}>
          <AButton
            aria-label={command.title}
            class={[
              'kt-tiptap-editor__toolbar-button',
              active ? 'kt-tiptap-editor__toolbar-button--active' : '',
            ]}
            data-kt-tiptap-command={command.key}
            disabled={isToolbarDisabled()}
            onClick={() => runToolbarCommand(command)}
            shape="circle"
            type="text"
          >
            {renderIcon(command.icon)}
          </AButton>
        </ATooltip>
      );
    };

    /**
     * 渲染格式工具栏，按文本、段落、插入、历史分组。
     */
    const renderToolbar = () => {
      const groups = [
        toolbarCommands.slice(0, 4),
        toolbarCommands.slice(4, 8),
        toolbarCommands.slice(8, 11),
        toolbarCommands.slice(11, 14),
        toolbarCommands.slice(14),
      ];

      return (
        <div class="kt-tiptap-editor__toolbar">
          <ASpace size={4} wrap>
            {groups.map((group, index) => (
              <span class="kt-tiptap-editor__toolbar-group" key={index}>
                {index > 0 ? <ADivider type="vertical" /> : null}
                {group.map((command) => renderCommandButton(command))}
              </span>
            ))}
          </ASpace>
        </div>
      );
    };

    /**
     * 渲染链接与图片输入弹窗。
     */
    const renderModals = () => (
      <>
        <AModal
          destroyOnHidden
          okText="应用"
          onCancel={() => {
            linkModalOpen.value = false;
          }}
          onOk={confirmLink}
          open={linkModalOpen.value}
          title="设置链接"
        >
          <AInput
            allowClear
            placeholder="https://example.com"
            v-model:value={linkValue.value}
          />
        </AModal>
        <AModal
          destroyOnHidden
          okText="插入"
          onCancel={() => {
            imageModalOpen.value = false;
          }}
          onOk={confirmImage}
          open={imageModalOpen.value}
          title="插入图片"
        >
          <AInput
            allowClear
            placeholder="https://example.com/image.png"
            v-model:value={imageValue.value}
          />
        </AModal>
      </>
    );

    /**
     * 返回当前编辑器实例。
     */
    function getEditor() {
      return editor.value || null;
    }

    /**
     * 读取当前 HTML。
     */
    function getHtml() {
      return readEditorHtml(editor.value, currentHtml.value);
    }

    /**
     * 通过 Tiptap 重新设置 HTML，并把规范化结果同步给父级。
     *
     * @param value 需要写入编辑器的 HTML 字符串。
     */
    function setHtml(value: string) {
      const currentEditor = editor.value;
      const previousHtml = currentHtml.value;
      if (!currentEditor) {
        emitHtmlChange(value, previousHtml);
        return;
      }

      currentEditor.commands.setContent(value);
      emitHtmlChange(readEditorHtml(currentEditor, value), previousHtml);
    }

    expose({
      getEditor,
      getHtml,
      setHtml,
    } satisfies KtTiptapHtmlEditorExpose);

    watch(
      () => props.modelValue,
      (value = '') => {
        const nextHtml = value || '';
        if (nextHtml === currentHtml.value) return;

        currentHtml.value = nextHtml;
        editor.value?.commands.setContent(nextHtml);
      },
    );

    watch(readonlyState, (value) => {
      editor.value?.setEditable(!value);
    });

    onBeforeUnmount(() => {
      editor.value?.destroy();
    });

    return () => (
      <div
        class={[
          'kt-tiptap-editor',
          readonlyState.value ? 'kt-tiptap-editor--disabled' : '',
        ]}
        style={editorStyle.value}
      >
        {renderToolbar()}
        <div class="kt-tiptap-editor__content">
          <TiptapEditorContent editor={editor.value} />
        </div>
        {renderModals()}
      </div>
    );
  },
});
