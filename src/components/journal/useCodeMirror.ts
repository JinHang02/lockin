import { useEffect, useRef, useCallback } from 'react'
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
        caretColor: dark ? '#818cf8' : '#4f46e5',
        color: dark ? '#f5f5f4' : '#171715',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: dark ? '#818cf8' : '#4f46e5',
      },
      '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: dark ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.15)',
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
  containerRef: React.RefObject<HTMLDivElement>,
  { onChange }: UseCodeMirrorOptions
) {
  const viewRef = useRef<EditorView | null>(null)
  const themeCompartment = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  const { theme } = useAppStore()

  // Keep the callback ref always up-to-date (avoids stale closures)
  useEffect(() => { onChangeRef.current = onChange })

  // Update theme without recreating the editor
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: themeCompartment.current.reconfigure(buildTheme(theme === 'dark'))
    })
  }, [theme])

  // Create editor once on mount
  useEffect(() => {
    const el = containerRef.current
    if (!el || viewRef.current) return

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
        themeCompartment.current.of(buildTheme(theme === 'dark')),
        updateListener,
      ]
    })

    const view = new EditorView({ state, parent: el })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, []) // Only on mount

  const setDoc = useCallback((value: string) => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === value) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value }
    })
  }, [])

  return { setDoc }
}
