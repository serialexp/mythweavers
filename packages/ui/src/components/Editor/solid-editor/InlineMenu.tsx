import type { EditorState, Transaction } from '@writer/solid-editor'
import { type Accessor, For, type JSX, Show, createEffect, createSignal } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useThemeClass } from '../../../theme/ThemeClassContext'
import { Button } from '../../Button'
import { inlineMenu as inlineMenuClass } from '../scene-editor.css'

export interface TranslationLanguage {
  code: string // "en", "gd", "nl", etc.
  name: string // "English", "Gaelic", "Dutch"
}

export interface InlineMenuConfig {
  // Core formatting
  enableBold?: boolean
  enableItalic?: boolean

  // Translation features
  translationLanguages?: TranslationLanguage[]

  // Callback for when translation is requested
  onTranslationRequested?: (fromLang: string, toLang: string, selectedText: string) => void
}

interface MenuPosition {
  top: number
  left: number
}

export interface InlineMenuProps {
  /** Accessor for the current editor state */
  state: Accessor<EditorState | null>
  /** Dispatch function for transactions */
  dispatch: (tr: Transaction) => void
  /** Menu configuration */
  config?: InlineMenuConfig
  /** Whether the editor is currently focused */
  isFocused?: Accessor<boolean>
}

/**
 * Inline formatting menu that appears above selected text.
 * Provides bold, italic, and translation options.
 */
export function InlineMenu(props: InlineMenuProps): JSX.Element {
  const [position, setPosition] = createSignal<MenuPosition | null>(null)
  const [visible, setVisible] = createSignal(false)

  // Check if selection has a specific mark
  const hasMark = (markName: string): boolean => {
    const state = props.state()
    if (!state) return false

    const { from, to } = state.selection
    if (from === to) return false

    const markType = state.schema.marks[markName]
    if (!markType) return false

    let found = false
    state.doc.nodesBetween(from, to, (node) => {
      if (found) return false
      if (node.marks.some((m) => m.type === markType)) {
        found = true
      }
    })
    return found
  }

  // Toggle a mark on the selection
  const toggleMark = (markName: string) => {
    const state = props.state()
    if (!state) {
      console.log('[toggleMark] No state!')
      return
    }

    const { from, to } = state.selection
    if (from === to) {
      console.log('[toggleMark] Selection collapsed, ignoring')
      return
    }

    const markType = state.schema.marks[markName]
    if (!markType) {
      console.log('[toggleMark] Mark type not found:', markName)
      return
    }

    // Debug: log the selection and text
    const selectedText = state.doc.textBetween(from, to, ' ')
    const hasMarkNow = hasMark(markName)
    console.log('[toggleMark]', markName, { from, to, selectedText, hasMarkNow, action: hasMarkNow ? 'remove' : 'add' })

    const tr = state.tr()
    if (hasMarkNow) {
      tr.removeMark(from, to, markType)
    } else {
      tr.addMark(from, to, markType.create())
    }

    console.log(
      '[toggleMark] Transaction steps:',
      tr.steps.length,
      'selection after:',
      tr.selection?.from,
      '-',
      tr.selection?.to,
    )
    props.dispatch(tr)
  }

  // Get selected text
  const getSelectedText = (): string => {
    const state = props.state()
    if (!state) return ''

    const { from, to } = state.selection
    return state.doc.textBetween(from, to, ' ')
  }

  // Update menu position when selection changes
  createEffect(() => {
    const state = props.state()
    if (!state) {
      setVisible(false)
      return
    }

    const { from, to } = state.selection

    // Only show for non-empty text selections
    if (from === to) {
      setVisible(false)
      return
    }

    // Get the DOM selection to calculate position
    const domSelection = window.getSelection()
    if (!domSelection || domSelection.rangeCount === 0) {
      setVisible(false)
      return
    }

    const range = domSelection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    // Don't show if selection is collapsed
    if (rect.width === 0) {
      setVisible(false)
      return
    }

    // Position above the selection
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

    setPosition({
      top: rect.top + scrollTop - 50, // Above selection
      left: rect.left + scrollLeft + rect.width / 2 - 50, // Centered
    })
    setVisible(true)
  })

  const config = () => props.config || {}
  const hasTranslationMark = () => hasMark('translation')
  const themeClass = useThemeClass()

  // Check if editor is focused (default to true if not provided for backwards compatibility)
  const editorFocused = () => props.isFocused?.() ?? true

  return (
    <Show when={visible() && position() && editorFocused()}>
      <Portal>
        <div
          class={`${themeClass || ''} ${inlineMenuClass}`}
          style={{
            position: 'absolute',
            top: `${position()!.top}px`,
            left: `${position()!.left}px`,
            'z-index': '1000',
          }}
        >
          {/* Bold button */}
          <Show when={config().enableBold !== false}>
            <Button
              variant={hasMark('strong') ? 'primary' : 'ghost'}
              size="sm"
              iconOnly
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleMark('strong')}
              title="Bold"
            >
              <strong>B</strong>
            </Button>
          </Show>

          {/* Italic button */}
          <Show when={config().enableItalic !== false}>
            <Button
              variant={hasMark('em') ? 'primary' : 'ghost'}
              size="sm"
              iconOnly
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleMark('em')}
              title="Italic"
            >
              <em>I</em>
            </Button>
          </Show>

          {/* Translation buttons */}
          <Show when={config().translationLanguages && config().translationLanguages!.length >= 2}>
            <Show
              when={!hasTranslationMark()}
              fallback={
                <Button
                  variant="ghost"
                  size="sm"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggleMark('translation')}
                  title="Remove Translation"
                >
                  Remove
                </Button>
              }
            >
              <For each={getTranslationPairs(config().translationLanguages!)}>
                {(pair) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (config().onTranslationRequested) {
                        config().onTranslationRequested!(pair.from.code, pair.to.code, getSelectedText())
                      } else {
                        // Just add the mark without translation text
                        const state = props.state()
                        if (!state) return
                        const { from, to } = state.selection
                        const markType = state.schema.marks.translation
                        if (markType) {
                          const tr = state.tr()
                          tr.addMark(
                            from,
                            to,
                            markType.create({
                              from: pair.from.code,
                              to: pair.to.code,
                            }),
                          )
                          props.dispatch(tr)
                        }
                      }
                    }}
                    title={`Translate from ${pair.from.name} to ${pair.to.name}`}
                  >
                    {pair.from.name} → {pair.to.name}
                  </Button>
                )}
              </For>
            </Show>
          </Show>
        </div>
      </Portal>
    </Show>
  )
}

/**
 * Generate all language pair combinations for translation
 */
function getTranslationPairs(
  languages: TranslationLanguage[],
): Array<{ from: TranslationLanguage; to: TranslationLanguage }> {
  const pairs: Array<{ from: TranslationLanguage; to: TranslationLanguage }> = []
  for (let i = 0; i < languages.length; i++) {
    for (let j = 0; j < languages.length; j++) {
      if (i !== j) {
        pairs.push({ from: languages[i], to: languages[j] })
      }
    }
  }
  return pairs
}

export default InlineMenu
