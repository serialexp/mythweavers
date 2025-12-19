import { contentSchemaToHtml, contentSchemaToText } from '../../persistence/content-schema-to-html'
import { booksStore } from '../books'
import { chaptersState } from '../chapters'
import { getWordCount, scenesState } from '../scenes'
import { treeState } from '../tree'

export type SortedBookCoverObject = {
  type: 'book_cover'
  title: string
  author: string
  editor: string
  coverArtist: string
  coverImage: string
  separatorImage: string
}

export type SortedChapterHeaderObject = {
  type: 'chapter_header'
  text: string
}

export type SortedBreakObject = {
  type: 'break'
  text: string
}

export type SortedParagraphObject = {
  type: 'paragraph'
  text: string
  plainText: string
  sceneId: string
  posted: boolean
  state: string
  paragraphId: string
  plotpointIds: string[]
  translations?: Array<{
    original: string
    translation: string
    from: string
    to: string
  }>
}

export type SortedSummaryObject = {
  type: 'summary'
  words: number
  aiWords: number
  books: number
  chapters: number
  scenes: number
}

export type SortedBookObject =
  | SortedBookCoverObject
  | SortedChapterHeaderObject
  | SortedBreakObject
  | SortedParagraphObject
  | SortedSummaryObject

const extractTranslations = (text: any) => {
  if (typeof text === 'string') return []

  const translations: Array<{
    original: string
    translation: string
    from: string
    to: string
  }> = []

  const processNode = (node: any) => {
    if (node.marks?.some((mark: any) => mark.type === 'translation')) {
      const translationMark = node.marks.find((mark: any) => mark.type === 'translation')
      translations.push({
        original: node.text,
        translation: translationMark.attrs.title,
        from: translationMark.attrs.from,
        to: translationMark.attrs.to,
      })
    }

    if (node.content) {
      node.content.forEach(processNode)
    }
  }

  processNode(text)
  return translations
}

export const sortedObjects = (
  rootId?: string,
  includeUnpublished = false,
  options?: {
    translationsInline?: boolean
  },
) => {
  const stats = {
    words: 0,
    aiWords: 0,
    books: 0,
    chapters: 0,
    scenes: 0,
  }

  const objects: SortedBookObject[] = []
  let currentlySelected = 0

  // Use the structure from treeState
  for (const bookNode of treeState.structure) {
    if (bookNode.nodeType !== 'story') continue

    if (bookNode.id === rootId || rootId === undefined) {
      currentlySelected++
    }

    if (currentlySelected > 0) {
      stats.books++
    }

    if (currentlySelected > 0) {
      const book = booksStore.books[bookNode.id]
      if (book?.coverImage) {
        objects.push({
          type: 'book_cover',
          title: book.title,
          author: book.author ?? '',
          editor: book.editor ?? '',
          coverArtist: book.coverArtist ?? '',
          coverImage: book.coverImage,
          separatorImage: book.separatorImage ?? '',
        })
      }
    }
    for (const arcNode of bookNode.children ?? []) {
      if (arcNode.nodeType !== 'story') continue

      if (arcNode.id === rootId || rootId === undefined || currentlySelected > 0) {
        currentlySelected++
      }

      for (const chapterNode of arcNode.children ?? []) {
        if (chapterNode.nodeType !== 'story') continue

        const chapter = chaptersState.chapters[chapterNode.id]
        if (
          chapterNode.id !== rootId &&
          !includeUnpublished &&
          (!chapter?.visibleFrom || new Date(chapter.visibleFrom).getTime() > new Date().getTime())
        ) {
          continue
        }
        if (chapterNode.id === rootId || rootId === undefined || currentlySelected > 0) {
          currentlySelected++
        }
        if (currentlySelected > 0) {
          stats.chapters++
          objects.push({
            type: 'chapter_header',
            text: chapterNode.name,
          })
        }
        for (let index = 0; index < (chapterNode.children?.length ?? 0); index++) {
          const scene = chapterNode.children?.[index]
          if (!scene || scene.nodeType !== 'story') continue

          if (scene.id === rootId || rootId === undefined || currentlySelected > 0) {
            currentlySelected++
          }

          if (currentlySelected > 0) {
            stats.scenes++
            const sceneData = scenesState.scenes[scene.id]
            for (const paragraph of sceneData.paragraphs) {
              stats.words += paragraph.state === 'ai' ? 0 : getWordCount(paragraph.text).words
              stats.aiWords += paragraph.state === 'ai' ? getWordCount(paragraph.text).words : 0

              const translations = typeof paragraph.text === 'string' ? [] : extractTranslations(paragraph.text)

              objects.push({
                type: 'paragraph',
                text:
                  typeof paragraph.text === 'string'
                    ? paragraph.text
                    : contentSchemaToHtml(paragraph.text, {
                        translationsInline: options?.translationsInline,
                      }),
                plainText:
                  typeof paragraph.text === 'string'
                    ? paragraph.text
                    : contentSchemaToText(paragraph.text, {
                        translationsInline: options?.translationsInline,
                      }),
                sceneId: scene.id,
                state: paragraph.state,
                posted: sceneData.posted ?? false,
                paragraphId: paragraph.id,
                plotpointIds: paragraph.plot_point_actions?.map((p) => p.plot_point_id) ?? [],
                translations,
              })
            }
            if (index !== (chapterNode.children?.length ?? 0) - 1) {
              objects.push({
                type: 'break',
                text: '',
              })
            }
          }
          if (currentlySelected > 0) {
            currentlySelected--
          }
        }
        if (currentlySelected > 0) {
          currentlySelected--
        }
      }
      if (currentlySelected > 0) {
        currentlySelected--
      }
    }
    if (currentlySelected > 0) {
      currentlySelected--
    }
  }

  objects.unshift({
    type: 'summary',
    ...stats,
  })

  return objects
}
