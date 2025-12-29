import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { Message, Node } from '../types/core'
import { buildPrecedingContextMarkdown } from './nodeContentExport'

const createChapter = (overrides: Partial<Node>): Node => {
  const now = new Date()
  return {
    id: 'chapter-id',
    storyId: 'story-1',
    parentId: 'arc-1',
    type: 'chapter',
    title: 'Untitled',
    order: 0,
    includeInFull: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

const createMessage = (overrides: Partial<Message>): Message => {
  const now = new Date()
  return {
    id: 'message-id',
    role: 'assistant',
    content: 'Sample content',
    timestamp: now,
    order: 0,
    isQuery: false,
    ...overrides,
  }
}

describe('buildPrecedingContextMarkdown', () => {
  beforeEach(() => {
    const now = new Date()

    charactersStore.setCharacters([
      {
        id: 'char-1',
        firstName: 'Aria',
        lastName: 'Star',
        description: 'Rebel pilot leading the charge.',
        isMainCharacter: true,
      },
      {
        id: 'char-2',
        firstName: 'Darius',
        lastName: 'Venn',
        description: 'Shrewd diplomat with questionable loyalties.',
        isMainCharacter: false,
      },
    ])

    contextItemsStore.setContextItems([
      {
        id: 'ctx-1',
        name: 'Cosmic War',
        description: 'Galaxy-spanning conflict between rival factions.',
        isGlobal: true,
        type: 'theme',
      },
      {
        id: 'ctx-2',
        name: 'Hidden Temple',
        description: 'Ancient ruins soaked by relentless rain.',
        isGlobal: false,
        type: 'location',
      },
    ])

    nodeStore.setNodes([
      {
        id: 'book-1',
        storyId: 'story-1',
        type: 'book',
        title: 'Book Root',
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'arc-1',
        storyId: 'story-1',
        parentId: 'book-1',
        type: 'arc',
        title: 'Main Arc',
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      createChapter({
        id: 'ch-1',
        title: 'Opening',
        order: 0,
        summary: 'Opening summary',
        activeCharacterIds: ['char-1'],
        activeContextItemIds: ['ctx-2'],
      }),
      createChapter({
        id: 'ch-2',
        title: 'Second Act',
        order: 1,
        activeCharacterIds: ['char-2'],
      }),
      createChapter({
        id: 'ch-3',
        title: 'Climax',
        order: 2,
      }),
    ])

    messagesStore.setMessages([
      createMessage({
        id: 'm-1',
        content: 'Opening scene content',
        order: 0,
        sceneId: 'ch-1',
      }),
      createMessage({
        id: 'm-2',
        content: 'Second act moment one.\n\nSecond act moment two.',
        order: 1,
        sceneId: 'ch-2',
      }),
      createMessage({
        id: 'm-3',
        content: 'Climax scene content',
        order: 2,
        sceneId: 'ch-3',
      }),
    ])
  })

  afterEach(() => {
    nodeStore.setNodes([])
    messagesStore.setMessages([])
    charactersStore.setCharacters([])
    contextItemsStore.setContextItems([])
  })

  it('returns markdown summary for chapters preceding the target', () => {
    const result = buildPrecedingContextMarkdown('ch-3')

    expect(result).toContain('## Characters')
    expect(result).toContain('- Aria Star (protagonist): Rebel pilot leading the charge.')
    expect(result).toContain('- Darius Venn: Shrewd diplomat with questionable loyalties.')

    expect(result).toContain('## Context Items')
    expect(result).toContain('- Cosmic War (global): Galaxy-spanning conflict between rival factions.')
    expect(result).toContain('- Hidden Temple: Ancient ruins soaked by relentless rain.')

    expect(result).toContain('## Opening')
    expect(result).toContain('Opening summary')

    expect(result).toContain('## Second Act')
    expect(result).toContain('Second act moment one.')
    expect(result).not.toContain('Climax')
  })

  it('returns empty string when there are no preceding chapters', () => {
    const result = buildPrecedingContextMarkdown('ch-1')
    expect(result).toBe('')
  })
})
