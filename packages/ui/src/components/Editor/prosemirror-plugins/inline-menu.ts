import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { getSelectedTextForTranslation, toggleTranslationMark } from '../functions/toggle-title-mark'
import { inlineMenu as inlineMenuClass } from '../scene-editor.css'

const menuPluginKey = new PluginKey('menuPlugin')

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
  // Parent app should:
  // 1. Get selected text using getSelectedTextForTranslation(state)
  // 2. Call translation service
  // 3. Call toggleTranslationMark with translatedText
  onTranslationRequested?: (fromLang: string, toLang: string, selectedText: string) => void
}

function createInlineMenu(view: EditorView, coords: { top: number; left: number }, config: InlineMenuConfig) {
  const menu = document.createElement('div')
  menu.className = inlineMenuClass
  menu.style.position = 'absolute'

  // Position menu well above the selection to avoid overlap
  const offset = 60 // Increased offset for better clearance
  const menuTop = Math.max(10, coords.top - offset) // Ensure it doesn't go off-screen

  menu.style.top = `${menuTop}px`
  menu.style.left = `${coords.left}px`

  const { state } = view
  const { from, to } = state.selection

  // Bold button (if enabled)
  if (config.enableBold !== false) {
    const boldButton = document.createElement('button')
    boldButton.textContent = 'Bold'

    function updateButtonStyle() {
      const { state } = view
      const { from, to } = state.selection
      const hasMark = state.doc.rangeHasMark(from, to, state.schema.marks.strong)

      if (hasMark) {
        boldButton.classList.add('active')
      } else {
        boldButton.classList.remove('active')
      }
    }

    boldButton.onclick = () => {
      const { state, dispatch } = view
      const { from, to } = state.selection
      const hasMark = state.doc.rangeHasMark(from, to, state.schema.marks.strong)

      const tr = state.tr

      if (hasMark) {
        tr.removeMark(from, to, state.schema.marks.strong)
      } else {
        tr.addMark(from, to, state.schema.marks.strong.create())
      }

      dispatch(tr)
      updateButtonStyle() // Update button style after state change
      closeMenu()
    }

    menu.appendChild(boldButton)
    updateButtonStyle()
  }

  // Italic button (if enabled)
  if (config.enableItalic) {
    const italicButton = document.createElement('button')
    italicButton.textContent = 'Italic'

    const hasMark = state.doc.rangeHasMark(from, to, state.schema.marks.em)
    if (hasMark) {
      italicButton.classList.add('active')
    }

    italicButton.onclick = () => {
      const { state, dispatch } = view
      const { from, to } = state.selection
      const hasMark = state.doc.rangeHasMark(from, to, state.schema.marks.em)

      const tr = state.tr

      if (hasMark) {
        tr.removeMark(from, to, state.schema.marks.em)
      } else {
        tr.addMark(from, to, state.schema.marks.em.create())
      }

      dispatch(tr)
      closeMenu()
    }

    menu.appendChild(italicButton)
  }

  // Translation buttons (if languages configured)
  if (config.translationLanguages && config.translationLanguages.length >= 2) {
    const hasTranslationMark = state.doc.rangeHasMark(from, to, state.schema.marks.translation)

    if (hasTranslationMark) {
      // Show "Remove Translation" button
      const removeTranslationButton = document.createElement('button')
      removeTranslationButton.textContent = 'Remove Translation'
      removeTranslationButton.onclick = () => {
        const { state, dispatch } = view
        // Toggle with any language pair to remove the mark
        toggleTranslationMark(
          {
            from: config.translationLanguages![0].code,
            to: config.translationLanguages![1].code,
          },
          state,
          dispatch,
        )
        closeMenu()
      }
      menu.appendChild(removeTranslationButton)
    } else {
      // Generate translation button pairs for all language combinations
      const languages = config.translationLanguages

      for (let i = 0; i < languages.length; i++) {
        for (let j = 0; j < languages.length; j++) {
          if (i !== j) {
            const fromLang = languages[i]
            const toLang = languages[j]

            const translationButton = document.createElement('button')
            translationButton.textContent = `${fromLang.name} → ${toLang.name}`
            translationButton.onclick = () => {
              const { state, dispatch } = view
              const selectedText = getSelectedTextForTranslation(state)

              // If callback provided, use it (for AI translation)
              if (config.onTranslationRequested) {
                config.onTranslationRequested(fromLang.code, toLang.code, selectedText)
              } else {
                // Otherwise just add the mark without translation
                toggleTranslationMark({ from: fromLang.code, to: toLang.code }, state, dispatch)
              }
              closeMenu()
            }

            menu.appendChild(translationButton)
          }
        }
      }
    }
  }

  document.body.appendChild(menu)

  return menu
}

function closeMenu() {
  const existingMenu = document.querySelector(`.${inlineMenuClass}`)
  if (existingMenu) {
    existingMenu.remove()
  }
}

function getSelectionBoundingBox(view: EditorView) {
  const { from, to } = view.state.selection
  const domSelection = window.getSelection()
  domSelection?.removeAllRanges()

  const range = document.createRange()
  range.setStart(view.domAtPos(from).node, view.domAtPos(from).offset)
  range.setEnd(view.domAtPos(to).node, view.domAtPos(to).offset)

  domSelection?.addRange(range)

  const rect = range.getBoundingClientRect()
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft

  return {
    top: rect.top + scrollTop,
    left: rect.left + scrollLeft,
  }
}

export function createInlineMenuPlugin(config: InlineMenuConfig = {}) {
  return new Plugin({
    key: menuPluginKey,
    view(_editorView) {
      return {
        update(view, _lastState) {
          const { state } = view
          const { selection } = state

          closeMenu() // Close menu on every update

          if (selection instanceof TextSelection && selection.from !== selection.to) {
            const startNode = selection.$from.node()
            const endNode = selection.$to.node()

            if (startNode.isTextblock && endNode.isTextblock) {
              const coords = getSelectionBoundingBox(view)
              createInlineMenu(view, coords, config)
            }
          }
        },
      }
    },
  })
}
