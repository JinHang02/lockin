import { useEffect, useRef, useCallback, useState } from 'react'
import { EditorView, keymap, highlightActiveLine } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { useAppStore } from '@/store/app.store'

interface UseCodeMirrorOptions {
  onChange: (value: string) => void
}

function buildTheme(dark: boolean): ReturnType<typeof EditorView.theme> {
  return EditorView.theme(
    {
      '&': { fontSize: '0.9375rem', lineHeight: '1.75', fontFamily: "'Inter', system-ui, sans-serif" },
      '.cm-content': {
        padding: '0',
        minHeight: '200px',
        caretColor: 'var(--accent)',
        color: 'var(--text-primary)',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--accent)',
      },
      '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: 'rgb(var(--accent-500) / 0.2)',
      },
      '.cm-line': { padding: '0 4px' },
      '.cm-activeLine': { backgroundColor: 'transparent' },
      '.cm-scroller': { fontFamily: 'inherit', overflow: 'auto' },
      '.cm-gutters': { display: 'none' },
    },
    { dark }
  )
}

export function useCodeMirror(
  containerRef: React.RefObject<HTMLDivElement | null>,
  { onChange }: UseCodeMirrorOptions
) {
  const viewRef = useRef<EditorView | null>(null)
  const themeCompartment = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  const pendingDoc = useRef<string | null>(null)
  const { theme } = useAppStore()
  const [container, setContainer] = useState<HTMLDivElement | null>(null)

  // Track when the container DOM element appears/disappears
  useEffect(() => {
    setContainer(containerRef.current)
  })

  // Keep the callback ref always up-to-date (avoids stale closures)
  useEffect(() => { onChangeRef.current = onChange })

  // Update theme without recreating the editor
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const isDark = document.documentElement.classList.contains('dark')
    view.dispatch({
      effects: themeCompartment.current.reconfigure(buildTheme(isDark))
    })
  }, [theme])

  // Create/destroy editor when container appears/disappears
  useEffect(() => {
    if (!container) {
      // Container removed from DOM — destroy existing editor
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
      return
    }
    // Container already has an editor
    if (viewRef.current) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString())
      }
    })

    const state = EditorState.create({
      doc: '',
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        highlightActiveLine(),
        EditorView.lineWrapping,
        themeCompartment.current.of(buildTheme(document.documentElement.classList.contains('dark'))),
        updateListener,
      ]
    })

    const view = new EditorView({ state, parent: container })
    viewRef.current = view

    // Apply any content that was set before the editor was ready
    if (pendingDoc.current !== null) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: pendingDoc.current }
      })
      pendingDoc.current = null
    }

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [container])

  const setDoc = useCallback((value: string) => {
    const view = viewRef.current
    if (!view) {
      // Editor not ready yet — buffer the content for when it's created
      pendingDoc.current = value
      return
    }
    pendingDoc.current = null
    const current = view.state.doc.toString()
    if (current === value) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value }
    })
  }, [])

  return { setDoc, viewRef }
}
