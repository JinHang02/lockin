import { useCallback } from 'react'
import {
  Bold, Italic, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks,
  Code, Braces, Link, Quote, Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { applyMarkdown, type MarkdownAction } from './markdownActions'
import type { EditorView } from '@codemirror/view'

interface MarkdownToolbarProps {
  viewRef: React.RefObject<EditorView | null>
}

interface ToolbarItem {
  action: MarkdownAction
  icon: React.ElementType
  label: string
  shortcut?: string
}

const GROUPS: ToolbarItem[][] = [
  [
    { action: 'bold',          icon: Bold,          label: 'Bold',          shortcut: 'Ctrl+B' },
    { action: 'italic',        icon: Italic,        label: 'Italic',        shortcut: 'Ctrl+I' },
    { action: 'strikethrough', icon: Strikethrough,  label: 'Strikethrough' },
  ],
  [
    { action: 'heading1', icon: Heading1, label: 'Heading 1' },
    { action: 'heading2', icon: Heading2, label: 'Heading 2' },
    { action: 'heading3', icon: Heading3, label: 'Heading 3' },
  ],
  [
    { action: 'unorderedList', icon: List,        label: 'Bullet list' },
    { action: 'orderedList',   icon: ListOrdered,  label: 'Numbered list' },
    { action: 'checkList',     icon: ListChecks,   label: 'Checklist' },
    { action: 'blockquote',    icon: Quote,        label: 'Block quote' },
  ],
  [
    { action: 'codeInline',    icon: Code,   label: 'Inline code' },
    { action: 'codeBlock',     icon: Braces, label: 'Code block' },
    { action: 'link',          icon: Link,   label: 'Link',        shortcut: 'Ctrl+K' },
    { action: 'horizontalRule', icon: Minus,  label: 'Horizontal rule' },
  ],
]

export default function MarkdownToolbar({ viewRef }: MarkdownToolbarProps) {
  const handleAction = useCallback((action: MarkdownAction) => {
    const view = viewRef.current
    if (!view) return
    applyMarkdown(view, action)
  }, [viewRef])

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && (
            <div className="h-4 w-px bg-[var(--border)] mx-1 flex-shrink-0" />
          )}
          {group.map(({ action, icon: Icon, label, shortcut }) => (
            <button
              key={action}
              onClick={() => handleAction(action)}
              className={cn(
                'h-7 w-7 rounded flex items-center justify-center',
                'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
                'transition-colors focus-ring'
              )}
              title={shortcut ? `${label} (${shortcut})` : label}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
