import { Schema } from 'prosemirror-model'

export const contentSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'text*',
      // not draggable or selectable for now, need to combine them into a single dataset for that
      marks: '_',
      attrs: {
        id: { default: null },
        extra: { default: null },
        extraLoading: { default: null },
      },
      toDOM(node) {
        return [
          'p',
          {
            id: node.attrs.id || '',
            'data-extra': node.attrs.extra || '',
            'data-extra-loading': node.attrs.extraLoading || '',
          },
          0,
        ]
      },
      parseDOM: [
        {
          tag: 'p',
          getAttrs(dom) {
            return {
              id: dom.getAttribute('id'),
              extra: dom.getAttribute('data-extra') || null,
              extraLoading: dom.getAttribute('data-extra-loading') || null,
            }
          },
        },
      ],
    },
    text: { inline: true },
  },
  marks: {
    strong: {
      toDOM() {
        return ['strong', 0]
      },
    },
    em: {
      toDOM() {
        return ['em', 0]
      },
    },
    translation: {
      attrs: { title: {}, from: {}, to: {} }, // Attribute to hold the title string
      parseDOM: [
        {
          tag: 'abbr[title][data-from][data-to]',
          getAttrs(dom) {
            return {
              title: dom.getAttribute('title'),
              from: dom.getAttribute('data-from'),
              to: dom.getAttribute('data-to'),
            }
          },
        },
      ],
      toDOM(node) {
        return [
          'abbr',
          {
            title: node.attrs.title,
            'data-from': node.attrs.from,
            'data-to': node.attrs.to,
            class: 'translation-mark',
          },
          0,
        ]
      },
    },
  },
})
