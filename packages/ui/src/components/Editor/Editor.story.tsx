import type { Paragraph } from '@mythweavers/shared'
import {
  DecorationSet,
  EditorState,
  EditorView,
  InlineContent,
  type NodeViewProps,
  setPosInfo,
  widget,
} from '@writer/solid-editor'
import shortUUID from 'short-uuid'
import { createEffect, createSignal } from 'solid-js'
import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { SolidEditorWrapper, storySchema } from './solid-editor'
import { MentionView } from './solid-editor/MentionView'

// Sample paragraphs for the demo
const createSampleParagraphs = (): Paragraph[] => [
  {
    id: shortUUID.generate(),
    body: 'The morning sun cast long shadows across the cobblestone streets of the old town. Maria walked slowly, her footsteps echoing in the quiet.',
    state: 'final',
    comments: [],
  },
  {
    id: shortUUID.generate(),
    body: 'She paused at the corner, glancing back at the café where they had first met. The memories came flooding back, bittersweet and vivid.',
    state: 'draft',
    comments: [],
  },
  {
    id: shortUUID.generate(),
    body: '"I should have said something," she whispered to herself. But the moment had passed, like so many others before it.',
    state: 'revise',
    comments: [],
  },
]

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="SolidEditor" group="editor">
      <Hst.Variant title="Basic Editor">
        <ThemeComparison>
          {(() => {
            const [paragraphs, setParagraphs] = createSignal<Paragraph[]>(createSampleParagraphs())

            const handleParagraphsChange = (newParagraphs: Paragraph[], _changedIds: string[]) => {
              setParagraphs(newParagraphs)
            }

            const handleParagraphCreate = (paragraph: Omit<Paragraph, 'id'>, afterId?: string): string => {
              const newId = shortUUID.generate()
              const newParagraph = { ...paragraph, id: newId }

              setParagraphs((prev) => {
                if (afterId) {
                  const index = prev.findIndex((p) => p.id === afterId)
                  if (index !== -1) {
                    return [...prev.slice(0, index + 1), newParagraph, ...prev.slice(index + 1)]
                  }
                }
                return [...prev, newParagraph]
              })

              return newId
            }

            const handleParagraphDelete = (paragraphId: string) => {
              setParagraphs((prev) => prev.filter((p) => p.id !== paragraphId))
            }

            // Paragraph action handlers for the floating menu
            const paragraphActions = {
              moveUp: (id: string) => {
                setParagraphs((prev) => {
                  const idx = prev.findIndex((p) => p.id === id)
                  if (idx <= 0) return prev
                  const newArr = [...prev]
                  ;[newArr[idx - 1], newArr[idx]] = [newArr[idx], newArr[idx - 1]]
                  return newArr
                })
              },
              moveDown: (id: string) => {
                setParagraphs((prev) => {
                  const idx = prev.findIndex((p) => p.id === id)
                  if (idx < 0 || idx >= prev.length - 1) return prev
                  const newArr = [...prev]
                  ;[newArr[idx], newArr[idx + 1]] = [newArr[idx + 1], newArr[idx]]
                  return newArr
                })
              },
              delete: handleParagraphDelete,
              setState: (id: string, state: 'draft' | 'revise' | 'ai' | 'final' | 'sdt') => {
                setParagraphs((prev) => prev.map((p) => (p.id === id ? { ...p, state } : p)))
              },
            }

            return (
              <div style={{ padding: '1rem' }}>
                <SolidEditorWrapper
                  paragraphs={paragraphs()}
                  onParagraphsChange={handleParagraphsChange}
                  onParagraphCreate={handleParagraphCreate}
                  onParagraphDelete={handleParagraphDelete}
                  onParagraphAction={paragraphActions}
                  isProtagonistSet={true}
                  debug
                />
              </div>
            )
          })()}
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Paragraph States">
        <ThemeComparison>
          {(() => {
            const states: Array<Paragraph['state']> = ['draft', 'revise', 'ai', 'final', 'sdt']
            const [paragraphs] = createSignal<Paragraph[]>(
              states.map((state, _i) => ({
                id: shortUUID.generate(),
                body: `This paragraph has the "${state}" state. Click on it to see the action menu.`,
                state,
                comments: [],
              })),
            )

            return (
              <div style={{ padding: '1rem' }}>
                <p style={{ 'margin-bottom': '1rem', 'font-size': '0.875rem', color: 'var(--color-text-secondary)' }}>
                  Paragraph states are indicated by the left border color: Draft (yellow), Revise (red), AI (purple),
                  Final (green), SDT (blue)
                </p>
                <SolidEditorWrapper
                  paragraphs={paragraphs()}
                  onParagraphsChange={() => {}}
                  onParagraphCreate={() => ''}
                  onParagraphDelete={() => {}}
                  isProtagonistSet={true}
                  debug
                />
              </div>
            )
          })()}
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Empty Editor">
        <ThemeComparison>
          {(() => {
            const [paragraphs, setParagraphs] = createSignal<Paragraph[]>([
              {
                id: shortUUID.generate(),
                body: '',
                state: 'draft',
                comments: [],
              },
            ])

            return (
              <div style={{ padding: '1rem' }}>
                <p style={{ 'margin-bottom': '1rem', 'font-size': '0.875rem', color: 'var(--color-text-secondary)' }}>
                  Empty paragraphs show a placeholder. Try typing something!
                </p>
                <SolidEditorWrapper
                  paragraphs={paragraphs()}
                  onParagraphsChange={(p) => setParagraphs(p)}
                  onParagraphCreate={() => shortUUID.generate()}
                  onParagraphDelete={() => {}}
                  isProtagonistSet={false}
                  debug
                />
              </div>
            )
          })()}
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Widget Decorations Test">
        <ThemeComparison>
          {(() => {
            const [paragraphs, setParagraphs] = createSignal<Paragraph[]>([
              {
                id: 'test-para-1',
                body: 'Click in this paragraph to see the action button on the right.',
                state: 'draft',
                comments: [],
              },
            ])

            // Simple paragraph action handlers
            const paragraphActions = {
              moveUp: (id: string) => console.log('Move up:', id),
              moveDown: (id: string) => console.log('Move down:', id),
              delete: (id: string) => console.log('Delete:', id),
              setState: (id: string, state: 'draft' | 'revise' | 'ai' | 'final' | 'sdt') => {
                console.log('Set state:', id, state)
                setParagraphs((prev) => prev.map((p) => (p.id === id ? { ...p, state } : p)))
              },
            }

            return (
              <div style={{ padding: '1rem' }}>
                <p style={{ 'margin-bottom': '1rem', 'font-size': '0.875rem', color: 'var(--color-text-secondary)' }}>
                  Focus the editor and place cursor in the paragraph. A "⋮" button should appear on the right side.
                </p>
                <SolidEditorWrapper
                  paragraphs={paragraphs()}
                  onParagraphsChange={(p) => setParagraphs(p)}
                  onParagraphCreate={() => 'new-id'}
                  onParagraphDelete={() => {}}
                  onParagraphAction={paragraphActions}
                  isProtagonistSet={true}
                />
              </div>
            )
          })()}
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Widget Warning Test (Broken NodeView)">
        <ThemeComparison>
          {(() => {
            // Deliberately broken nodeView that doesn't render WidgetsAt
            const BrokenParagraphView = (props: NodeViewProps) => {
              let elementRef: HTMLParagraphElement | undefined

              createEffect(() => {
                if (elementRef) {
                  setPosInfo(elementRef, { pos: props.pos, node: props.node })
                }
              })

              // This nodeView is MISSING <WidgetsAt> - widgets won't render!
              return (
                <p
                  id={props.node.attrs.id as string}
                  class="solid-editor-paragraph"
                  style={{ background: '#fff3cd' }}
                  ref={(el) => (elementRef = el)}
                >
                  {props.node.content.size > 0 ? (
                    <InlineContent
                      node={props.node}
                      startPos={props.pos + 1}
                      decorations={undefined}
                      nodeViews={props.nodeViews}
                      selection={props.selection}
                      onSelectNode={props.onSelectNode}
                    />
                  ) : (
                    <br />
                  )}
                </p>
              )
            }

            // Create decorations that add a widget
            const createTestDecorations = () => (state: EditorState) => {
              const { selection } = state
              if (selection.from === selection.to) {
                // Find the paragraph and add a widget at the end
                let widgetPos = 0
                state.doc.descendants((node, pos) => {
                  if (node.type.name === 'paragraph') {
                    widgetPos = pos + node.nodeSize - 1
                    return false
                  }
                  return true
                })
                if (widgetPos > 0) {
                  return DecorationSet.create(state.doc, [
                    widget(widgetPos, () => <span style={{ color: 'red' }}>[WIDGET]</span>, {
                      side: 1,
                      key: 'test-widget',
                    }),
                  ])
                }
              }
              return DecorationSet.empty
            }

            const [state, setState] = createSignal(
              EditorState.create({
                doc: storySchema.nodes.doc.create(null, [
                  storySchema.nodes.paragraph.create({ id: 'broken-para' }, [
                    storySchema.text('This paragraph uses a BROKEN nodeView that does NOT render widgets.'),
                  ]),
                ]),
                schema: storySchema,
              }),
            )

            return (
              <div style={{ padding: '1rem' }}>
                <p style={{ 'margin-bottom': '1rem', 'font-size': '0.875rem', color: 'var(--color-text-secondary)' }}>
                  <strong>Check the console!</strong> This uses a broken nodeView that doesn't render WidgetsAt. You
                  should see a warning: "[DecorationSet] widget decoration(s) were created but never queried..."
                </p>
                <div style={{ border: '1px solid var(--color-border)', 'border-radius': '4px' }}>
                  <EditorView
                    state={state()}
                    onStateChange={setState}
                    nodeViews={{ paragraph: BrokenParagraphView }}
                    props={{ decorations: createTestDecorations() }}
                    editable={true}
                    autoFocus={false}
                  />
                </div>
              </div>
            )
          })()}
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Mentions (Inline Nodes)">
        <ThemeComparison>
          {(() => {
            // Create a document with mentions directly using the schema
            const createDocWithMentions = () => {
              const { nodes } = storySchema
              return nodes.doc.create(null, [
                nodes.paragraph.create({ id: 'p1' }, [
                  storySchema.text('The hero '),
                  nodes.mention.create({ id: 'char-1', label: 'Elena', mentionType: 'character' }),
                  storySchema.text(' traveled to '),
                  nodes.mention.create({ id: 'loc-1', label: 'Crystal Valley', mentionType: 'location' }),
                  storySchema.text(' to find the legendary '),
                  nodes.mention.create({ id: 'item-1', label: 'Sword of Dawn', mentionType: 'item' }),
                  storySchema.text('.'),
                ]),
                nodes.paragraph.create({ id: 'p2' }, [
                  storySchema.text('She met '),
                  nodes.mention.create({ id: 'char-2', label: 'Marcus', mentionType: 'character' }),
                  storySchema.text(' during the '),
                  nodes.mention.create({ id: 'event-1', label: 'Festival of Lights', mentionType: 'event' }),
                  storySchema.text(' and they became allies.'),
                ]),
                nodes.paragraph.create({ id: 'p3' }, [
                  storySchema.text('Different mention types: '),
                  nodes.mention.create({ id: 'char-3', label: 'Character', mentionType: 'character' }),
                  storySchema.text(', '),
                  nodes.mention.create({ id: 'loc-2', label: 'Location', mentionType: 'location' }),
                  storySchema.text(', '),
                  nodes.mention.create({ id: 'item-2', label: 'Item', mentionType: 'item' }),
                  storySchema.text(', '),
                  nodes.mention.create({ id: 'event-2', label: 'Event', mentionType: 'event' }),
                  storySchema.text(', '),
                  nodes.mention.create({ id: 'custom-1', label: 'Custom', mentionType: 'custom' }),
                ]),
              ])
            }

            const [state, setState] = createSignal(
              EditorState.create({
                doc: createDocWithMentions(),
                schema: storySchema,
              }),
            )

            const nodeViews = {
              mention: MentionView,
            }

            return (
              <div style={{ padding: '1rem' }}>
                <p style={{ 'margin-bottom': '1rem', 'font-size': '0.875rem', color: 'var(--color-text-secondary)' }}>
                  Inline mention nodes with different types: character (blue), location (green), item (orange), event
                  (purple), custom (gray).
                </p>
                <div style={{ border: '1px solid var(--color-border)', 'border-radius': '4px' }}>
                  <EditorView
                    state={state()}
                    onStateChange={setState}
                    nodeViews={nodeViews}
                    editable={true}
                    autoFocus={false}
                    debug
                  />
                </div>
              </div>
            )
          })()}
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
