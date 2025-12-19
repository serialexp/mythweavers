import { Schema, type SchemaSpec } from '@writer/solid-editor'

/**
 * Mention types for different entity categories
 */
export type MentionType = 'character' | 'location' | 'item' | 'event' | 'custom'

/**
 * Shared schema specification that can be used by both ProseMirror and solid-editor.
 *
 * This defines the document structure:
 * - doc: Root node containing block+ content
 * - paragraph: Block node with id, extra, extraLoading attrs
 * - text: Inline text content
 * - mention: Inline atom node for @mentions
 *
 * Marks:
 * - strong: Bold text
 * - em: Italic/emphasis
 * - translation: Translation with title, from, to attrs
 *
 * Note: ProseMirror-specific toDOM/parseDOM are added separately in ../schema.ts
 */
export const schemaSpec: SchemaSpec = {
  nodes: {
    doc: {
      content: 'block+',
    },
    paragraph: {
      group: 'block',
      content: 'inline*', // Allow inline nodes (text and mentions)
      marks: '_', // Allow all marks
      attrs: {
        id: { default: null },
        extra: { default: null },
        extraLoading: { default: null },
      },
    },
    text: {
      group: 'inline',
    },
    /**
     * Mention node - an inline atom that references characters, locations, etc.
     * Rendered as a styled span with the entity's label.
     */
    mention: {
      group: 'inline',
      inline: true,
      atom: true, // Not directly editable
      attrs: {
        /** The unique ID of the mentioned entity */
        id: { default: null },
        /** Display label for the mention */
        label: { default: '' },
        /** Type of mention: character, location, item, event, custom */
        mentionType: { default: 'character' },
      },
      // Used by LeafNodeView to render text representation
      leafText: (node: { attrs: { label?: string } }) => `@${node.attrs.label || ''}`,
    },
  },
  marks: {
    strong: {},
    em: {},
    translation: {
      attrs: {
        title: { default: '' },
        from: { default: '' },
        to: { default: '' },
      },
    },
  },
}

/**
 * Solid-editor schema instance created from the shared spec.
 * Use this with solid-editor's EditorState and EditorView.
 */
export const storySchema = new Schema(schemaSpec)

export type StorySchema = typeof storySchema
