import { Router } from 'express'
import { Ollama } from 'ollama'
import { prisma } from '../../lib/prisma'

const router = Router()

// POST generate chapter summary
router.post('/chapters/:id/generate-summary', async (req, res) => {
  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id: req.params.id },
      include: {
        story: {
          include: {
            characters: {
              where: {
                isProtagonist: true,
              },
            },
          },
        },
        messages: {
          where: {
            deleted: false,
            type: null, // Exclude chapter markers
          },
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!chapter) {
      res.status(404).json({ error: 'Chapter not found' })
    }

    if (chapter.messages.length === 0) {
      return res.status(400).json({ error: 'Chapter has no messages to summarize' })
    }

    // Combine all message content
    const chapterContent = chapter.messages.map((msg) => msg.content).join('\n\n')

    // Generate summary using Ollama
    const ollama = new Ollama({
      host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    })

    // Get protagonist name if one exists
    const protagonist = chapter.story.characters.length > 0 ? chapter.story.characters[0].name : null

    const summaryPrompt = `IMPORTANT: You are creating a CHAPTER SUMMARY, not continuing the story. Your task is to summarize ONLY the content that is provided below, NOT to generate new story content.

Story Title: ${chapter.story.name}
Chapter Title: ${chapter.title}${protagonist ? `\nProtagonist: ${protagonist}` : ''}

Your task: Read the complete chapter content below and create a summary of what happens in it.

CRITICAL INSTRUCTION: Do NOT prefix your output with any labels such as:
- "Summary:"
- "Chapter Summary:"
- "Summary of Chapter X:"
- "Here is the summary:"
- Or any similar prefixes

Start your response DIRECTLY with the first sentence of the summary itself.

===== BEGIN CHAPTER CONTENT TO SUMMARIZE =====
${chapterContent}
===== END CHAPTER CONTENT TO SUMMARIZE =====

REMINDER: The chapter content above is COMPLETE. You must now SUMMARIZE what happened in the text above.

Instructions for your summary:
- This is a SUMMARY task, not a continuation task
- Summarize ONLY the events that occurred in the chapter content provided above
- Do NOT generate new story content or continue the narrative
- Do NOT write what happens next or imagine future events
- Create a 2-3 paragraph narrative summary capturing the key events and developments${protagonist ? `\n- Focus on ${protagonist}'s role and experiences as the protagonist` : ''}
- Write in full paragraphs with complete sentences
- Use ${chapter.story.tense} tense

CRITICAL REMINDER: Start DIRECTLY with your summary text. Do NOT use any prefix labels like "Summary:", "Chapter Summary:", etc. Your first words should be the actual beginning of the summary narrative itself.

Remember: You are describing what ALREADY HAPPENED in the chapter above, not writing new story content.`

    try {
      const response = await ollama.generate({
        model: 'llama3.2',
        prompt: summaryPrompt,
        stream: false,
      })

      const summary = response.response.trim()

      // Update chapter with summary
      const updatedChapter = await prisma.chapter.update({
        where: { id: req.params.id },
        data: { summary },
      })

      res.json({ summary: updatedChapter.summary })
    } catch (error) {
      console.error('Failed to generate summary with Ollama:', error)
      return res.status(500).json({ error: 'Failed to generate summary' })
    }
  } catch (error) {
    console.error('Error generating chapter summary:', error)
    return res.status(500).json({ error: 'Failed to generate chapter summary' })
  }
})

export default router
