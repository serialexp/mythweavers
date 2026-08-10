import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { html } from '@codemirror/lang-html'
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  placeholder,
  rectangularSelection,
} from '@codemirror/view'
import { Component, createEffect, onCleanup, onMount } from 'solid-js'
import * as styles from './CodeEditor.css'

interface EJSCodeEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string | null
  readOnly?: boolean
  height?: string
  minHeight?: string
  ref?: (methods: { insertAtCursor: (text: string) => void }) => void
}

export const EJSCodeEditor: Component<EJSCodeEditorProps> = (props) => {
  let editorContainer: HTMLDivElement | undefined
  let view: EditorView | undefined
  const readOnlyCompartment = new Compartment()
  // Set while we are pushing an external value into the document, so the
  // updateListener does not echo that same value back out through onChange
  // (which would mean writing to the signal we are currently reading).
  let applyingExternalValue = false

  onMount(() => {
    // Detect if user prefers dark mode
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches

    // Create a basic setup for EJS editing
    const basicExtensions = [
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      highlightActiveLine(),
      highlightSpecialChars(),
      EditorView.lineWrapping,
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
    ]

    const startState = EditorState.create({
      doc: props.value,
      extensions: [
        ...basicExtensions,
        // Use HTML mode for EJS templates (gives decent highlighting for mixed content)
        html({
          matchClosingTags: true,
          autoCloseTags: false, // Don't auto-close since we're not writing HTML
        }),
        ...(isDarkMode ? [oneDark] : []),
        ...(props.placeholder ? [placeholder(props.placeholder)] : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !applyingExternalValue) {
            const value = update.state.doc.toString()
            props.onChange(value)
          }
        }),
        readOnlyCompartment.of(EditorState.readOnly.of(props.readOnly || false)),
        EditorView.theme({
          '&': {
            fontSize: '14px',
            height: props.height || 'auto',
          },
          '.cm-content': {
            padding: '8px 12px',
            minHeight: props.minHeight || props.height || '60px',
            fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
          },
          '.cm-focused .cm-cursor': {
            borderLeftColor: 'var(--primary-color)',
          },
          '.cm-placeholder': {
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
          },
          '&.cm-editor': {
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            backgroundColor: 'var(--surface-primary)',
          },
          '&.cm-editor.cm-focused': {
            outline: '2px solid var(--primary-color)',
            outlineOffset: '-1px',
          },
          '.cm-gutters': {
            display: 'none', // Hide line numbers for character descriptions
          },
          // Style EJS tags distinctively
          '.cm-tag': {
            color: 'var(--primary-color)',
          },
          '.cm-attribute': {
            color: 'var(--secondary-color)',
          },
          '.cm-string': {
            color: 'var(--success-color)',
          },
        }),
      ],
    })

    view = new EditorView({
      state: startState,
      parent: editorContainer!,
    })

    // Expose methods to parent via ref
    if (props.ref) {
      props.ref({
        insertAtCursor: (text: string) => {
          if (view) {
            const pos = view.state.selection.main.head
            view.dispatch({
              changes: { from: pos, insert: text },
              selection: { anchor: pos + text.length },
            })
          }
        },
      })
    }
  })

  // Update editor when value changes externally (e.g. an AI adjustment).
  // Read props.value unconditionally so the effect always subscribes to it —
  // short-circuiting on `view` first would leave the effect tracking nothing
  // if it ever ran before onMount, and it would then never fire again.
  createEffect(() => {
    const nextValue = props.value ?? ''
    if (!view) return
    if (nextValue === view.state.doc.toString()) return

    applyingExternalValue = true
    try {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: nextValue,
        },
        // Keep the cursor inside the new document instead of letting CodeMirror
        // map a stale offset past the end.
        selection: { anchor: Math.min(view.state.selection.main.anchor, nextValue.length) },
      })
    } finally {
      applyingExternalValue = false
    }
  })

  // Update readonly state
  createEffect(() => {
    if (view && props.readOnly !== undefined) {
      view.dispatch({
        effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(props.readOnly)),
      })
    }
  })

  onCleanup(() => {
    view?.destroy()
  })

  return (
    <div class={styles.container}>
      <div ref={editorContainer} class={`${styles.editor} ${props.error ? styles.hasError : ''}`} />
    </div>
  )
}
