/**
 * Unit tests for the pure parts of services/story and mcp/format.
 *
 * These need no database, so they stay fast and can be run in isolation with
 * `bun test tests/story-service-units.test.ts`. Everything that touches
 * Postgres is covered by nodes/outline/prose/mcp integration tests instead.
 */

import { describe, expect, test } from 'bun:test'
import { formatContent, formatEntities, formatOutline, formatSearch, formatStoryList } from '../src/mcp/format.js'
import { STORY_TOOLS } from '../src/mcp/tools.js'
import { ENTITY_FIELDS } from '../src/services/story/entities.js'
import { NODE_FIELDS } from '../src/services/story/nodes.js'
import type { OutlineNode, StoryOutline } from '../src/services/story/outline.js'
import { flattenOutline } from '../src/services/story/outline.js'
import { splitParagraphs } from '../src/services/story/prose.js'
import { CHILD_KIND, NODE_KINDS, PARENT_FK } from '../src/services/story/resolve.js'

describe('splitParagraphs', () => {
  test('splits on blank lines', () => {
    expect(splitParagraphs('one\n\ntwo\n\nthree')).toEqual(['one', 'two', 'three'])
  })

  test('treats whitespace-only lines as blank', () => {
    expect(splitParagraphs('one\n   \ntwo')).toEqual(['one', 'two'])
  })

  test('keeps single newlines inside a paragraph', () => {
    expect(splitParagraphs('one\ntwo')).toEqual(['one\ntwo'])
  })

  test('trims each block and drops empty ones', () => {
    expect(splitParagraphs('\n\n  padded  \n\n\n\n')).toEqual(['padded'])
  })

  test('returns an empty array for whitespace-only input', () => {
    expect(splitParagraphs('   \n\n  ')).toEqual([])
  })
})

describe('flattenOutline', () => {
  const tree: OutlineNode[] = [
    {
      kind: 'book',
      id: 'b1',
      name: 'Book One',
      sortOrder: 0,
      children: [
        {
          kind: 'arc',
          id: 'a1',
          name: 'Arc One',
          sortOrder: 0,
          children: [
            { kind: 'chapter', id: 'c1', name: 'Chapter One', sortOrder: 0, children: [] },
            { kind: 'chapter', id: 'c2', name: 'Chapter Two', sortOrder: 1, children: [] },
          ],
        },
      ],
    },
    { kind: 'book', id: 'b2', name: 'Book Two', sortOrder: 1, children: [] },
  ] as unknown as OutlineNode[]

  test('flattens depth-first with parentId and depth', () => {
    const flat = flattenOutline(tree)
    expect(flat.map((node) => node.id)).toEqual(['b1', 'a1', 'c1', 'c2', 'b2'])
    expect(flat.map((node) => node.depth)).toEqual([0, 1, 2, 2, 0])
    expect(flat.map((node) => node.parentId)).toEqual([null, 'b1', 'a1', 'a1', null])
  })

  test('drops the children key so the shape is serializable', () => {
    for (const node of flattenOutline(tree)) {
      expect('children' in node).toBe(false)
    }
  })

  test('the tree can be rebuilt from parentId', () => {
    const flat = flattenOutline(tree)
    const childrenOf = new Map<string | null, string[]>()
    for (const node of flat) {
      childrenOf.set(node.parentId, [...(childrenOf.get(node.parentId) ?? []), node.id])
    }
    expect(childrenOf.get(null)).toEqual(['b1', 'b2'])
    expect(childrenOf.get('a1')).toEqual(['c1', 'c2'])
  })

  test('handles an empty outline', () => {
    expect(flattenOutline([])).toEqual([])
  })
})

describe('node kind derivation', () => {
  test('each container yields the kind it holds', () => {
    expect(CHILD_KIND.story).toBe('book')
    expect(CHILD_KIND.book).toBe('arc')
    expect(CHILD_KIND.arc).toBe('chapter')
    expect(CHILD_KIND.chapter).toBe('scene')
    expect(CHILD_KIND.scene).toBeNull()
  })

  test('every node kind has a parent foreign key and a field whitelist', () => {
    for (const kind of NODE_KINDS) {
      expect(PARENT_FK[kind]).toBeTruthy()
      expect(NODE_FIELDS[kind].length).toBeGreaterThan(0)
    }
  })
})

