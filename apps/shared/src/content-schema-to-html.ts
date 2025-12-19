import { encode } from 'html-entities'
import type { ContentNode } from './schema.js'

export const contentSchemaToHtml = (content: ContentNode): string => {
  return content.content
    ?.map((node) => {
      if (node.type === 'paragraph') {
        return node.content
          ?.map((textNode) => {
            const translationMark = textNode.marks?.find((mark) => mark.type === 'translation')
            if (translationMark) {
              return `<span title="${encode(translationMark.attrs.title)}">${textNode.text}</span>`
            }
            return textNode.text
          })
          .join('')
      }
    })
    .join('')
}

export const contentSchemaToText = (content: ContentNode): string => {
  return content.content?.map((node) => node.content?.map((textNode) => textNode.text).join('')).join('') ?? ''
}
