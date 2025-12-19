import { setBlockType } from 'prosemirror-commands'
import { Command, PluginKey, TextSelection } from 'prosemirror-state'
import { Plugin } from 'prosemirror-state'
import { DecorationSet, EditorView } from 'prosemirror-view'
import { contentSchema } from '../schema'

const blockMenuPluginKey = new PluginKey('blockMenuPlugin')

function createBlockTypeButton(label: string, command: Command, view: EditorView) {
  const button = document.createElement('button')
  button.textContent = label

  button.onmousedown = (event) => {
    event.preventDefault() // To prevent losing editor focus
  }

  button.onclick = () => {
    const { state, dispatch } = view
    // Debugging log added here
    console.log(`Attempting to set block type with label: ${label}`)

    if (command(state, dispatch)) {
      view.focus() // Maintain focus on the editor
      closeBlockMenu()
    } else {
      console.log(`Failed to execute command for ${label}`)
    }
  }

  return button
}

function createBlockMenu(view: EditorView, pos: number) {
  const blockMenu = document.createElement('div')
  blockMenu.className = 'block-menu'
  blockMenu.style.position = 'absolute'

  const blockTypeOptions = ['paragraph', 'heading', 'blockquote']

  for (const type of blockTypeOptions) {
    const command = setBlockType(contentSchema.nodes[type])
    const button = createBlockTypeButton(type[0], command, view)
    blockMenu.appendChild(button)
  }

  const coords = view.coordsAtPos(pos)
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft

  blockMenu.style.top = `${coords.top + scrollTop - 7}px`
  blockMenu.style.left = `${coords.left + scrollLeft - 85}px` // Adjust x-offset

  document.body.appendChild(blockMenu)
  return blockMenu
}

function closeBlockMenu() {
  const existingMenu = document.querySelector('.block-menu')
  if (existingMenu) {
    existingMenu.remove()
  }
}

export const blockMenuPlugin = new Plugin({
  key: blockMenuPluginKey,
  state: {
    init: () => DecorationSet.empty,
    apply: (tr, decorationSet) => (tr.docChanged ? DecorationSet.empty.map(tr.mapping, tr.doc) : decorationSet),
  },
  view(_editorView) {
    return {
      update(view) {
        const { selection } = view.state
        closeBlockMenu()

        // Only show the menu when there's a caret or node selection
        if (!(selection instanceof TextSelection) || selection.from === selection.to) {
          const currentBlockPos = selection.$from.before(selection.$from.depth)
          if (currentBlockPos !== undefined) {
            createBlockMenu(view, currentBlockPos)
          }
        }
      },
    }
  },
})