describe('NODE_FIELDS whitelists', () => {
  test('every kind accepts the common naming/summary fields', () => {
    for (const kind of NODE_KINDS) {
      expect(NODE_FIELDS[kind]).toContain('name')
      expect(NODE_FIELDS[kind]).toContain('summary')
      expect(NODE_FIELDS[kind]).toContain('sentenceSummary')
      expect(NODE_FIELDS[kind]).toContain('paragraphSummary')
    }
  })

  test('scene-only fields are not accepted on other kinds', () => {
    for (const field of ['perspective', 'viewpointCharacterId', 'goal', 'includeInFull', 'storyTime']) {
      expect(NODE_FIELDS.scene).toContain(field)
      expect(NODE_FIELDS.book).not.toContain(field)
      expect(NODE_FIELDS.arc).not.toContain(field)
      expect(NODE_FIELDS.chapter).not.toContain(field)
    }
  })

  test('nodeType is a container concept, not a scene one', () => {
    expect(NODE_FIELDS.book).toContain('nodeType')
    expect(NODE_FIELDS.arc).toContain('nodeType')
    expect(NODE_FIELDS.chapter).toContain('nodeType')
    expect(NODE_FIELDS.scene).not.toContain('nodeType')
  })

  test('sortOrder is never directly writable — ordering goes through position', () => {
    for (const kind of NODE_KINDS) {
      expect(NODE_FIELDS[kind]).not.toContain('sortOrder')
      expect(NODE_FIELDS[kind]).not.toContain('order')
    }
  })

  test('deleted is not a create-time field', () => {
    for (const kind of NODE_KINDS) {
      expect(NODE_FIELDS[kind]).not.toContain('deleted')
    }
  })
})

describe('ENTITY_FIELDS whitelists', () => {
  test('characters and context items do not share their distinguishing fields', () => {
    expect(ENTITY_FIELDS.character).toContain('firstName')
    expect(ENTITY_FIELDS.contextItem).not.toContain('firstName')
    expect(ENTITY_FIELDS.contextItem).toContain('isGlobal')
    expect(ENTITY_FIELDS.character).not.toContain('isGlobal')
  })

  test('both accept a description', () => {
    expect(ENTITY_FIELDS.character).toContain('description')
    expect(ENTITY_FIELDS.contextItem).toContain('description')
  })

  test('storyId is never a writable field — it is scoped by the caller', () => {
    expect(ENTITY_FIELDS.character).not.toContain('storyId')
    expect(ENTITY_FIELDS.contextItem).not.toContain('storyId')
  })
})

