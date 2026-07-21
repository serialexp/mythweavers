import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Message, Node } from '../types/core'
import { type ContextGenerationOptions, generateContextMessages } from './contextGeneration'

// Mock dependencies
vi.mock('../stores/messagesStore', () => ({
  messagesStore: {
    setIsAnalyzing: vi.fn(),
  },
}))

vi.mock('./smartContext', () => ({
  buildSmartContext: vi.fn(),
}))

vi.mock('./storyUtils', () => ({
  getStoryPrompt: vi.fn().mockImplementation((setting) => {
    return `System prompt for ${setting} story`
  }),
  getStoryInstructions: vi.fn().mockImplementation(() => {
    return 'Story writing instructions'
  }),
}))

describe('generateContextMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMessage = (overrides: Partial<Message>): Message => ({
    id: 'msg-1',
    role: 'assistant',
    content: 'Test content',
    timestamp: new Date('2024-01-01'),
    order: 0,
    isQuery: false,
    ...overrides,
  })

  describe('Story Context', () => {
    it('should generate basic story context without chapters', async () => {
      const messages: Message[] = [
        createMessage({ id: 'msg-1', content: 'First message' }),
        createMessage({ id: 'msg-2', content: 'Second message' }),
        createMessage({ id: 'msg-3', content: 'Third message' }),
      ]

      const options: ContextGenerationOptions = {
        inputText: 'Continue the story',
        messages,
        contextType: 'story',
        storySetting: 'fantasy',
        person: 'third',
        tense: 'past',
      }

      const result = await generateContextMessages(options)

      // system + 3 messages + instructions user message + direction user message
      expect(result).toHaveLength(6)
      expect(result[0]).toEqual({
        role: 'system',
        content:
          'You are an assistant helping with creative story writing. You can continue the narrative, refine existing content, or answer questions about the story.',
      })
      expect(result[1]).toEqual({
        role: 'assistant',
        content: 'First message',
      })
      expect(result[5]).toEqual({
        role: 'user',
        content:
          'The following is an instruction describing what to write next. It is NOT part of the story - write the content it describes:\n\n"Continue the story"\n\nContinue the story directly below (no labels or formatting):',
      })
    })

    it('uses full message content in the legacy path', async () => {
      const messages: Message[] = []

      for (let i = 1; i <= 20; i++) {
        messages.push(
          createMessage({
            id: `msg-${i}`,
            content: `Message ${i} content`,
          }),
        )
      }

      const options: ContextGenerationOptions = {
        inputText: 'Continue',
        messages,
        contextType: 'story',
        model: 'gpt-4', // Non-Claude model
      }

      const result = await generateContextMessages(options)

      expect(result[1].content).toBe('Message 1 content')
      expect(result[5].content).toBe('Message 5 content')
      expect(result[6].content).toBe('Message 6 content')
      expect(result[12].content).toBe('Message 12 content')
      expect(result[13].content).toBe('Message 13 content')
      expect(result[20].content).toBe('Message 20 content')
    })

    it('uses full content for Claude and adds cache control to recent turns', async () => {
      const messages: Message[] = []

      for (let i = 1; i <= 20; i++) {
        messages.push(
          createMessage({
            id: `msg-${i}`,
            content: `Message ${i} content`,
          }),
        )
      }

      const options: ContextGenerationOptions = {
        inputText: 'Continue',
        messages,
        contextType: 'story',
        model: 'claude-3-opus', // Claude model
      }

      const result = await generateContextMessages(options)

      expect(result[1].content).toBe('Message 1 content')
      expect(result[5].content).toBe('Message 5 content')
      expect(result[6].content).toBe('Message 6 content')
      expect(result[12].content).toBe('Message 12 content')
      expect(result[13].content).toBe('Message 13 content')
      expect(result[20].content).toBe('Message 20 content')

      // Cache control is applied to the last few turns for Claude models.
      expect(result[20].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
    })

    it('should handle compacted messages', async () => {
      const messages: Message[] = [
        createMessage({
          id: 'msg-1',
          content: 'Compacted content',
          isCompacted: true,
        }),
        createMessage({
          id: 'msg-2',
          content: 'Regular content',
        }),
      ]

      const options: ContextGenerationOptions = {
        inputText: 'Continue',
        messages,
        contextType: 'story',
        model: 'gpt-4',
      }

      const result = await generateContextMessages(options)

      // Compacted messages should always use full content
      expect(result[1].content).toBe('Compacted content')
      expect(result[2].content).toBe('Regular content') // Last message, uses full
    })

    it('should add character context when provided', async () => {
      const options: ContextGenerationOptions = {
        inputText: 'Continue',
        messages: [createMessage({})],
        contextType: 'story',
        characterContext: 'Main character: Alice, a brave knight',
      }

      const result = await generateContextMessages(options)

      const contextMessage = result.find((msg) => msg.role === 'user' && msg.content.includes('<story-context>'))
      expect(contextMessage).toBeDefined()
      expect(contextMessage?.content).toBe('<story-context>\nMain character: Alice, a brave knight\n</story-context>')
    })
  })

  // Note: Chapter-based context generation has been removed.
  // Context is now built using nodes (scenes) which are tested separately.

  describe('Query Context', () => {
    it('should generate query context with same system prompt as story (for cache efficiency)', async () => {
      const messages: Message[] = [
        createMessage({ content: 'Story content' }),
        createMessage({ content: 'More story', isQuery: true, instruction: 'What happened?' }),
      ]

      const options: ContextGenerationOptions = {
        inputText: 'Who is the main character?',
        messages,
        contextType: 'query',
      }

      const result = await generateContextMessages(options)

      // System message is now the same for both story and query contexts (cache efficiency)
      expect(result[0]).toEqual({
        role: 'system',
        content:
          'You are an assistant helping with creative story writing. You can continue the narrative, refine existing content, or answer questions about the story.',
      })

      // Should only include story messages, not query messages
      expect(result[1].content).toBe('Story content')
      expect(result.find((m) => m.content === 'More story')).toBeUndefined()
    })

    it('should include query history when requested', async () => {
      const messages: Message[] = [
        createMessage({ content: 'Story content' }),
        createMessage({
          content: 'Alice is the protagonist',
          isQuery: true,
          instruction: 'Who is the main character?',
        }),
        createMessage({
          content: 'She is a knight',
          isQuery: true,
          instruction: 'What is her profession?',
        }),
      ]

      const options: ContextGenerationOptions = {
        inputText: 'Tell me more about Alice',
        messages,
        contextType: 'query',
        includeQueryHistory: true,
        maxQueryHistory: 5,
      }

      const result = await generateContextMessages(options)

      // Should include previous Q&A pairs
      expect(result).toContainEqual({
        role: 'user',
        content: 'Question: Who is the main character?',
      })
      expect(result).toContainEqual({
        role: 'assistant',
        content: 'Alice is the protagonist',
      })
      expect(result).toContainEqual({
        role: 'user',
        content: 'Question: What is her profession?',
      })
      expect(result).toContainEqual({
        role: 'assistant',
        content: 'She is a knight',
      })
    })

    it('should respect maxQueryHistory limit', async () => {
      const messages: Message[] = [createMessage({ content: 'Story' })]

      // Add 10 query messages
      for (let i = 1; i <= 10; i++) {
        messages.push(
          createMessage({
            content: `Answer ${i}`,
            isQuery: true,
            instruction: `Question ${i}`,
          }),
        )
      }

      const options: ContextGenerationOptions = {
        inputText: 'New question',
        messages,
        contextType: 'query',
        includeQueryHistory: true,
        maxQueryHistory: 3,
      }

      const result = await generateContextMessages(options)

      // Should only include last 3 queries (8, 9, 10)
      expect(result.filter((m) => m.content.includes('Question 8'))).toHaveLength(1)
      expect(result.filter((m) => m.content.includes('Question 9'))).toHaveLength(1)
      expect(result.filter((m) => m.content.includes('Question 10'))).toHaveLength(1)
      expect(result.find((m) => m.content.includes('Question 7'))).toBeUndefined()
    })

    it('should only include queries that come after the last story message', async () => {
      const messages: Message[] = [
        createMessage({ id: 'story-1', content: 'Early story content' }),
        createMessage({ id: 'query-1', content: 'Early answer', isQuery: true, instruction: 'Early question' }),
        createMessage({ id: 'story-2', content: 'Later story content' }), // Last story message
        createMessage({ id: 'query-2', content: 'Recent answer', isQuery: true, instruction: 'Recent question' }),
      ]

      const options: ContextGenerationOptions = {
        inputText: 'New question',
        messages,
        contextType: 'query',
        includeQueryHistory: true,
        maxQueryHistory: 5,
      }

      const result = await generateContextMessages(options)

      // Should NOT include query-1 (comes before story-2)
      expect(result.find((m) => m.content.includes('Early question'))).toBeUndefined()
      expect(result.find((m) => m.content === 'Early answer')).toBeUndefined()

      // Should include query-2 (comes after story-2)
      expect(result.filter((m) => m.content.includes('Recent question'))).toHaveLength(1)
      expect(result.filter((m) => m.content === 'Recent answer')).toHaveLength(1)
    })
  })

  describe('Smart Context', () => {
    it('should use buildSmartContext when contextType is smart-story', async () => {
      const { buildSmartContext } = await import('./smartContext')
      const mockMessages = [
        createMessage({ id: 'smart-1', content: 'Smart content 1' }),
        createMessage({ id: 'smart-2', content: 'Smart content 2' }),
      ]

      vi.mocked(buildSmartContext).mockResolvedValueOnce(mockMessages)

      const messages: Message[] = [createMessage({ content: 'Original 1' }), createMessage({ content: 'Original 2' })]

      const options: ContextGenerationOptions = {
        inputText: 'Continue',
        messages,
        contextType: 'smart-story',
        characters: [],
        contextItems: [],
      }

      const result = await generateContextMessages(options)

      expect(buildSmartContext).toHaveBeenCalledWith(
        'Continue',
        messages,
        [],
        [],
        expect.any(Function),
        undefined,
        undefined,
      )

      // Should use messages from smart context
      expect(result[1].content).toBe('Smart content 1')
      expect(result[2].content).toBe('Smart content 2')
    })

    it('should fall back to regular context if smart context fails', async () => {
      const { buildSmartContext } = await import('./smartContext')
      vi.mocked(buildSmartContext).mockRejectedValueOnce(new Error('Smart context failed'))

      const messages: Message[] = [createMessage({ content: 'Regular content' })]

      const options: ContextGenerationOptions = {
        inputText: 'Continue',
        messages,
        contextType: 'smart-story',
      }

      const result = await generateContextMessages(options)

      // Should fall back to regular messages
      expect(result[1].content).toBe('Regular content')
    })
  })

  describe('Cache Control', () => {
    it('should add cache control for Claude models on recent messages', async () => {
      const messages: Message[] = []
      for (let i = 1; i <= 5; i++) {
        messages.push(
          createMessage({
            id: `msg-${i}`,
            content: `Message ${i}`,
          }),
        )
      }

      const options: ContextGenerationOptions = {
        inputText: 'Continue',
        messages,
        contextType: 'story',
        model: 'claude-3-opus',
      }

      const result = await generateContextMessages(options)

      // Last 3 messages should have cache control
      expect(result[3].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
      expect(result[4].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
      expect(result[5].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })

      // Earlier messages should not
      expect(result[1].cache_control).toBeUndefined()
      expect(result[2].cache_control).toBeUndefined()
    })

    it('includes a story-context block and caches the recent story turn for Claude models', async () => {
      const options: ContextGenerationOptions = {
        inputText: 'Continue',
        messages: [createMessage({})],
        contextType: 'story',
        characterContext: 'Character info',
        model: 'claude-3-opus',
      }

      const result = await generateContextMessages(options)

      const contextMessage = result.find((m) => m.role === 'user' && m.content.includes('<story-context>'))
      expect(contextMessage).toBeDefined()

      // Cache control now sits on the recent assistant story turn(s).
      const cachedAssistant = result.find((m) => m.role === 'assistant' && m.cache_control)
      expect(cachedAssistant?.cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty messages array', async () => {
      const options: ContextGenerationOptions = {
        inputText: 'Start the story',
        messages: [],
        contextType: 'story',
      }

      const result = await generateContextMessages(options)

      // system + instructions user message + direction user message
      expect(result).toHaveLength(3)
      expect(result[2].content).toContain('Begin the story')
    })

    it('should filter out chapter markers from story messages', async () => {
      const messages: Message[] = [
        createMessage({ type: 'chapter', content: 'Chapter marker' }),
        createMessage({ content: 'Actual story content' }),
      ]

      const options: ContextGenerationOptions = {
        inputText: 'Continue',
        messages,
        contextType: 'story',
      }

      const result = await generateContextMessages(options)

      // Should not include chapter markers
      expect(result.find((m) => m.content === 'Chapter marker')).toBeUndefined()
      expect(result[1].content).toBe('Actual story content')
    })

    it('should skip empty content messages', async () => {
      const messages: Message[] = [
        createMessage({ content: 'Valid content' }),
        createMessage({ content: '' }),
        createMessage({ content: '   ' }),
        createMessage({ content: 'More valid content' }),
      ]

      const options: ContextGenerationOptions = {
        inputText: 'Continue',
        messages,
        contextType: 'story',
      }

      const result = await generateContextMessages(options)

      // Should only include messages with content
      // system + 2 valid messages + instructions user message + direction user message
      expect(result).toHaveLength(5)
      expect(result[1].content).toBe('Valid content')
      expect(result[2].content).toBe('More valid content')
    })
  })

  // Node-based context generation: this is the path exercised when the story is
  // organized into scenes and the user marks scenes for inclusion via the story
  // navigation (includeInFull). None of the tests above pass `nodes`, so they
  // all hit the legacy fallback; these cover the real path.
  describe('Node-based context (scenes marked includeInFull)', () => {
    const now = new Date('2024-01-01')

    const createScene = (n: number, includeInFull: number | undefined = 2): Node => ({
      id: `scene-${n}`,
      storyId: 'story-1',
      parentId: `chapter-${n}`,
      type: 'scene',
      title: `Scene ${n}`,
      order: 0,
      includeInFull,
      createdAt: now,
      updatedAt: now,
    })

    const createChapter = (n: number): Node => ({
      id: `chapter-${n}`,
      storyId: 'story-1',
      parentId: 'book-1',
      type: 'chapter',
      title: `Chapter ${n}`,
      order: n - 1,
      createdAt: now,
      updatedAt: now,
    })

    // Build a story shaped like Bart's: one book, N chapters, each with exactly
    // one scene, and one message per scene. No branches.
    const buildStory = (sceneCount: number, includeInFull: number | undefined = 2) => {
      const nodes: Node[] = [
        {
          id: 'book-1',
          storyId: 'story-1',
          type: 'book',
          title: 'Book',
          order: 0,
          createdAt: now,
          updatedAt: now,
        },
      ]
      const messages: Message[] = []
      for (let n = 1; n <= sceneCount; n++) {
        nodes.push(createChapter(n))
        nodes.push(createScene(n, includeInFull))
        messages.push(
          createMessage({
            id: `msg-${n}`,
            content: `Scene ${n} content`,
            sceneId: `scene-${n}`,
            order: n,
          }),
        )
      }
      return { nodes, messages }
    }

    const assistantContents = (result: Awaited<ReturnType<typeof generateContextMessages>>) =>
      result.filter((m) => m.role === 'assistant').map((m) => m.content)

    it('includes every prior scene marked includeInFull=2 when sitting on the 10th scene (the optimal case)', async () => {
      const { nodes, messages } = buildStory(10, 2)

      const result = await generateContextMessages({
        inputText: 'Continue',
        messages,
        contextType: 'story',
        nodes,
        targetMessageId: 'msg-10', // current = scene 10
        model: 'claude-3-opus',
        forceMissingSummaries: true,
      })

      const contents = assistantContents(result)
      // Scenes 1-9 are marked-history; scene 10 is the current node.
      for (let n = 1; n <= 10; n++) {
        expect(contents.some((c) => c?.includes(`Scene ${n} content`))).toBe(true)
      }
    })

    it('includes prior scenes via summary when marked includeInFull=1', async () => {
      const { nodes, messages } = buildStory(3, 1)
      // Give the prior scenes summaries (summary mode needs them).
      for (const node of nodes) {
        if (node.type === 'scene') node.summary = `${node.title} summary`
      }

      const result = await generateContextMessages({
        inputText: 'Continue',
        messages,
        contextType: 'story',
        nodes,
        targetMessageId: 'msg-3',
        model: 'claude-3-opus',
        forceMissingSummaries: true,
      })

      const contents = assistantContents(result)
      // Scenes 1-2 contribute summaries; scene 3 (current) contributes full content.
      expect(contents.some((c) => c?.includes('Scene 1 summary'))).toBe(true)
      expect(contents.some((c) => c?.includes('Scene 2 summary'))).toBe(true)
      expect(contents.some((c) => c?.includes('Scene 3 content'))).toBe(true)
    })

    it('documents the failure mode: prior scenes omitted from the passed-in messages array are silently dropped', async () => {
      // This reproduces the divergence Bart observed: the story-navigation token
      // counter reports the prior scenes' content, but generation/preview omit it.
      //
      // The counter (StoryNavigation -> buildNodeMarkdown -> getNodeMessageContents)
      // reads the FULL messagesStore.messages and counts every includeInFull=2
      // scene. generateContextMessages instead trusts the `messages` array its
      // CALLER passes — which is `messagesStore.messages.slice(0, targetIndex + 1)`.
      // If that array isn't in perfect story order, the slice omits prior scenes'
      // messages, and each such scene hits `nodeMessages.length === 0 -> continue`
      // and vanishes from the context — even though it's marked includeInFull=2.
      const { nodes } = buildStory(10, 2)

      // Simulate a bad slice: only the current scene's message survives; scenes
      // 1-9 (still marked includeInFull=2 on the nodes, still counted by the
      // navigation) are missing from the array handed to the builder.
      const messages: Message[] = [
        createMessage({ id: 'msg-10', content: 'Scene 10 content', sceneId: 'scene-10', order: 10 }),
      ]

      const result = await generateContextMessages({
        inputText: 'Continue',
        messages,
        contextType: 'story',
        nodes,
        targetMessageId: 'msg-10',
        model: 'claude-3-opus',
        forceMissingSummaries: true,
      })

      const contents = assistantContents(result)
      // The current scene still shows...
      expect(contents.some((c) => c?.includes('Scene 10 content'))).toBe(true)
      // ...but every prior scene is gone. This is the reported symptom, captured
      // as current behaviour so a future fix (feed story-ordered messages, or
      // gather marked-scene content independently of the slice) flips it.
      const priorShown = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) =>
        contents.some((c) => c?.includes(`Scene ${n} content`)),
      )
      expect(priorShown).toEqual([])
    })
  })
})
