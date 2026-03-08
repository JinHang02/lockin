import type { EditorView } from '@codemirror/view'

type MarkdownAction =
  | 'bold' | 'italic' | 'strikethrough'
  | 'heading1' | 'heading2' | 'heading3'
  | 'unorderedList' | 'orderedList' | 'checkList'
  | 'codeInline' | 'codeBlock'
  | 'link' | 'horizontalRule' | 'blockquote'

/** Wrap the selection with a pair of markers (e.g. ** for bold) */
function wrapSelection(view: EditorView, marker: string): void {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)

  // If already wrapped, unwrap
  const before = view.state.sliceDoc(Math.max(0, from - marker.length), from)
  const after = view.state.sliceDoc(to, Math.min(view.state.doc.length, to + marker.length))
  if (before === marker && after === marker) {
    view.dispatch({
      changes: [
        { from: from - marker.length, to: from, insert: '' },
        { from: to, to: to + marker.length, insert: '' },
      ],
      selection: { anchor: from - marker.length, head: to - marker.length },
    })
    view.focus()
    return
  }

  const wrapped = `${marker}${selected}${marker}`
  view.dispatch({
    changes: { from, to, insert: wrapped },
    selection: {
      anchor: from + marker.length,
      head: from + marker.length + selected.length,
    },
  })
  view.focus()
}

/** Toggle a line prefix (e.g. "- ", "1. ", "- [ ] ") */
function toggleLinePrefix(view: EditorView, prefix: string): void {
  const { from, to } = view.state.selection.main
  const startLine = view.state.doc.lineAt(from)
  const endLine = view.state.doc.lineAt(to)

  const changes: Array<{ from: number; to: number; insert: string }> = []

  for (let i = startLine.number; i <= endLine.number; i++) {
    const line = view.state.doc.line(i)
    const text = line.text
    if (text.startsWith(prefix)) {
      // Remove prefix
      changes.push({ from: line.from, to: line.from + prefix.length, insert: '' })
    } else {
      // Strip other list prefixes before adding
      const stripped = text.replace(/^(\d+\.\s|- \[[ x]\]\s|- |> )/, '')
      changes.push({ from: line.from, to: line.from + (text.length - stripped.length), insert: prefix })
    }
  }

  view.dispatch({ changes })
  view.focus()
}

/** Toggle heading level at line start */
function toggleHeading(view: EditorView, level: number): void {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const text = line.text
  const prefix = '#'.repeat(level) + ' '

  if (text.startsWith(prefix)) {
    // Remove heading
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: '' },
    })
  } else {
    // Remove existing heading prefix (any level)
    const stripped = text.replace(/^#{1,6}\s/, '')
    view.dispatch({
      changes: { from: line.from, to: line.from + (text.length - stripped.length), insert: prefix },
    })
  }
  view.focus()
}

export function applyMarkdown(view: EditorView, action: MarkdownAction): void {
  switch (action) {
    case 'bold':
      wrapSelection(view, '**')
      break
    case 'italic':
      wrapSelection(view, '*')
      break
    case 'strikethrough':
      wrapSelection(view, '~~')
      break
    case 'heading1':
      toggleHeading(view, 1)
      break
    case 'heading2':
      toggleHeading(view, 2)
      break
    case 'heading3':
      toggleHeading(view, 3)
      break
    case 'unorderedList':
      toggleLinePrefix(view, '- ')
      break
    case 'orderedList':
      toggleLinePrefix(view, '1. ')
      break
    case 'checkList':
      toggleLinePrefix(view, '- [ ] ')
      break
    case 'codeInline':
      wrapSelection(view, '`')
      break
    case 'codeBlock': {
      const { from, to } = view.state.selection.main
      const selected = view.state.sliceDoc(from, to)
      const block = `\`\`\`\n${selected}\n\`\`\``
      view.dispatch({
        changes: { from, to, insert: block },
        selection: { anchor: from + 4, head: from + 4 + selected.length },
      })
      view.focus()
      break
    }
    case 'link': {
      const { from, to } = view.state.selection.main
      const selected = view.state.sliceDoc(from, to)
      const linkText = selected || 'text'
      const insert = `[${linkText}](url)`
      view.dispatch({
        changes: { from, to, insert },
        // Select the "url" part for quick replacement
        selection: { anchor: from + linkText.length + 3, head: from + linkText.length + 6 },
      })
      view.focus()
      break
    }
    case 'horizontalRule': {
      const { from } = view.state.selection.main
      const line = view.state.doc.lineAt(from)
      view.dispatch({
        changes: { from: line.to, to: line.to, insert: '\n\n---\n' },
      })
      view.focus()
      break
    }
    case 'blockquote':
      toggleLinePrefix(view, '> ')
      break
  }
}

export type { MarkdownAction }
