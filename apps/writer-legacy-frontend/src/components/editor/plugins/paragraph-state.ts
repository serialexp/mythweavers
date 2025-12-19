import type { SceneParagraph } from '@writer/shared'
import { Plugin, PluginKey } from 'prosemirror-state'

const paragraphStatePluginKey = new PluginKey('paragraphState')

export function createParagraphStatePlugin(paragraphs: () => SceneParagraph[]) {
  return new Plugin({
    key: paragraphStatePluginKey,

    props: {
      nodeViews: {
        paragraph(node, _view, _getPos) {
          const dom = document.createElement('p')
          const contentDOM = dom

          // Set paragraph ID and state attributes
          if (node.attrs.id) {
            dom.setAttribute('id', node.attrs.id)

            // Find the paragraph state from the store
            const paragraph = paragraphs().find((p) => p.id === node.attrs.id)
            if (paragraph) {
              dom.setAttribute('data-state', paragraph.state)
            } else {
              // Default to draft for new paragraphs
              dom.setAttribute('data-state', 'draft')
            }
          }

          // Add attrs from node if they exist
          if (node.attrs.extra) {
            dom.setAttribute('data-extra', node.attrs.extra)
          }
          if (node.attrs.extraLoading) {
            dom.setAttribute('data-extra-loading', node.attrs.extraLoading)
          }

          return { dom, contentDOM }
        },
      },
    },
  })
}
