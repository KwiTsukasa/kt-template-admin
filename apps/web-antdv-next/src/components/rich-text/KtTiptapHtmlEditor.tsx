import type { Editor } from '@tiptap/vue-3';

import type { CSSProperties, PropType, VNodeChild } from 'vue';

import { computed, defineComponent, onBeforeUnmount, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';
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
import { Button, Divider, Space, Tooltip } from 'antdv-next';

import { useVbenForm, z } from '#/adapter/form';

import './KtTiptapHtmlEditor.scss';

const AButton = Button as any;
const ADivider = Divider as any;
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

interface LinkFormValues {
  href: string;
}

interface ImageFormValues {
  src: string;
}

/**
 * 将数字高度转换为 CSS 长度，字符串保持原样。
 *
 * @param value - 数字像素值、CSS 长度字符串或空值。
 * @returns 数字转换成 px 字符串，字符串原样返回，空值返回 undefined。
 */
function toCssSize(value?: number | string) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') {
    return `${value}px`;
  }
  return value;
}

/**
 * 读取编辑器当前 HTML，编辑器未初始化时回退到缓存值。
 *
 * @param editor - Tiptap 编辑器实例；尚未创建时允许为空。
 * @param fallback - 编辑器尚未初始化时返回的缓存 HTML。
 * @returns 编辑器规范化后的 HTML；实例未就绪时使用 fallback。
 */
