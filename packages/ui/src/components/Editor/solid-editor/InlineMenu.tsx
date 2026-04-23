import type { EditorState, Node as PMNode, Transaction } from '@serialexp/solidjs-editor'
import { type Accessor, For, type JSX, Show, createEffect, createSignal } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useThemeClass } from '../../../theme/ThemeClassContext'
import { Button } from '../../Button'
import {
  inlineMenu as inlineMenuClass,
  rewriteDiffActions as rewriteDiffActionsClass,
  rewriteDiffNew as rewriteDiffNewClass,
  rewriteDiffOriginal as rewriteDiffOriginalClass,
  rewriteDiffPopover as rewriteDiffPopoverClass,
  rewriteSubmenu as rewriteSubmenuClass,
  translationSubmenu as translationSubmenuClass,
} from '../scene-editor.css'

export interface TranslationLanguage {
  id: string
  name: string // "Scottish Gaelic" (used in LLM prompts)
  label: string // "Gaelic" (displayed in UI)
}

/**
 * Identifiers for built-in AI rewrite presets shown in the inline menu.
 * The InlineMenu itself only treats preset IDs as opaque strings — they're
 * passed through to `onRewrite` for the consumer to resolve. This union
 * exists for documentation / autocomplete on the consumer side.
 */
export type BuiltInRewritePresetId =
  | 'grammar'
  | 'show-dont-tell'
  | 'sensory'
  | 'style-polish'
  | 'perspective:first'
  | 'perspective:second'
  | 'perspective:third'

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

  // AI rewrite features
  /**
   * Callback invoked when the user picks a rewrite preset from the menu.
   * Receives the preset id, the selected text, and the full text of the
   * paragraph that contains the selection (for context). Should return the
   * rewritten substring — caller will splice it into the selection range
   * after the user confirms via the diff popover.
   */
  onRewrite?: (presetId: string, selectedText: string, containingParagraph: string) => Promise<string>

  // Loading state (set true while a rewrite is in flight)
  isRewriting?: boolean

  // Set to false to hide the Rewrite button entirely
  enableRewrite?: boolean
}

interface MenuPosition {
  top: number
  left: number
}

type SubmenuMode =
  | null
  | 'translate-from-primary'
  | 'translate-from-pick'
  | 'translate-to'
  | 'add-translation'
  | 'rewrite-presets'
  | 'rewrite-perspective'

/**
 * Pending diff state — shown after a rewrite returns, before the user
 * accepts or rejects. Holds the selection range captured at request time
 * (positions can shift if the user keeps typing during the async call,
 * but for the v1 we just block on `isRewriting`).
 */
interface PendingRewrite {
  from: number
  to: number
  original: string
  rewritten: string
  presetLabel: string
}

const REWRITE_PRESETS: Array<{
  id: BuiltInRewritePresetId
  label: string
  expandsTo?: 'rewrite-perspective'
}> = [
  { id: 'grammar', label: 'Grammar' },
  { id: 'show-dont-tell', label: "Show, don't tell" },
  { id: 'sensory', label: 'Sensory details' },
  { id: 'style-polish', label: 'Style polish' },
  { id: 'perspective:first', label: 'Perspective ▸', expandsTo: 'rewrite-perspective' },
]

