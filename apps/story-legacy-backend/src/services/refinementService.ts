import { Ollama } from 'ollama'
import { PrismaClient } from '../generated/prisma'

interface RefinementStepResult {
  refined: string[]
  criticism?: string
}

interface RefinementStep {
  name: string
  batchSize: number
  process: (paragraphs: string[], context: RefinementContext) => Promise<RefinementStepResult>
}

interface RefinementContext {
  storyName: string
  storySetting: string
  characters: Array<{
    name: string
    description: string
    isProtagonist: boolean
  }>
  contextItems: Array<{
    type: string
    name: string
    description: string
    isGlobal: boolean
  }>
  person: string
  tense: string
  ollama: Ollama
  model: string
}

interface BatchResult {
  batchNumber: number
  totalBatches: number
  original: string[]
  refined: string[]
  criticism?: string // The criticism generated for this batch
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  startTime?: number
  endTime?: number
  duration?: number // in seconds
}

interface RefinementJob {
  storyId: string
  newStoryId?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  error?: string
  batches: BatchResult[]
  shouldStop?: boolean
  averageBatchTime?: number // Average time per batch in seconds
  estimatedTimeRemaining?: number // Estimated seconds remaining
}

// Store active refinement jobs in memory (could be moved to Redis later)
const refinementJobs = new Map<string, RefinementJob>()

export class RefinementService {
  private ollama: Ollama
  private prisma: PrismaClient
  private steps: RefinementStep[] = []
  private parallelBatches = 4 // Process 4 batches at a time

  constructor(prisma: PrismaClient, ollamaHost = 'http://localhost:11434', parallelBatches = 4) {
    this.ollama = new Ollama({ host: ollamaHost })
    this.prisma = prisma
    this.parallelBatches = parallelBatches

    // Register default refinement steps
    this.registerStep({
      name: 'remove-cliches',
      batchSize: 5,
      process: this.removeCliches.bind(this),
    })
  }

  registerStep(step: RefinementStep) {
    this.steps.push(step)
  }

  async refineStory(storyId: string, model = 'llama3.2', person = 'third', tense = 'past'): Promise<void> {
    console.log(
      `[Refinement] Starting refinement for story ${storyId} with model ${model}, person: ${person}, tense: ${tense}`,
    )

    // Set job status
    refinementJobs.set(storyId, {
      storyId,
      status: 'processing',
      progress: 0,
      batches: [],
    })

    try {
      // Fetch the story with all related data
      console.log(`[Refinement] Fetching story ${storyId} from database...`)
      const story = await this.prisma.story.findUnique({
        where: { id: storyId },
        include: {
          messages: {
            where: { deleted: false },
            orderBy: { order: 'asc' },
          },
          characters: true,
          contextItems: true,
        },
      })

      if (!story) {
        throw new Error('Story not found')
      }

      console.log(
        `[Refinement] Found story "${story.name}" with ${story.messages.length} messages, ${story.characters.length} characters, ${story.contextItems.length} active context items`,
      )

      // Extract all paragraphs from messages
      const allParagraphs = this.extractParagraphs(story.messages)
      console.log(`[Refinement] Extracted ${allParagraphs.length} paragraphs from messages`)

      // Create refinement context with full information
      const context: RefinementContext = {
        storyName: story.name,
        storySetting: story.storySetting,
        characters: story.characters,
        contextItems: story.contextItems,
        person,
        tense,
        ollama: this.ollama,
        model,
      }
      console.log(
        `[Refinement] Context: ${story.characters.length} characters, ${story.contextItems.length} context items, ${person} person, ${tense} tense`,
      )

      // Apply each refinement step
      let refinedParagraphs = allParagraphs
      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i]
        console.log(`[Refinement] Starting step ${i + 1}/${this.steps.length}: ${step.name}`)

        refinedParagraphs = await this.applyStep(step, refinedParagraphs, context, storyId)

        // Update progress (this is already handled in applyStep now)
        console.log(`[Refinement] Completed step ${i + 1}/${this.steps.length}: ${step.name}`)
      }

      // Create a new story with refined content
      console.log('[Refinement] Creating refined story...')
      const newStoryId = await this.createRefinedStory(story, refinedParagraphs)

      // Mark as completed with new story ID
      const job = refinementJobs.get(storyId)
      if (job) {
        job.status = 'completed'
        job.progress = 100
        job.newStoryId = newStoryId
      }

