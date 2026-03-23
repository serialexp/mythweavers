import type { EditorState, Transaction } from '@writer/solid-editor'
import { type Accessor, For, type JSX, Show, createEffect, createSignal } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useThemeClass } from '../../../theme/ThemeClassContext'
import { Button } from '../../Button'
import { inlineMenu as inlineMenuClass, translationSubmenu as translationSubmenuClass } from '../scene-editor.css'

export interface TranslationLanguage {
  id: string
  name: string // "Scottish Gaelic" (used in LLM prompts)
  label: string // "Gaelic" (displayed in UI)
}

export interface InlineMenuConfig {
  // Core formatting
  enableBold?: boolean
  enableItalic?: boolean

  // Translation features
  languages?: TranslationLanguage[]
  primaryLanguageId?: string | null

  // Callback that performs LLM translation and returns translated text
  onTranslate?: (fromLang: string, toLang: string, selectedText: string) => Promise<string>

  // Loading state (set true while LLM is translating)
  isTranslating?: boolean
}

interface MenuPosition {
  top: number
  left: number
}

type SubmenuMode = null | 'translate-from-primary' | 'translate-from-pick' | 'translate-to' | 'add-translation'

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
  const [submenuMode, setSubmenuMode] = createSignal<SubmenuMode>(null)
  const [selectedFromLang, setSelectedFromLang] = createSignal<TranslationLanguage | null>(null)

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
    if (!state) return

    const { from, to } = state.selection
    if (from === to) return

    const markType = state.schema.marks[markName]
    if (!markType) return

    const hasMarkNow = hasMark(markName)
    const tr = state.tr()
    if (hasMarkNow) {
      tr.removeMark(from, to, markType)
    } else {
      tr.addMark(from, to, markType.create())
    }
    props.dispatch(tr)
  }

  // Apply translation mark (add translation as hover)
  const applyTranslationMark = (selFrom: number, selTo: number, fromLang: string, toLang: string, translatedText: string) => {
    const state = props.state()
    if (!state) return

    const markType = state.schema.marks.translation
    if (!markType) return

    const tr = state.tr()
    tr.addMark(
      selFrom,
      selTo,
      markType.create({
        title: translatedText,
        from: fromLang,
        to: toLang,
      }),
    )
    props.dispatch(tr)
  }

  // Replace selected text with translated text
  const replaceSelectedText = (selFrom: number, selTo: number, translatedText: string) => {
    const state = props.state()
    if (!state) return

    const tr = state.tr()
    tr.replaceWith(selFrom, selTo, state.schema.text(translatedText))
    props.dispatch(tr)
  }

  // Handle translation action
  const handleTranslate = async (fromLang: TranslationLanguage, toLang: TranslationLanguage, mode: 'replace' | 'mark') => {
    const config = props.config
    if (!config?.onTranslate) return

    const state = props.state()
    if (!state) return

    // Capture selection range before the async call
    const { from: selFrom, to: selTo } = state.selection
    const selectedText = state.doc.textBetween(selFrom, selTo, ' ')
    if (!selectedText) return

    try {
      const translated = await config.onTranslate(fromLang.name, toLang.name, selectedText)
      if (!translated) return

      if (mode === 'replace') {
        replaceSelectedText(selFrom, selTo, translated)
      } else {
        applyTranslationMark(selFrom, selTo, fromLang.name, toLang.name, translated)
      }

    } finally {
      resetSubmenu()
    }
  }

  const resetSubmenu = () => {
    setSubmenuMode(null)
    setSelectedFromLang(null)
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
      resetSubmenu()
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

  // Check if editor is focused
  const editorFocused = () => props.isFocused?.() ?? true

  // Derived: primary language
  const primaryLanguage = (): TranslationLanguage | null => {
    const langs = config().languages
    const primaryId = config().primaryLanguageId
    if (!langs || !primaryId) return null
    return langs.find((l) => l.id === primaryId) ?? null
  }

  // Derived: non-primary languages
  const nonPrimaryLanguages = (): TranslationLanguage[] => {
    const langs = config().languages
    const primaryId = config().primaryLanguageId
    if (!langs) return []
    if (!primaryId) return langs
    return langs.filter((l) => l.id !== primaryId)
  }

  // Derived: has enough languages for translation
  const hasLanguages = () => (config().languages?.length ?? 0) >= 2

  const isTranslating = () => config().isTranslating ?? false

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
          <Show when={hasLanguages()}>
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
              {/* Loading state */}
              <Show when={isTranslating()}>
                <Button variant="ghost" size="sm" disabled>
                  Translating...
                </Button>
              </Show>

              <Show when={!isTranslating()}>
                {/* No submenu open — show top-level action buttons */}
                <Show when={submenuMode() === null}>
                  {/* "Translate from [primary] to..." — only when primary is set */}
                  <Show when={primaryLanguage()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelectedFromLang(primaryLanguage())
                        setSubmenuMode('translate-from-primary')
                      }}
                    >
                      {primaryLanguage()!.label} &rarr; ...
                    </Button>
                  </Show>

                  {/* "Translate from..." — pick source language */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSubmenuMode('translate-from-pick')}
                  >
                    ... &rarr; ...
                  </Button>

                  {/* "Add translation in..." */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSubmenuMode('add-translation')}
                    title="Add translation annotation"
                  >
                    +T
                  </Button>
                </Show>

                {/* Submenu: pick target for "translate from primary" */}
                <Show when={submenuMode() === 'translate-from-primary'}>
                  <div class={translationSubmenuClass}>
                    <For each={nonPrimaryLanguages()}>
                      {(lang) => (
                        <Button
                          variant="ghost"
                          size="sm"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleTranslate(primaryLanguage()!, lang, 'replace')}
                        >
                          &rarr; {lang.label}
                        </Button>
                      )}
                    </For>
                    <Button variant="ghost" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={resetSubmenu}>
                      &times;
                    </Button>
                  </div>
                </Show>

                {/* Submenu: pick source language */}
                <Show when={submenuMode() === 'translate-from-pick'}>
                  <div class={translationSubmenuClass}>
                    <For each={config().languages}>
                      {(lang) => (
                        <Button
                          variant="ghost"
                          size="sm"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedFromLang(lang)
                            setSubmenuMode('translate-to')
                          }}
                        >
                          {lang.label}
                        </Button>
                      )}
                    </For>
                    <Button variant="ghost" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={resetSubmenu}>
                      &times;
                    </Button>
                  </div>
                </Show>

                {/* Submenu: pick target language (after source was picked) */}
                <Show when={submenuMode() === 'translate-to' && selectedFromLang()}>
                  <div class={translationSubmenuClass}>
                    <For each={config().languages?.filter((l) => l.id !== selectedFromLang()!.id)}>
                      {(lang) => (
                        <Button
                          variant="ghost"
                          size="sm"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleTranslate(selectedFromLang()!, lang, 'replace')}
                        >
                          {selectedFromLang()!.label} &rarr; {lang.label}
                        </Button>
                      )}
                    </For>
                    <Button variant="ghost" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={resetSubmenu}>
                      &times;
                    </Button>
                  </div>
                </Show>

                {/* Submenu: pick target for "add translation" */}
                <Show when={submenuMode() === 'add-translation'}>
                  <div class={translationSubmenuClass}>
                    <For each={primaryLanguage() ? nonPrimaryLanguages() : config().languages}>
                      {(lang) => (
                        <Button
                          variant="ghost"
                          size="sm"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const fromLang = primaryLanguage() || config().languages![0]
                            handleTranslate(fromLang, lang, 'mark')
                          }}
                        >
                          +T {lang.label}
                        </Button>
                      )}
                    </For>
                    <Button variant="ghost" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={resetSubmenu}>
                      &times;
                    </Button>
                  </div>
                </Show>
              </Show>
            </Show>
          </Show>
        </div>
      </Portal>
    </Show>
  )
}

export default InlineMenu
