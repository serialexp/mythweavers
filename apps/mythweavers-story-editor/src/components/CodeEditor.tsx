import { Component, onMount, onCleanup, createEffect } from 'solid-js'
import { EditorView, keymap, highlightSpecialChars, drawSelection, highlightActiveLine, dropCursor, rectangularSelection } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import styles from './CodeEditor.module.css'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  error?: string | null
  readOnly?: boolean
  height?: string
}

export const CodeEditor: Component<CodeEditorProps> = (props) => {
  let editorContainer: HTMLDivElement | undefined
  let view: EditorView | undefined
  const readOnlyCompartment = new Compartment()

  onMount(() => {
    // Detect if user prefers dark mode
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    // Create a basic setup similar to the official one but more minimal
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
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...completionKeymap,
        indentWithTab
      ])
    ]

    const startState = EditorState.create({
      doc: props.value,
      extensions: [
        ...basicExtensions,
        javascript(),
        ...(isDarkMode ? [oneDark] : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const value = update.state.doc.toString()
            props.onChange(value)
          }
        }),
        readOnlyCompartment.of(EditorState.readOnly.of(props.readOnly || false)),
        EditorView.theme({
          "&": {
            fontSize: "14px",
            height: props.height || "auto"
          },
          ".cm-content": {
            padding: "12px",
            minHeight: props.height || "200px"
          },
          ".cm-focused .cm-cursor": {
            borderLeftColor: "var(--primary-color)"
          },
          ".cm-placeholder": {
            color: "var(--text-secondary)",
            fontStyle: "italic"
          },
          "&.cm-editor.cm-focused": {
            outline: "2px solid var(--primary-color)"
          },
          ".cm-gutters": {
            backgroundColor: isDarkMode ? "#1e1e1e" : "#f5f5f5",
            borderRight: "1px solid var(--border-color)"
          }
        })
      ]
    })

    view = new EditorView({
      state: startState,
      parent: editorContainer!
    })
  })

  // Update editor when value changes externally
  createEffect(() => {
    if (view && props.value !== view.state.doc.toString()) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: props.value
        }
      })
    }
  })

  // Update readonly state
  createEffect(() => {
    if (view && props.readOnly !== undefined) {
      view.dispatch({
        effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(props.readOnly))
      })
    }
  })

  onCleanup(() => {
    view?.destroy()
  })

  return (
    <div class={styles.container}>
      <div 
        ref={editorContainer} 
        class={`${styles.editor} ${props.error ? styles.hasError : ''}`}
      />
    </div>
  )
}