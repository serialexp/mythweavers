import { Schema } from '../src/model'
import { type MarkBuilder, type NodeBuilder, builders } from './builder'

/**
 * A basic schema for testing, similar to prosemirror-schema-basic.
 */
export const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    blockquote: { content: 'block+', group: 'block' },
    heading: {
      content: 'inline*',
      group: 'block',
      attrs: { level: { default: 1 } },
    },
    code_block: {
      content: 'text*',
      group: 'block',
      code: true,
      marks: '',
    },
    horizontal_rule: { group: 'block' },
    text: { group: 'inline' },
    image: {
      inline: true,
      group: 'inline',
      attrs: {
        src: { validate: 'string' },
        alt: { default: null },
        title: { default: null },
      },
    },
    hard_break: { inline: true, group: 'inline' },
    bullet_list: { content: 'list_item+', group: 'block' },
    ordered_list: {
      content: 'list_item+',
      group: 'block',
      attrs: { order: { default: 1 } },
    },
    list_item: { content: 'paragraph block*' },
  },
  marks: {
    em: {},
    strong: {},
    code: { excludes: '_' },
    link: {
      attrs: {
        href: { validate: 'string' },
        title: { default: null },
      },
    },
  },
})

// Create builders
const b = builders(schema, {
  p: { nodeType: 'paragraph' },
  pre: { nodeType: 'code_block' },
  h1: { nodeType: 'heading', level: 1 },
  h2: { nodeType: 'heading', level: 2 },
  h3: { nodeType: 'heading', level: 3 },
  li: { nodeType: 'list_item' },
  ul: { nodeType: 'bullet_list' },
  ol: { nodeType: 'ordered_list' },
  br: { nodeType: 'hard_break' },
  img: { nodeType: 'image', src: 'img.png' },
  hr: { nodeType: 'horizontal_rule' },
  a: { markType: 'link', href: 'https://example.com' },
})

// Export individual builders
export const doc: NodeBuilder = b.doc as NodeBuilder
export const p: NodeBuilder = b.p as NodeBuilder
export const pre: NodeBuilder = b.pre as NodeBuilder
export const h1: NodeBuilder = b.h1 as NodeBuilder
export const h2: NodeBuilder = b.h2 as NodeBuilder
export const h3: NodeBuilder = b.h3 as NodeBuilder
export const li: NodeBuilder = b.li as NodeBuilder
export const ul: NodeBuilder = b.ul as NodeBuilder
export const ol: NodeBuilder = b.ol as NodeBuilder
export const br: NodeBuilder = b.br as NodeBuilder
export const img: NodeBuilder = b.img as NodeBuilder
export const hr: NodeBuilder = b.hr as NodeBuilder
export const blockquote: NodeBuilder = b.blockquote as NodeBuilder
export const a: MarkBuilder = b.a as MarkBuilder
export const em: MarkBuilder = b.em as MarkBuilder
export const strong: MarkBuilder = b.strong as MarkBuilder
export const code: MarkBuilder = b.code as MarkBuilder