function readEditorHtml(editor: Editor | null | undefined, fallback: string) {
  return editor?.getHTML() || fallback;
}

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
  setup(props, { emit, expose }) {
    const currentHtml = ref(props.modelValue || '');

    const readonlyState = computed(() => props.disabled || props.readonly);
    const editorStyle = computed<CSSProperties>(() => ({
      '--kt-tiptap-min-height': toCssSize(props.minHeight),
    }));

    /**
     * 将编辑器 HTML 变更同步给父级，避免重复值产生循环事件。
     *
     * @param nextHtml - 编辑器最新生成的 HTML 文本。
     * @param previousHtml - 父组件上一次已接收的 HTML；与新值相同则不重复触发事件；未传入时使用 `currentHtml.value`。
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
    const [LinkForm, linkFormApi] = useVbenForm({
      layout: 'vertical',
      schema: [
        {
          component: 'Input',
          componentProps: {
            allowClear: true,
            maxlength: 2048,
            placeholder: 'https://example.com',
          },
          fieldName: 'href',
          label: '链接地址',
          rules: z
            .string()
            .trim()
            .url('请输入完整 HTTP(S) 地址')
            .optional()
            .or(z.literal('')),
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const [ImageForm, imageFormApi] = useVbenForm({
      layout: 'vertical',
      schema: [
        {
          component: 'Input',
          componentProps: {
            allowClear: true,
            maxlength: 2048,
            placeholder: 'https://example.com/image.png',
          },
          fieldName: 'src',
          label: '图片地址',
          rules: z
            .string()
            .trim()
            .min(1, '请输入图片地址')
            .url('请输入完整 HTTP(S) 地址'),
        },
      ],
      showDefaultActions: false,
      wrapperClass: 'grid-cols-1',
    });
    const [LinkModal, linkModalApi] = useVbenModal({
      class: 'w-[560px]',
      confirmText: '应用',
      fullscreenButton: false,
      /**
       * 确认链接弹窗时校验 URL，并把链接设置或移除操作应用到当前选区。
       */
      async onConfirm() {
        await confirmLink();
      },
      /**
       * 链接 Modal 打开后把共享数据写入已挂载 VbenForm。
       *
       * @param isOpen - 通用 Modal 最新显隐状态。
       */
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = linkModalApi.getData<{
          values: LinkFormValues;
        }>();
        void resetLinkForm(values);
      },
    });
    const [ImageModal, imageModalApi] = useVbenModal({
      class: 'w-[560px]',
      confirmText: '插入',
      fullscreenButton: false,
      /**
       * 确认图片弹窗时校验 URL，并在当前光标处插入图片节点。
       */
      async onConfirm() {
        await confirmImage();
      },
      /**
       * 图片 Modal 打开后把共享数据写入已挂载 VbenForm。
       *
       * @param isOpen - 通用 Modal 最新显隐状态。
       */
      onOpenChange(isOpen: boolean) {
        if (!isOpen) return;
        const { values } = imageModalApi.getData<{
          values: ImageFormValues;
        }>();
        void resetImageForm(values);
      },
    });

    /**
     * 根据编辑器可编辑状态与命令可执行性判断工具栏按钮是否禁用。
     *
     * @returns 编辑器不可编辑或命令不可执行时为 true。
     */
    function isToolbarDisabled() {
      return readonlyState.value || !editor.value;
    }

    /**
     * 仅在编辑器存在且可编辑时执行工具栏命令。
     *
     * @param command - 工具栏点击后要检查并执行的编辑器命令。
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

      linkModalApi
        .setData({
          values: {
            href: currentEditor.getAttributes('link')?.href || '',
          } satisfies LinkFormValues,
        })
        .open();
    }

    /**
     * 重置链接 VbenForm 并写入当前选区地址。
     *
     * @param values - 当前链接表单默认值。
     */
    async function resetLinkForm(values: LinkFormValues) {
      await linkFormApi.resetForm();
      await linkFormApi.setValues(values);
      await linkFormApi.resetValidate();
    }

    /**
     * 将链接弹窗中的 URL 应用到当前选区。
     */
    async function confirmLink() {
      const currentEditor = editor.value;
      if (!currentEditor) return;

      const { valid } = await linkFormApi.validate();
      if (!valid) return;
      const values = await linkFormApi.getValues<LinkFormValues>();
      const href = values.href.trim();
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
      await linkModalApi.close();
    }

    /**
     * 打开图片插入弹窗前，将上一轮地址与说明文本清空。
     */
    function openImageModal() {
      if (!editor.value || readonlyState.value) return;
      imageModalApi
        .setData({ values: { src: '' } satisfies ImageFormValues })
        .open();
    }

    /**
     * 重置图片 VbenForm 并写入空白创建值。
     *
     * @param values - 当前图片表单默认值。
     */
    async function resetImageForm(values: ImageFormValues) {
      await imageFormApi.resetForm();
      await imageFormApi.setValues(values);
      await imageFormApi.resetValidate();
    }

    /**
     * 将图片 URL 插入当前光标位置。
     */
    async function confirmImage() {
      const currentEditor = editor.value;
      if (!currentEditor) return;
      const { valid } = await imageFormApi.validate();
      if (!valid) return;
      const values = await imageFormApi.getValues<ImageFormValues>();
      const src = values.src.trim();

      currentEditor.chain().focus().setImage({ src }).run();
      await imageModalApi.close();
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
        run: () => void openLinkModal(),
        title: '链接',
      },
      {
        icon: 'lucide:image',
        key: 'image',
        run: () => void openImageModal(),
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

    const renderCommandButton = (command: ToolbarCommand): VNodeChild => {
      const currentEditor = editor.value;
      const active = (() => {
        if (currentEditor) {
          return command.isActive?.(currentEditor);
        }
        return false;
      })();

      return (
        <ATooltip key={command.key} title={command.title}>
          <AButton
            aria-label={command.title}
            class={[
              'kt-tiptap-editor__toolbar-button',
              (() => {
                if (active) {
                  return 'kt-tiptap-editor__toolbar-button--active';
                }
                return '';
              })(),
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
                {(() => {
                  if (index > 0) {
                    return <ADivider orientation="vertical" />;
                  }
                  return null;
                })()}
                {group.map((command) => renderCommandButton(command))}
              </span>
            ))}
          </ASpace>
        </div>
      );
    };

    const renderModals = () => (
      <>
        <LinkModal title="设置链接">
          <LinkForm />
        </LinkModal>
        <ImageModal title="插入图片">
          <ImageForm />
        </ImageModal>
      </>
    );

    /**
     * 从组件状态返回当前 Tiptap 编辑器实例；尚未初始化时返回 null。
     *
     * @returns 当前 Tiptap 编辑器实例；尚未初始化时为 null。
     */
    function getEditor() {
      return editor.value || null;
    }

    /**
     * 从编辑器读取规范化 HTML；实例未就绪时返回缓存内容。
     *
     * @returns 当前规范化 HTML；实例未就绪时使用缓存值。
     */
    function getHtml() {
      return readEditorHtml(editor.value, currentHtml.value);
    }

    /**
     * 通过 Tiptap 重新设置 HTML，并把规范化结果同步给父级。
     *
     * @param value - 要覆盖到 Tiptap 编辑器的 HTML；空值会归一为空字符串。
     */
    function setHtml(value: string) {
      const currentEditor = editor.value;
      const previousHtml = currentHtml.value;
      if (!currentEditor) {
        emitHtmlChange(value, previousHtml);
        return;
      }

      currentEditor.commands.setContent(value, { emitUpdate: false });
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
        editor.value?.commands.setContent(nextHtml, { emitUpdate: false });
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
          (() => {
            if (readonlyState.value) {
              return 'kt-tiptap-editor--disabled';
            }
            return '';
          })(),
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