describe('STORY_TOOLS definitions', () => {
  test('exposes exactly the six story tools', () => {
    expect(STORY_TOOLS.map((tool) => tool.name).sort()).toEqual([
      'mw_entity',
      'mw_node',
      'mw_outline',
      'mw_prose',
      'mw_read',
      'mw_search',
    ])
  })

  test('every tool has a description, an input schema and a handler', () => {
    for (const tool of STORY_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(40)
      expect(Object.keys(tool.inputSchema).length).toBeGreaterThan(0)
      expect(typeof tool.handler).toBe('function')
    }
  })

  test('tool names are unique', () => {
    const names = STORY_TOOLS.map((tool) => tool.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('formatOutline', () => {
  const outline: StoryOutline = {
    storyId: 's1',
    storyName: 'Test Story',
    root: { kind: 'story', id: 's1', name: 'Test Story' },
    depth: 'chapter',
    totalWords: 1500,
    counts: { book: 1, arc: 1, chapter: 2, scene: 0 },
    nodes: [],
  } as unknown as StoryOutline

  test('tags every node with [kind:id] and indents by depth', () => {
    const text = formatOutline(outline, [
      { kind: 'book', id: 'b1', name: 'Book One', parentId: null, depth: 0, sortOrder: 0 },
      {
        kind: 'chapter',
        id: 'c1',
        name: 'The Crossing',
        parentId: 'b1',
        depth: 1,
        sortOrder: 0,
        wordCount: 1500,
        status: 'draft',
      },
    ] as never)

    expect(text).toContain('[story:s1]')
    expect(text).toContain('[book:b1] Book One')
    expect(text).toContain('  [chapter:c1] The Crossing — draft, 1,500w')
  })

  test('says so when the requested level is empty', () => {
    expect(formatOutline(outline, [])).toContain('(no chapters yet)')
  })

  test('names untitled nodes rather than emitting a blank line', () => {
    const text = formatOutline(outline, [
      { kind: 'book', id: 'b1', name: '', parentId: null, depth: 0, sortOrder: 0 },
    ] as never)
    expect(text).toContain('[book:b1] (untitled)')
  })
})

describe('formatContent', () => {
  const content = {
    storyId: 's1',
    root: { kind: 'chapter', id: 'c1', name: 'The Crossing' },
    words: 12,
    chapters: [
      {
        id: 'c1',
        name: 'The Crossing',
        status: 'draft',
        words: 12,
        scenes: [
          {
            id: 'sc1',
            name: 'Riverbank',
            status: 'draft',
            perspective: 'THIRD',
            viewpointCharacterId: 'ch1',
            viewpointCharacterName: 'Mara',
            goal: 'cross unseen',
            includeInFull: 2,
            words: 12,
            messages: [
              {
                id: 'm1',
                type: null,
                isQuery: false,
                options: null,
                paragraphs: [
                  { id: 'p1', body: 'The river ran black under the bridge.', state: 'DRAFT', words: 7 },
                  { id: 'p2', body: 'Mara counted the guards twice.', state: null, words: 5 },
                ],
              },
            ],
          },
        ],
      },
    ],
  }

  test('emits paragraph ids inline so they can be edited directly', () => {
    const text = formatContent(content as never)
    expect(text).toContain('[p:p1] The river ran black under the bridge.')
    expect(text).toContain('[p:p2] Mara counted the guards twice.')
  })

  test('does not repeat the chapter heading when the chapter is the root', () => {
    const text = formatContent(content as never)
    expect(text.match(/# The Crossing/g)?.length ?? 0).toBe(0)
    expect(text.startsWith('The Crossing [chapter:c1]')).toBe(true)
  })

  test('shows POV, status and goal for each scene', () => {
    const text = formatContent(content as never)
    expect(text).toContain('## Riverbank [scene:sc1]')
    expect(text).toContain('POV Mara (THIRD) · draft · goal: cross unseen')
  })

  test('marks structural messages but not ordinary prose ones', () => {
    const plain = formatContent(content as never)
    expect(plain).not.toContain('«')

    const branched = structuredClone(content)
    branched.chapters[0].scenes[0].messages[0].type = 'branch'
    expect(formatContent(branched as never)).toContain('«branch message [message:m1]»')
  })

  test('marks an empty scene rather than rendering nothing', () => {
    const empty = structuredClone(content)
    empty.chapters[0].scenes[0].messages = []
    expect(formatContent(empty as never)).toContain('(empty)')
  })
})

describe('formatSearch', () => {
  test('reports no matches plainly', () => {
    const text = formatSearch({ storyId: 's1', query: 'amulet', scope: 'prose', truncated: false, hits: [] } as never)
    expect(text).toBe('No matches for "amulet" in prose.')
  })

  test('renders a prose hit with its paragraph and scene ids', () => {
    const text = formatSearch({
      storyId: 's1',
      query: 'amulet',
      scope: 'all',
      truncated: false,
      hits: [
        {
          kind: 'prose',
          paragraphId: 'p1',
          messageId: 'm1',
          sceneId: 'sc1',
          sceneName: 'Riverbank',
          chapterId: 'c1',
          chapterName: 'The Crossing',
          snippet: '…the amulet burned…',
        },
      ],
    } as never)

    expect(text).toContain('1 match for "amulet"')
    expect(text).toContain('prose [p:p1] — The Crossing › Riverbank [scene:sc1]')
    expect(text).toContain('…the amulet burned…')
  })

  test('warns when results were cut off', () => {
    const text = formatSearch({
      storyId: 's1',
      query: 'the',
      scope: 'all',
      truncated: true,
      hits: [{ kind: 'character', id: 'ch1', name: 'Mara', field: 'description', snippet: '…the…' }],
    } as never)
    expect(text).toContain('truncated')
    expect(text).toContain('character [character:ch1] Mara (description)')
  })
})

describe('formatStoryList and formatEntities', () => {
  test('lists stories with ids and update dates', () => {
    const text = formatStoryList([
      { id: 's1', name: 'Test Story', summary: 'A tale.', status: 'ONGOING', updatedAt: '2026-01-02T03:04:05.000Z' },
    ])
    expect(text).toContain('[story:s1] Test Story — ongoing, updated 2026-01-02')
    expect(text).toContain('A tale.')
  })

  test('handles having no stories', () => {
    expect(formatStoryList([])).toBe('You have no stories yet.')
  })

  test('renders characters and context items with their ids', () => {
    const text = formatEntities({
      characters: [
        { id: 'ch1', firstName: 'Mara', lastName: 'Vane', isMainCharacter: true, description: 'A smuggler.' },
      ],
      contextItems: [{ id: 'ci1', name: 'The Amulet', type: 'plot', isGlobal: true, description: 'Burns.' }],
    })
    expect(text).toContain('[character:ch1] Mara Vane — main')
    expect(text).toContain('A smuggler.')
    expect(text).toContain('[contextItem:ci1] The Amulet (plot, global)')
  })

  test('handles an empty story bible', () => {
    expect(formatEntities({ characters: [], contextItems: [] })).toBe('No characters or context items yet.')
  })
})
