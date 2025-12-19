import type { ContentNode } from '@writer/shared'
import { encode } from 'html-entities'

export const contentSchemaToHtml = (
  content: ContentNode,
  options?: {
    translationsInline?: boolean
  },
): string => {
  return content.content
    ?.map((node) => {
      if (node.type === 'paragraph') {
        return node.content
          ?.map((textNode) => {
            const translationMark = textNode.marks?.find((mark) => mark.type === 'translation')
            if (translationMark && options?.translationsInline) {
              return `<span>${textNode.text}</span> <i class="translation">${translationMark.attrs.title}</i>`
            }
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

export const contentSchemaToText = (
  content: ContentNode,
  options?: {
    translationsInline?: boolean
  },
): string => {
  return content.content
    ?.map(
      (node) =>
        node.content
          ?.map((textNode) => {
            const translationMark = textNode.marks?.find((mark) => mark.type === 'translation')
            if (translationMark && options?.translationsInline) {
              return `${textNode.text} (${translationMark.attrs.title})`
            }
            return textNode.text
          })
          .join('') ?? '',
    )
    .join('\n')
}
