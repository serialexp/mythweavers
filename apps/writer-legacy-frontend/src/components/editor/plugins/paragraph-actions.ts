import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { getParagraphIdAtPos } from '../utils/paragraph-conversion'
import { createIcon } from './icon-svgs'

const paragraphActionsPluginKey = new PluginKey('paragraphActions')

interface ParagraphActionsConfig {
  onMoveUp: (paragraphId: string) => void
  onMoveDown: (paragraphId: string) => void
  onDelete: (paragraphId: string) => void
  onAddAfter: (paragraphId: string) => void
  onGenerateBetween: (paragraphId: string) => void
  onSpellCheck: (paragraphId: string) => void
  onRewrite: (paragraphId: string) => void
  onRefineStyle: (paragraphId: string) => void
  onAddSensory: (paragraphId: string) => void
  onSetState: (paragraphId: string, state: 'draft' | 'revise' | 'ai' | 'final') => void
  isProtagonistSet: boolean
  // New callbacks for SolidJS components
  onToggleInventory?: (paragraphId: string) => void
  onTogglePlotpoint?: (paragraphId: string) => void
  onCustomRewrite?: (paragraphId: string) => void
  onTranslation?: (paragraphId: string) => void
  onConvertPerspective?: (paragraphId: string) => void
  onSplitScene?: (paragraphId: string) => void
}

function createActionButton(
  text: string,
  iconName: keyof typeof import('./icon-svgs').iconSvgs,
  onClick: () => void,
  disabled = false,
  title?: string,
): HTMLButtonElement {
  const button = document.createElement('button')
  button.className = `btn btn-sm ${disabled ? 'btn-disabled' : ''}`

  const iconElement = createIcon(iconName, 16)
  button.appendChild(iconElement)

  button.title = title || text
  button.disabled = disabled

  button.onmousedown = (event) => {
    event.preventDefault()
  }

  button.onclick = (event) => {
    event.preventDefault()
    if (!disabled) {
      onClick()
    }
  }

  return button
}