      console.log(`[Refinement] ✅ Refinement completed successfully! New story ID: ${newStoryId}`)
    } catch (error) {
      console.error('[Refinement] ❌ Refinement failed:', error)
      const job = refinementJobs.get(storyId)
      if (job) {
        job.status = 'failed'
        job.error = error instanceof Error ? error.message : 'Unknown error'
      }
      throw error
    }
  }

  private extractParagraphs(messages: any[]): string[] {
    const paragraphs: string[] = []

    for (const message of messages) {
      // Split by double newlines or single newlines followed by indentation
      const messageParagraphs = message.content
        .split(/\n\n+/)
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0)

      paragraphs.push(...messageParagraphs)
    }

    return paragraphs
  }

  private async applyStep(
    step: RefinementStep,
    paragraphs: string[],
    context: RefinementContext,
    storyId?: string,
  ): Promise<string[]> {
    const totalBatches = Math.ceil(paragraphs.length / step.batchSize)
    console.log(
      `[Refinement] Processing ${totalBatches} batches of ${step.batchSize} paragraphs each with ${this.parallelBatches} parallel workers`,
    )

    // Initialize batches in job
    if (storyId) {
      const job = refinementJobs.get(storyId)
      if (job) {
        job.batches = []
        for (let i = 0; i < totalBatches; i++) {
          job.batches.push({
            batchNumber: i + 1,
            totalBatches,
            original: [],
            refined: [],
            status: 'pending',
          })
        }
      }
    }

    // Process batches in parallel
    const results: (string[] | undefined)[] = new Array(totalBatches)
    let currentBatchIndex = 0

    // Process batches with parallel workers
    const processBatch = async (workerIndex: number): Promise<void> => {
      while (currentBatchIndex < totalBatches) {
        // Check if we should stop
        if (storyId) {
          const job = refinementJobs.get(storyId)
          if (job?.shouldStop) {
            console.log(`[Refinement] Worker ${workerIndex}: Stopping as requested`)
            job.status = 'failed'
            job.error = 'Refinement stopped by user'
            throw new Error('Refinement stopped by user')
          }
        }

        // Claim a batch to process
        const batchIndex = currentBatchIndex++
        if (batchIndex >= totalBatches) break

        const startIndex = batchIndex * step.batchSize
        const batch = paragraphs.slice(startIndex, startIndex + step.batchSize)
        const batchNumber = batchIndex + 1

        console.log(
          `[Refinement] Worker ${workerIndex}: Processing batch ${batchNumber}/${totalBatches} (${batch.length} paragraphs)`,
        )

        // Update batch status to processing
        const batchStartTime = Date.now()
        if (storyId) {
          const job = refinementJobs.get(storyId)
          if (job?.batches[batchIndex]) {
            job.batches[batchIndex].status = 'processing'
            job.batches[batchIndex].original = batch
            job.batches[batchIndex].startTime = batchStartTime
          }
        }

        try {
          const result = await step.process(batch, context)
          const batchEndTime = Date.now()
          const duration = (batchEndTime - batchStartTime) / 1000
          console.log(
            `[Refinement] Worker ${workerIndex}: Batch ${batchNumber}/${totalBatches} completed in ${duration.toFixed(1)}s`,
          )

          // Store results in the correct order
          results[batchIndex] = result.refined

          // Update batch status to completed and calculate timing
          if (storyId) {
            const job = refinementJobs.get(storyId)
            if (job?.batches[batchIndex]) {
              job.batches[batchIndex].status = 'completed'
              job.batches[batchIndex].refined = result.refined
              job.batches[batchIndex].criticism = result.criticism
              job.batches[batchIndex].endTime = batchEndTime
              job.batches[batchIndex].duration = duration

              // Calculate average batch time and estimated time remaining
              const completedBatches = job.batches.filter((b) => b.status === 'completed')
              if (completedBatches.length > 0) {
                const totalTime = completedBatches.reduce((sum, b) => sum + (b.duration || 0), 0)
                job.averageBatchTime = totalTime / completedBatches.length

                const remainingBatches = job.batches.filter(
                  (b) => b.status === 'pending' || b.status === 'processing',
                ).length
                // Adjust for parallel processing
                job.estimatedTimeRemaining = (remainingBatches * job.averageBatchTime) / this.parallelBatches

                console.log(
                  `[Refinement] Progress: ${completedBatches.length}/${totalBatches} batches, Avg time: ${job.averageBatchTime.toFixed(1)}s, Est remaining: ${job.estimatedTimeRemaining.toFixed(0)}s`,
                )
              }

              // Update overall progress
              const completedCount = job.batches.filter((b) => b.status === 'completed').length
              job.progress = Math.round((completedCount / totalBatches) * 100)
            }
          }
        } catch (error) {
          console.error(`[Refinement] Worker ${workerIndex}: Batch ${batchNumber} failed:`, error)

          // Update batch status to failed
          if (storyId) {
            const job = refinementJobs.get(storyId)
            if (job?.batches[batchIndex]) {
              job.batches[batchIndex].status = 'failed'
              job.batches[batchIndex].error = error instanceof Error ? error.message : 'Unknown error'
            }
          }

          // Store original batch on failure
          results[batchIndex] = batch
        }
      }
    }

    // Start parallel workers
    const workers: Promise<void>[] = []
    const workerCount = Math.min(this.parallelBatches, totalBatches)
    console.log(`[Refinement] Starting ${workerCount} parallel workers`)

    for (let i = 0; i < workerCount; i++) {
      workers.push(processBatch(i))
    }

    // Wait for all workers to complete
    await Promise.all(workers)

    // Flatten results in the correct order
    const refined: string[] = []
    for (const batchResult of results) {
      if (batchResult) {
        refined.push(...batchResult)
      }
    }

    return refined
  }

  private async removeCliches(paragraphs: string[], context: RefinementContext): Promise<RefinementStepResult> {
    console.log(`[RemoveCliches] Processing ${paragraphs.length} paragraphs`)
    const sampleText = `${paragraphs[0]?.substring(0, 100)}...`
    console.log(`[RemoveCliches] First paragraph preview: "${sampleText}"`)

    // Format character information
    const characterInfo = context.characters
      .map((char) => `- ${char.name}${char.isProtagonist ? ' (Protagonist)' : ''}: ${char.description}`)
      .join('\n')

    // Format context items
    const contextInfo =
      context.contextItems.length > 0
        ? `\n\nStory Context:\n${context.contextItems.map((item) => `- ${item.type}: ${item.name} - ${item.description}`).join('\n')}`
        : ''

    // First, get criticism
    const criticismPrompt = `You are a literary critic reviewing a section of a story called "${context.storyName}" set in ${context.storySetting}.

This story is written in ${context.person} person, ${context.tense} tense.

Characters:
${characterInfo}${contextInfo}

Review the following section and provide criticism as a structured list.

Section to review:
${paragraphs.join('\n\n')}

Please identify issues in the following categories and format your response as a bulleted list:

**Clichés and Overused Phrases:**
- [List specific examples with quotes]

**Overly Dramatic or "Cheesy" Language:**
- [List specific examples with quotes]

**Platitudes or Generic Statements:**
- [List specific examples with quotes]

**Purple Prose or Flowery Language:**
- [List specific examples with quotes]

**Logical Inconsistencies:**
- [List any contradictions, impossible actions, or breaks in causality]

**Narrative Voice Issues (${context.person} person, ${context.tense} tense):**
- [List any deviations in the NARRATIVE portions only, not dialogue]

If a category has no issues, write "- None found"

Be specific and quote the problematic phrases directly.`

    console.log(`[RemoveCliches] Sending criticism request to ${context.model}...`)
    const criticismStartTime = Date.now()

    const criticismResponse = await context.ollama.generate({
      model: context.model,
      prompt: criticismPrompt,
      stream: false,
    })

    const criticism = criticismResponse.response
    const criticismDuration = (Date.now() - criticismStartTime) / 1000
    console.log(`[RemoveCliches] Received criticism in ${criticismDuration.toFixed(1)}s`)
    console.log(`[RemoveCliches] Criticism preview: "${criticism.substring(0, 150)}..."`)

    // Then, rewrite based on criticism
    const rewritePrompt = `You are a skilled editor improving a story called "${context.storyName}" set in ${context.storySetting}.

This story MUST be written in ${context.person} person, ${context.tense} tense.

Characters:
${characterInfo}${contextInfo}

Original section:
${paragraphs.join('\n\n')}

Criticism to address:
${criticism}

Please rewrite this section addressing the criticism while:
1. Maintaining the same events and story progression
2. Keeping the NARRATIVE in ${context.person} person, ${context.tense} tense
3. Preserving character voice and personality in dialogue (dialogue should sound natural, not forced into narrative tense)
4. Making the language more natural and less clichéd
5. Fixing any logical inconsistencies or contradictions
6. Keeping roughly the same length
7. Respecting the established character descriptions and context items

IMPORTANT: 
- The NARRATIVE portions should be in ${context.person} person, ${context.tense} tense
- DIALOGUE should remain natural and use whatever tense makes sense for the character speaking
- For example, in a ${context.person} person ${context.tense} tense story:
  - Narrative: ${context.person === 'first' && context.tense === 'present' ? '"I walk to the door."' : context.person === 'first' && context.tense === 'past' ? '"I walked to the door."' : context.person === 'third' && context.tense === 'present' ? '"She walks to the door."' : '"She walked to the door."'}
  - Dialogue: "I'm going to the store" or "I went there yesterday" (whatever is natural for the conversation)

Provide ONLY the rewritten paragraphs, separated by blank lines.`

    console.log(`[RemoveCliches] Sending rewrite request to ${context.model}...`)
    const rewriteStartTime = Date.now()

    const rewriteResponse = await context.ollama.generate({
      model: context.model,
      prompt: rewritePrompt,
      stream: false,
    })

    const rewriteDuration = (Date.now() - rewriteStartTime) / 1000
    console.log(`[RemoveCliches] Received rewrite in ${rewriteDuration.toFixed(1)}s`)

    // Split the response back into paragraphs
    const rewrittenParagraphs = rewriteResponse.response
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    console.log(`[RemoveCliches] Original paragraphs: ${paragraphs.length}, Rewritten: ${rewrittenParagraphs.length}`)

    // If we got a different number of paragraphs, just return the original
    // (In a more sophisticated version, we could try to match them up better)
    if (rewrittenParagraphs.length !== paragraphs.length) {
      console.warn('[RemoveCliches] Paragraph count mismatch! Returning original paragraphs.')
      return {
        refined: paragraphs,
        criticism: criticism,
      }
    }

    console.log(`[RemoveCliches] Successfully rewrote ${rewrittenParagraphs.length} paragraphs`)
    return {
      refined: rewrittenParagraphs,
      criticism: criticism,
    }
  }

  private async createRefinedStory(originalStory: any, refinedParagraphs: string[]): Promise<string> {
    console.log(`[CreateStory] Creating refined story from ${refinedParagraphs.length} paragraphs`)

    // Reconstruct messages from refined paragraphs
    let paragraphIndex = 0
    const refinedMessages = []

    for (const message of originalStory.messages) {
      const originalParagraphCount = message.content.split(/\n\n+/).filter((p: string) => p.trim().length > 0).length

      const messageParagraphs: string[] = []
      for (let i = 0; i < originalParagraphCount && paragraphIndex < refinedParagraphs.length; i++) {
        messageParagraphs.push(refinedParagraphs[paragraphIndex])
        paragraphIndex++
      }

      if (messageParagraphs.length > 0) {
        const newContent = messageParagraphs.join('\n\n')
        refinedMessages.push({
          ...message,
          content: newContent,
        })
      }
    }

    console.log(`[CreateStory] Reconstructed ${refinedMessages.length} messages`)

    // Create new story with refined content
    console.log('[CreateStory] Creating new story in database...')
    const newStory = await this.prisma.story.create({
      data: {
        name: `${originalStory.name} (Refined)`,
        savedAt: new Date(),
        input: originalStory.input,
        storySetting: originalStory.storySetting,
        messages: {
          create: refinedMessages.map((msg: any, index: number) => ({
            role: msg.role,
            content: msg.content,
            instruction: msg.instruction || null,
            timestamp: new Date(msg.timestamp),
            tokensPerSecond: msg.tokensPerSecond || null,
            totalTokens: msg.totalTokens || null,
            promptTokens: msg.promptTokens || null,
            isQuery: msg.isQuery || false,
            sentenceSummary: msg.sentenceSummary || null,
            summary: msg.summary || null,
            paragraphSummary: msg.paragraphSummary || null,
            isExpanded: msg.isExpanded || false,
            isSummarizing: false,
            think: msg.think || null,
            showThink: msg.showThink || false,
            sceneAnalysis: msg.sceneAnalysis || null,
            isAnalyzing: false,
            order: index,
          })),
        },
        characters: {
          create: originalStory.characters.map((char: any) => ({
            name: char.name,
            description: char.description,
            isProtagonist: char.isProtagonist,
          })),
        },
        contextItems: {
          create:
            originalStory.contextItems?.map((item: any) => ({
              type: item.type,
              name: item.name,
              description: item.description,
              isGlobal: item.isGlobal || false,
            })) || [],
        },
      },
    })

    console.log(`[CreateStory] Created refined story with ID: ${newStory.id}`)
    return newStory.id
  }

  getJobStatus(storyId: string): RefinementJob | undefined {
    return refinementJobs.get(storyId)
  }

  stopRefinement(storyId: string): boolean {
    const job = refinementJobs.get(storyId)
    if (job && job.status === 'processing') {
      job.shouldStop = true
      console.log(`[Refinement] Stop requested for story ${storyId}`)
      return true
    }
    return false
  }

  // Additional refinement steps can be added here
  addGrammarCheck() {
    this.registerStep({
      name: 'grammar-check',
      batchSize: 10,
      process: async (paragraphs, _context) => {
        // Implementation for grammar checking
        return { refined: paragraphs }
      },
    })
  }

  addConsistencyCheck() {
    this.registerStep({
      name: 'consistency-check',
      batchSize: 20,
      process: async (paragraphs, _context) => {
        // Implementation for checking character/setting consistency
        return { refined: paragraphs }
      },
    })
  }
}
