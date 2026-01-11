import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Message } from '../types/core'
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

      expect(result).toHaveLength(5) // system + 3 messages + user
      expect(result[0]).toEqual({
        role: 'system',
        content: 'System prompt for fantasy story',
      })
      expect(result[1]).toEqual({
        role: 'assistant',
        content: 'First message',
      })
      expect(result[4]).toEqual({
        role: 'user',
        content: 'User direction: Continue the story\n\nContinue the story directly below (no labels or formatting):',
      })
    })

    it('should apply summarization for non-Claude models', async () => {
      const messages: Message[] = []

      // Create 20 messages to test summarization
      for (let i = 1; i <= 20; i++) {
        messages.push(
          createMessage({
            id: `msg-${i}`,
            content: `Message ${i} content`,
            summary: `Message ${i} summary`,
            paragraphSummary: `Message ${i} paragraph summary`,
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

      // With 20 messages total:
      // turnsFromEnd = 20 - position
      // Messages 1-5: turnsFromEnd = 19-15, all > 14, use sentence summaries
      expect(result[1].content).toBe('Message 1 summary')
      expect(result[5].content).toBe('Message 5 summary')

      // Messages 6-12: turnsFromEnd = 14-8, all > 7 but <= 14, use paragraph summaries
      expect(result[6].content).toBe('Message 6 paragraph summary')
      expect(result[12].content).toBe('Message 12 paragraph summary')

      // Messages 13-20: turnsFromEnd = 7-0, all <= 7, use full content
      expect(result[13].content).toBe('Message 13 content')
      expect(result[20].content).toBe('Message 20 content')
    })

    it('should always use full content for Claude models', async () => {
      const messages: Message[] = []

      for (let i = 1; i <= 20; i++) {
        messages.push(
          createMessage({
            id: `msg-${i}`,
            content: `Message ${i} content`,
            summary: `Message ${i} summary`,
            paragraphSummary: `Message ${i} paragraph summary`,
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

      // All messages should use full content for Claude
      for (let i = 1; i <= 20; i++) {
        expect(result[i].content).toBe(`Message ${i} content`)
      }
    })

    it('should handle compacted messages', async () => {
      const messages: Message[] = [
        createMessage({
          id: 'msg-1',
          content: 'Compacted content',
          isCompacted: true,
          summary: 'Should not use this',
        }),
        createMessage({
          id: 'msg-2',
          content: 'Regular content',
          summary: 'Regular summary',
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

      const contextMessage = result.find((msg) => msg.role === 'user' && msg.content.includes('Active story context'))
      expect(contextMessage).toBeDefined()
      expect(contextMessage?.content).toBe('Active story context:\nMain character: Alice, a brave knight')
    })
  })

  // Note: Chapter-based context generation has been removed.
  // Context is now built using nodes (scenes) which are tested separately.

  describe('Query Context', () => {
    it('should generate query context with different system prompt', async () => {
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

      expect(result[0]).toEqual({
        role: 'system',
        content:
          'You are a helpful assistant answering questions about a story in progress. Provide clear, concise answers about the story, its characters, plot, or any other aspect the user is asking about. Do not continue the story itself.',
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

      expect(buildSmartContext).toHaveBeenCalledWith('Continue', messages, [], [], [], expect.any(Function), undefined)

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

    it('should add cache control to character context for Claude models', async () => {
      const options: ContextGenerationOptions = {
        inputText: 'Continue',
        messages: [createMessage({})],
        contextType: 'story',
        characterContext: 'Character info',
        model: 'claude-3-opus',
      }

      const result = await generateContextMessages(options)

      const contextMessage = result.find((m) => m.role === 'user' && m.content.includes('Active story context'))
      expect(contextMessage?.cache_control).toEqual({ type: 'ephemeral', ttl: '1h' })
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

      expect(result).toHaveLength(2) // system + user
      expect(result[1].content).toContain('Begin the story')
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
      expect(result).toHaveLength(4) // system + 2 valid messages + user
      expect(result[1].content).toBe('Valid content')
      expect(result[2].content).toBe('More valid content')
    })
  })
})