const PERSPECTIVE_PRESETS: Array<{ id: BuiltInRewritePresetId; label: string }> = [
  { id: 'perspective:first', label: '1st person (I / me)' },
  { id: 'perspective:second', label: '2nd person (you)' },
  { id: 'perspective:third', label: '3rd person (he / she / they)' },
]

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
  const [pendingRewrite, setPendingRewrite] = createSignal<PendingRewrite | null>(null)

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
  const applyTranslationMark = (
    selFrom: number,
    selTo: number,
    fromLang: string,
    toLang: string,
    translatedText: string,
  ) => {
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

  /**
   * Walk up the doc from a given position to find the enclosing paragraph
   * (or top-level block). Returns the block node and its `start` position
   * (the position of its first child).
   *
   * Returns null if no block ancestor is found (shouldn't happen for valid
   * selections but we fail safe).
   */
  const findContainingBlock = (
    state: EditorState,
    pos: number,
  ): { node: PMNode; start: number; end: number } | null => {
    const $pos = state.doc.resolve(pos)
    // Walk up depth levels until we find a textblock (paragraph etc.)
    for (let depth = $pos.depth; depth > 0; depth--) {
      const node = $pos.node(depth)
      if (node.type.isTextblock) {
        return {
          node,
          start: $pos.start(depth),
          end: $pos.end(depth),
        }
      }
    }
    // Fallback: top-level doc node
    return {
      node: $pos.node(0),
      start: 0,
      end: state.doc.content.size,
    }
  }

  /**
   * Returns true when the selection is fully contained within a single
   * textblock (paragraph). Used to gate the rewrite button — multi-paragraph
   * selections aren't supported in v1.
   */
  const selectionInSingleParagraph = (): boolean => {
    const state = props.state()
    if (!state) return false
    const { from, to } = state.selection
    if (from === to) return false
    const fromBlock = findContainingBlock(state, from)
    const toBlock = findContainingBlock(state, to)
    if (!fromBlock || !toBlock) return false
    return fromBlock.start === toBlock.start && fromBlock.end === toBlock.end
  }

  // Handle a rewrite preset selection — fires the LLM call and stages the
  // result in `pendingRewrite` for accept/reject.
  const handleRewrite = async (presetId: string, presetLabel: string) => {
    const config = props.config
    if (!config?.onRewrite) return

    const state = props.state()
    if (!state) return

    const { from: selFrom, to: selTo } = state.selection
    const selectedText = state.doc.textBetween(selFrom, selTo, ' ')
    if (!selectedText) return

    // Pull the containing paragraph as context
    const block = findContainingBlock(state, selFrom)
    const containingParagraph = block ? state.doc.textBetween(block.start, block.end, ' ') : selectedText

    // Close the submenu while we wait — the diff popover will take over
    resetSubmenu()

    try {
      const rewritten = await config.onRewrite(presetId, selectedText, containingParagraph)
      if (!rewritten) return
      setPendingRewrite({
        from: selFrom,
        to: selTo,
        original: selectedText,
        rewritten: rewritten.trim(),
        presetLabel,
      })
    } catch (error) {
      console.error('[InlineMenu] Rewrite failed:', error)
    }
  }

  // Apply the staged rewrite by replacing the original selection with the
  // rewritten text.
  const acceptRewrite = () => {
    const pending = pendingRewrite()
    if (!pending) return
    const state = props.state()
    if (!state) {
      setPendingRewrite(null)
      return
    }
    // Sanity check: only apply if the original text still matches what's at
    // the saved range (user may have edited the document during the call).
    const currentText = state.doc.textBetween(pending.from, pending.to, ' ')
    if (currentText !== pending.original) {
      console.warn('[InlineMenu] Document changed during rewrite — discarding to avoid clobbering edits')
      setPendingRewrite(null)
      return
    }
    const tr = state.tr()
    tr.replaceWith(pending.from, pending.to, state.schema.text(pending.rewritten))
    props.dispatch(tr)
    setPendingRewrite(null)
  }

  const rejectRewrite = () => {
    setPendingRewrite(null)
  }

  // Handle translation action
  const handleTranslate = async (
    fromLang: TranslationLanguage,
    toLang: TranslationLanguage,
    mode: 'replace' | 'mark',
  ) => {
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

  // Derived: rewrite gating
  const rewriteEnabled = () => typeof config().onRewrite === 'function' && config().enableRewrite !== false
  const isRewriting = () => config().isRewriting ?? false
  // Recompute on every state change so the button enables/disables as the
  // user shifts their selection across paragraph boundaries.
  const canRewriteSelection = () => {
    // Touch state() so this re-runs reactively when selection moves
    void props.state()
    return selectionInSingleParagraph()
  }

  return (
    <Show when={(visible() && position() && editorFocused()) || pendingRewrite()}>
      <Portal>
        {/* Diff popover takes over when a rewrite is awaiting accept/reject.
            We pin it to the same position the inline menu was at when the
            rewrite was triggered. */}
        <Show when={pendingRewrite()}>
          {(pending) => (
            <div
              class={`${themeClass || ''} ${rewriteDiffPopoverClass}`}
              style={{
                position: 'absolute',
                top: `${(position()?.top ?? 0) - 60}px`,
                left: `${position()?.left ?? 0}px`,
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div style={{ 'font-size': '12px', opacity: 0.7 }}>Rewrite — {pending().presetLabel}</div>
              <div class={rewriteDiffOriginalClass}>{pending().original}</div>
              <div class={rewriteDiffNewClass}>{pending().rewritten}</div>
              <div class={rewriteDiffActionsClass}>
                <Button variant="ghost" size="sm" onClick={rejectRewrite}>
                  Reject
                </Button>
                <Button variant="primary" size="sm" onClick={acceptRewrite}>
                  Accept
                </Button>
              </div>
            </div>
          )}
        </Show>

        <Show when={!pendingRewrite() && visible() && position() && editorFocused()}>
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

            {/* Rewrite button + submenus */}
            <Show when={rewriteEnabled()}>
              {/* Loading state */}
              <Show when={isRewriting()}>
                <Button variant="ghost" size="sm" disabled>
                  Rewriting...
                </Button>
              </Show>

              <Show when={!isRewriting()}>
                {/* Top-level Rewrite button (only at top level) */}
                <Show when={submenuMode() === null}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSubmenuMode('rewrite-presets')}
                    disabled={!canRewriteSelection()}
                    title={
                      canRewriteSelection()
                        ? 'Rewrite selection with AI'
                        : 'Rewrite is only available for selections within a single paragraph'
                    }
                  >
                    Rewrite
                  </Button>
                </Show>

                {/* Preset list */}
                <Show when={submenuMode() === 'rewrite-presets'}>
                  <div class={rewriteSubmenuClass}>
                    <For each={REWRITE_PRESETS}>
                      {(preset) => (
                        <Button
                          variant="ghost"
                          size="sm"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            if (preset.expandsTo) {
                              setSubmenuMode(preset.expandsTo)
                            } else {
                              handleRewrite(preset.id, preset.label)
                            }
                          }}
                        >
                          {preset.label}
                        </Button>
                      )}
                    </For>
                    <Button variant="ghost" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={resetSubmenu}>
                      &times; Cancel
                    </Button>
                  </div>
                </Show>

                {/* Perspective sub-options */}
                <Show when={submenuMode() === 'rewrite-perspective'}>
                  <div class={rewriteSubmenuClass}>
                    <For each={PERSPECTIVE_PRESETS}>
                      {(preset) => (
                        <Button
                          variant="ghost"
                          size="sm"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleRewrite(preset.id, `Perspective: ${preset.label}`)}
                        >
                          {preset.label}
                        </Button>
                      )}
                    </For>
                    <Button
                      variant="ghost"
                      size="sm"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setSubmenuMode('rewrite-presets')}
                    >
                      &larr; Back
                    </Button>
                  </div>
                </Show>
              </Show>
            </Show>
          </div>
        </Show>
      </Portal>
    </Show>
  )
}

export default InlineMenu
