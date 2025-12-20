import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
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
  rectangularSelection,
} from '@codemirror/view'
import { Component, createEffect, onCleanup, onMount } from 'solid-js'
import * as styles from './CodeEditor.css'

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
    // Detect if user prefers dark mode for CodeMirror syntax theme
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
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
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
        // Dynamic height handling - other styles are in CodeEditor.css.ts
        ...(props.height
          ? [
              EditorView.theme({
                '&': { height: props.height },
                '.cm-content': { minHeight: props.height },
              }),
            ]
          : []),
      ],
    })

    view = new EditorView({
      state: startState,
      parent: editorContainer!,
    })
  })

  // Update editor when value changes externally
  createEffect(() => {
    if (view && props.value !== view.state.doc.toString()) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: props.value,
        },
      })
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
