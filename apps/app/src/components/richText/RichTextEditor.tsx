import { useEffect, useRef } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, ListTodo, Redo2, Underline, Undo2 } from 'lucide-react';
import { parseRich } from './richDoc';

/**
 * Formatted writing for notes, summaries and recaps: headings, bold, italic,
 * underline, bullet, numbered and tick-box lists. Nothing else is offered,
 * and the API keeps nothing else (common/rich-text.ts), so what is written
 * here looks the same in the portal and in the client's email.
 *
 * The value is the stored text: a JSON document, or plain text from before
 * the editor, which opens as paragraphs. An empty editor reports ''.
 */
export const RICH_TEXT_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    blockquote: false,
    codeBlock: false,
    code: false,
    horizontalRule: false,
    strike: false,
    link: false,
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
];

const toContent = (value: string | null | undefined) => parseRich(value) ?? { type: 'doc', content: [{ type: 'paragraph' }] };
const toValue = (editor: Editor) => (editor.isEmpty ? '' : JSON.stringify(editor.getJSON()));

export function RichTextEditor({
  value,
  onChange,
  label,
  placeholder,
  disabled = false,
  minHeight = 96,
}: {
  value: string | null | undefined;
  onChange: (value: string) => void;
  /** The field's name, for screen readers (and tests). */
  label: string;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: number;
}) {
  // What this editor last reported, so a parent echoing it back is not a reload.
  const emitted = useRef<string | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const editor = useEditor({
    extensions: [...RICH_TEXT_EXTENSIONS, Placeholder.configure({ placeholder: placeholder ?? '' })],
    content: toContent(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        class: 'rich-text rich-text-editing outline-none',
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor: e }) => {
      const next = toValue(e);
      emitted.current = next;
      changeRef.current(next);
    },
  });

  // A value loaded or replaced from outside (not the echo of typing).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const incoming = value ?? '';
    if (incoming === emitted.current || incoming === toValue(editor)) return;
    emitted.current = incoming;
    editor.commands.setContent(toContent(incoming), { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(!disabled);
  }, [editor, disabled]);

  return (
    <div className={`rounded-[12px] border border-[var(--desk-border)] bg-white ${disabled ? 'opacity-75' : ''}`}>
      {!disabled && editor ? <Toolbar editor={editor} label={label} /> : null}
      <div className="px-3 py-2.5">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor, label }: { editor: Editor; label: string }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      bullets: e.isActive('bulletList'),
      numbers: e.isActive('orderedList'),
      ticks: e.isActive('taskList'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const run = (fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => fn(editor.chain().focus()).run();
  const buttons = [
    { name: 'Heading', icon: Heading2, on: s.h2, act: () => run((c) => c.toggleHeading({ level: 2 })) },
    { name: 'Subheading', icon: Heading3, on: s.h3, act: () => run((c) => c.toggleHeading({ level: 3 })) },
    { name: 'Bold', icon: Bold, on: s.bold, act: () => run((c) => c.toggleBold()) },
    { name: 'Italic', icon: Italic, on: s.italic, act: () => run((c) => c.toggleItalic()) },
    { name: 'Underline', icon: Underline, on: s.underline, act: () => run((c) => c.toggleUnderline()) },
    { name: 'Bullet list', icon: List, on: s.bullets, act: () => run((c) => c.toggleBulletList()) },
    { name: 'Numbered list', icon: ListOrdered, on: s.numbers, act: () => run((c) => c.toggleOrderedList()) },
    { name: 'Tick-box list', icon: ListTodo, on: s.ticks, act: () => run((c) => c.toggleTaskList()) },
  ];
  const btn = 'h-7 w-7 rounded-[8px] flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-default';
  return (
    <div role="toolbar" aria-label={`Formatting for ${label}`} className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-[var(--desk-border)]">
      {buttons.map((b) => (
        <button
          key={b.name}
          type="button"
          title={b.name}
          aria-label={b.name}
          aria-pressed={b.on}
          // Keep the text selection: a mouse-down on the button would take focus first.
          onMouseDown={(e) => e.preventDefault()}
          onClick={b.act}
          className={`${btn} ${b.on ? 'bg-[var(--desk-pine-100)] text-[var(--desk-pine-600)]' : 'text-[var(--desk-text-muted)] hover:bg-[var(--desk-surface-muted)]'}`}
        >
          <b.icon className="h-4 w-4" />
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-[var(--desk-border)]" aria-hidden />
      <button type="button" title="Undo" aria-label="Undo" disabled={!s.canUndo} onMouseDown={(e) => e.preventDefault()} onClick={() => run((c) => c.undo())} className={`${btn} text-[var(--desk-text-muted)] hover:bg-[var(--desk-surface-muted)]`}>
        <Undo2 className="h-4 w-4" />
      </button>
      <button type="button" title="Redo" aria-label="Redo" disabled={!s.canRedo} onMouseDown={(e) => e.preventDefault()} onClick={() => run((c) => c.redo())} className={`${btn} text-[var(--desk-text-muted)] hover:bg-[var(--desk-surface-muted)]`}>
        <Redo2 className="h-4 w-4" />
      </button>
    </div>
  );
}