function createParagraphActionsMenu(
  view: EditorView,
  paragraphId: string,
  config: ParagraphActionsConfig,
  pos: number,
): HTMLElement {
  const menu = document.createElement('div')
  menu.className = 'paragraph-actions-menu'
  menu.style.cssText = `
    position: absolute;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 10px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    display: flex;
    gap: 6px;
    z-index: 20;
    flex-wrap: wrap;
    min-width: 600px;
  `

  // Movement buttons
  const moveGroup = document.createElement('div')
  moveGroup.style.cssText = 'display: flex; gap: 3px; margin-right: 12px;'

  moveGroup.appendChild(
    createActionButton('Move Up', 'arrowUp', () => config.onMoveUp(paragraphId), false, 'Move paragraph up'),
  )
  moveGroup.appendChild(
    createActionButton('Move Down', 'arrowDown', () => config.onMoveDown(paragraphId), false, 'Move paragraph down'),
  )
  moveGroup.appendChild(
    createActionButton(
      'Generate',
      'magicWand',
      () => config.onGenerateBetween(paragraphId),
      !config.isProtagonistSet,
      'Generate content after this paragraph',
    ),
  )

  // AI Tools
  const aiGroup = document.createElement('div')
  aiGroup.style.cssText = 'display: flex; gap: 3px; margin-right: 12px;'

  aiGroup.appendChild(
    createActionButton(
      'Spell Check',
      'spellCheck',
      () => {
        console.log('Spell check button clicked for paragraph:', paragraphId)
        config.onSpellCheck(paragraphId)
      },
      !config.isProtagonistSet,
      'Fix spelling and basic grammar',
    ),
  )
  aiGroup.appendChild(
    createActionButton(
      'Rewrite',
      'rewrite',
      () => config.onRewrite(paragraphId),
      !config.isProtagonistSet,
      'Rewrite with style improvements',
    ),
  )
  aiGroup.appendChild(
    createActionButton(
      'Refine',
      'star',
      () => config.onRefineStyle(paragraphId),
      !config.isProtagonistSet,
      'Refine paragraph style',
    ),
  )
  aiGroup.appendChild(
    createActionButton(
      'Sensory',
      'eye',
      () => config.onAddSensory(paragraphId),
      !config.isProtagonistSet,
      'Add sensory details',
    ),
  )

  // Context Tools (Inventory & Plotpoint)
  const contextGroup = document.createElement('div')
  contextGroup.style.cssText = 'display: flex; gap: 3px; margin-right: 12px;'

  if (config.onToggleInventory) {
    contextGroup.appendChild(
      createActionButton(
        'Inventory',
        'building',
        () => config.onToggleInventory!(paragraphId),
        false,
        'Toggle inventory actions',
      ),
    )
  }
  if (config.onTogglePlotpoint) {
    contextGroup.appendChild(
      createActionButton(
        'Plot Points',
        'timeline',
        () => config.onTogglePlotpoint!(paragraphId),
        false,
        'Toggle plotpoint actions',
      ),
    )
  }

  // More AI Tools
  const moreAiGroup = document.createElement('div')
  moreAiGroup.style.cssText = 'display: flex; gap: 3px; margin-right: 12px;'

  if (config.onCustomRewrite) {
    moreAiGroup.appendChild(
      createActionButton(
        'Custom Rewrite',
        'textEdit',
        () => config.onCustomRewrite!(paragraphId),
        !config.isProtagonistSet,
        'Custom rewrite instructions',
      ),
    )
  }
  if (config.onConvertPerspective) {
    moreAiGroup.appendChild(
      createActionButton(
        '1st Person',
        'person',
        () => config.onConvertPerspective!(paragraphId),
        !config.isProtagonistSet,
        'Convert to first person',
      ),
    )
  }

  // State buttons
  const stateGroup = document.createElement('div')
  stateGroup.style.cssText = 'display: flex; gap: 3px; margin-right: 12px;'

  stateGroup.appendChild(
    createActionButton('Draft', 'textD', () => config.onSetState(paragraphId, 'draft'), false, 'Set as Draft'),
  )
  stateGroup.appendChild(
    createActionButton('Revise', 'textR', () => config.onSetState(paragraphId, 'revise'), false, 'Set as Revise'),
  )
  stateGroup.appendChild(
    createActionButton('AI', 'textA', () => config.onSetState(paragraphId, 'ai'), false, 'Set as AI'),
  )
  stateGroup.appendChild(
    createActionButton('Final', 'textF', () => config.onSetState(paragraphId, 'final'), false, 'Set as Final'),
  )

  // Management buttons
  const managementGroup = document.createElement('div')
  managementGroup.style.cssText = 'display: flex; gap: 3px;'

  if (config.onTranslation) {
    managementGroup.appendChild(
      createActionButton('Translation', 'language', () => config.onTranslation!(paragraphId), false, 'Add translation'),
    )
  }
  if (config.onSplitScene) {
    managementGroup.appendChild(
      createActionButton(
        'Split Scene',
        'split',
        () => config.onSplitScene!(paragraphId),
        false,
        'Split into new scene',
      ),
    )
  }
  managementGroup.appendChild(
    createActionButton(
      'Add After',
      'plus',
      () => config.onAddAfter(paragraphId),
      false,
      'Add paragraph after this one',
    ),
  )
  managementGroup.appendChild(
    createActionButton('Delete', 'trash', () => config.onDelete(paragraphId), false, 'Delete this paragraph'),
  )

  menu.appendChild(moveGroup)
  menu.appendChild(aiGroup)
  if (contextGroup.children.length > 0) {
    menu.appendChild(contextGroup)
  }
  if (moreAiGroup.children.length > 0) {
    menu.appendChild(moreAiGroup)
  }
  menu.appendChild(stateGroup)
  menu.appendChild(managementGroup)

  // Function to update menu position
  const updatePosition = () => {
    const coords = view.coordsAtPos(pos)
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft

    menu.style.top = `${coords.top + scrollTop - 60}px`
    menu.style.left = `${coords.left + scrollLeft}px`
  }

  // Initial positioning
  updatePosition()

  // Add scroll listener to keep menu positioned correctly
  const scrollHandler = () => {
    updatePosition()
  }

  window.addEventListener('scroll', scrollHandler, { passive: true })

  // Also listen for scroll on the editor's DOM node in case it's in a scrollable container
  const editorDom = view.dom
  let scrollableParent = editorDom.parentElement
  const scrollableElements: Element[] = []

  // Find scrollable parent containers
  while (scrollableParent && scrollableParent !== document.body) {
    const style = window.getComputedStyle(scrollableParent)
    if (
      style.overflow === 'auto' ||
      style.overflow === 'scroll' ||
      style.overflowY === 'auto' ||
      style.overflowY === 'scroll'
    ) {
      scrollableElements.push(scrollableParent)
      scrollableParent.addEventListener('scroll', scrollHandler, { passive: true })
    }
    scrollableParent = scrollableParent.parentElement
  }
  // Store cleanup function on the menu element
  ;(menu as any)._cleanup = () => {
    window.removeEventListener('scroll', scrollHandler)
    scrollableElements.forEach((element) => {
      element.removeEventListener('scroll', scrollHandler)
    })
  }

  document.body.appendChild(menu)
  return menu
}

function closeParagraphActionsMenu() {
  const existingMenu = document.querySelector('.paragraph-actions-menu') as HTMLElement & { _cleanup?: () => void }
  if (existingMenu) {
    // Clean up scroll listener if it exists
    if (existingMenu._cleanup) {
      existingMenu._cleanup()
    }
    existingMenu.remove()
  }
}

export function createParagraphActionsPlugin(config: ParagraphActionsConfig) {
  return new Plugin({
    key: paragraphActionsPluginKey,

    view(_editorView) {
      return {
        update(view) {
          const { selection } = view.state
          closeParagraphActionsMenu()

          // Show menu when cursor is in a paragraph
          if (selection instanceof TextSelection && selection.empty) {
            const paragraphId = getParagraphIdAtPos(view.state.doc, selection.from)

            if (paragraphId) {
              console.log('Creating paragraph actions menu for paragraph:', paragraphId)
              // Position at the start of the paragraph for consistent positioning
              const $pos = view.state.doc.resolve(selection.from)
              const paragraphStart = $pos.start($pos.depth)

              createParagraphActionsMenu(view, paragraphId, config, paragraphStart)
            }
          }
        },

        destroy() {
          closeParagraphActionsMenu()
        },
      }
    },
  })
}
