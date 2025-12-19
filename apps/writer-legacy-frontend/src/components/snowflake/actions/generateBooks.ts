import { createSignal } from 'solid-js'
import { createBook } from '../../../lib/stores/books'
import { addNotification } from '../../../lib/stores/notifications'
import { treeState, updateNode } from '../../../lib/stores/tree'
import { useAi } from '../../../lib/use-ai'

export const [showBookGuidelineDialog, setShowBookGuidelineDialog] = createSignal(false)
export const [bookGuideline, setBookGuideline] = createSignal('')
export const [totalBookCount, setTotalBookCount] = createSignal<number>(0)
export const [generatedBookContent, setGeneratedBookContent] = createSignal<string | null>(null)
export const [isGenerating, setIsGenerating] = createSignal(false)

export const generateBooks = async (
  storyOneliner: string,
  bookCount: number,
  startFromIndex?: number,
  guideline?: string,
  previewOnly = false,
) => {
  if (previewOnly && bookCount > 1) {
    throw new Error('Cannot preview multiple books at once')
  }

  setIsGenerating(true)
  try {
    const startIndex = startFromIndex ?? 0
    const endIndex = startFromIndex !== undefined ? startIndex + bookCount : bookCount

    for (let i = startIndex; i < endIndex; i++) {
      const previousBooks = treeState.structure?.map((book) => book.oneliner)

      const prompt = [
        `Overarching story concept: ${storyOneliner}`,
        '',
        `This is book ${i + 1} of ${totalBookCount()}.`,
        '',
        previousBooks?.length
          ? [
              'Previous books in the series:',
              ...previousBooks.map((book, idx) => `Book ${idx + 1}:\n${book}`),
              '',
            ].join('\n')
          : '',
        guideline ? `What should happen in this book:\n${guideline}\n` : '',
        "Generate this book's content with:",
        '1. A one-line summary of the core conflict',
        '2. Four major story movements, each described in one sentence:',
        '   - First quarter: Setup and initial conflict',
        '   - Second quarter: Complications and raising stakes',
        '   - Third quarter: Major setback or revelation',
        '   - Final quarter: Build to climactic resolution',
      ].join('\n')

      const response = await useAi('snowflake_expand_story', prompt)

      if (previewOnly) {
        setGeneratedBookContent(response)
        return
      }

      const lines = response.split('\n').filter((line: string) => line.trim())
      const oneliner = lines[0]
      const arcLines = lines.slice(1).map((line: string) => line.trim())

      if (!oneliner || arcLines.length < 4) {
        throw new Error(
          `Failed to generate complete structure for book ${i + 1}. Expected 4 arc descriptions but got ${arcLines.length}`,
        )
      }

      const synopsis = `${oneliner}\n\n${arcLines.join('\n\n')}`
      const bookId = await createBook()
      updateNode(bookId, {
        oneliner: synopsis,
        summaries: [
          {
            level: 2,
            text: synopsis,
            timestamp: Date.now(),
          },
        ],
      })

      addNotification({
        type: 'success',
        title: `Book ${i + 1} Generated`,
        message: 'Successfully generated book with structured summary',
      })
    }

    if (!previewOnly) {
      setGeneratedBookContent(null)
      setBookGuideline('')
      setShowBookGuidelineDialog(false)
    }
  } catch (error) {
    addNotification({
      type: 'error',
      title: 'Failed to generate book',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  } finally {
    setIsGenerating(false)
  }
}

export const acceptGeneratedBook = async () => {
  const content = generatedBookContent()
  if (!content) return

  try {
    const lines = content.split('\n').filter((line) => line.trim())
    const oneliner = lines[0]
    const arcLines = lines.slice(1).map((line) => line.trim())

    if (!oneliner || arcLines.length < 4) {
      throw new Error('Generated content is incomplete')
    }

    const synopsis = `${oneliner}\n\n${arcLines.join('\n\n')}`
    const bookId = await createBook()
    updateNode(bookId, {
      oneliner: synopsis,
      summaries: [
        {
          level: 2,
          text: synopsis,
          timestamp: Date.now(),
        },
      ],
    })

    addNotification({
      type: 'success',
      title: 'Book Created',
      message: 'Successfully created book with structured summary',
    })

    setShowBookGuidelineDialog(false)
    setBookGuideline('')
    setGeneratedBookContent(null)
  } catch (error) {
    addNotification({
      type: 'error',
      title: 'Failed to create book',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  }
}
