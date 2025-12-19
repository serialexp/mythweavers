import fs from 'node:fs/promises'
import { TRPCError } from '@trpc/server'
import type { Chapter, Node, PersistedStory, SceneParagraph } from '@writer/shared'
import { chromium } from 'playwright'
import short from 'short-uuid'
import turndown from 'turndown'
import z from 'zod'
import { protectedProcedure } from '../trpc.js'
import { isRoyalRoadWarning } from '../util/is-royal-road-warning.js'

type MaybeString = string | null | undefined

export const importRoyalRoad = protectedProcedure
  .input(
    z.object({
      storyId: z.number(),
    }),
  )
  .mutation(async function* ({ input, ctx }): AsyncGenerator<
    | {
        kind: 'storyInfo'
        data: {
          title: MaybeString
          chapters: {
            id: number
            title: MaybeString
          }[]
          volumes: {
            id: number
            title: MaybeString
          }[]
        }
      }
    | { kind: 'chapterImported'; data: number }
    | { kind: 'storyImported'; data: PersistedStory },
    void,
    unknown
  > {
    await fs.mkdir('cache', { recursive: true })
    const possibleCache = async <T>(key: string, lambda: () => Promise<T>): Promise<T> => {
      try {
        await fs.stat(`cache/${key}.json`)
        const res = JSON.parse(await fs.readFile(`cache/${key}.json`, 'utf-8'))
        return res
      } catch (_e) {
        console.log('executing lambda')
        const res = await lambda()
        console.log('lambda result', res)
        await fs.writeFile(`cache/${key}.json`, JSON.stringify(res, null, 2))
        return res
      }
    }
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()

      const chapterInfo = await possibleCache(`fiction-${input.storyId}`, async () => {
        await page.goto(`https://www.royalroad.com/fiction/${input.storyId}`)
        await page.waitForSelector('.fiction-info')

        const chapters = (await page.evaluate('window.chapters')) as {
          id: number
          volumeId: number
          title: string
          slug: string
          date: string
          order: number
          visible: number
          subscriptionTiers: unknown
          doesNotRollOver: boolean
          isUnlocked: boolean
          url: string
        }[]
        const volumes = (await page.evaluate('window.volumes')) as {
          id: number
          title: string
          cover: string
          order: number
        }[]
        const fictionCover = await page.evaluate('window.fictionCover')
        const title = await (await page.$('h1'))?.textContent()

        return {
          title,
          chapters,
          volumes,
          fictionCover,
        }
      })

      yield {
        kind: 'storyInfo',
        data: chapterInfo,
      }

      console.log(chapterInfo.chapters)
      const storyData: PersistedStory = {
        story: {
          id: short.generate().toString(),
          book: {},
          arc: {},
          chapter: {},
          scene: {},
          characters: {},
          plotPoints: {},
          locations: {},
          structure: [],
          name: chapterInfo.title ?? 'Unknown',
          modifiedTime: Date.now(),
          settings: {
            defaultPerspective: 'third',
            mangaChapterPath: '',
            aiInstructions: '',
            royalRoadId: input.storyId.toString(),
          },
        },
        language: {
          languages: {},
        },
      }

      if (chapterInfo.volumes.length === 0) {
        chapterInfo.volumes = [
          {
            id: 0,
            title: 'Volume 1',
            cover: '',
            order: 0,
          },
        ]
      }
      const volumeMapping = new Map<number, Node>()
      for (const books of chapterInfo.volumes) {
        const newId = short.generate().toString()
        storyData.story.book[newId] = {
          id: newId,
          title: books.title,
          summary: '',
        }
        const arcId = short.generate().toString()
        storyData.story.arc[arcId] = {
          id: arcId,
          title: books.title,
          summary: '',
        }
        const arcStructure: Node = {
          id: arcId,
          type: 'arc' as const,
          name: books.title,
          nodeType: 'story' as const,
          isOpen: true,
          children: [],
        }
        volumeMapping.set(books.id, arcStructure)
        storyData.story.structure.push({
          id: newId,
          type: 'book',
          nodeType: 'story' as const,
          name: books.title,
          isOpen: true,
          children: [arcStructure],
        })
      }
      const turndownService = new turndown()
      turndownService.escape = (text: string) => {
        return text
      }
      for (const chapter of chapterInfo.chapters) {
        const chapterContent = await possibleCache(`chapter-${chapter.id}`, async () => {
          // delay a bit
          await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000))
          await page.goto(`https://www.royalroad.com${chapter.url}`)
          await page.waitForSelector('.chapter-content')
          const firstAuthorNote = await page.$('.author-note-portlet:nth-child(3) .author-note')
          let preChapterNote = ''
          if (firstAuthorNote) {
            preChapterNote = await firstAuthorNote.innerHTML()
          }

          const secondAuthorNote = await page.$('.author-note-portlet:nth-child(7) .author-note')
          let postChapterNote = ''
          if (secondAuthorNote) {
            postChapterNote = await secondAuthorNote.innerHTML()
          }

          const contentObject = await page.$('.chapter-content')
          const invisibleParagraph = await page.$('.chapter-content > *:not(:visible)')

          if (!contentObject) {
            throw new Error('No content object found')
          }
          const chapterContent = await contentObject.innerHTML()
          const invisibleParagraphContent = await invisibleParagraph?.innerText()

          return {
            preChapterNote,
            postChapterNote,
            chapterContent,
            invisibleParagraphContent,
          }
        })

        const markdown = turndownService.turndown(chapterContent.chapterContent)
        const chapterId = short.generate().toString()
        storyData.story.chapter[chapterId] = {
          id: chapterId,
          title: chapter.title,
          summary: '',
          royalRoadId: chapter.id,
          visibleFrom: chapter.date ? new Date(chapter.date).toISOString() : undefined,
        } satisfies Chapter
        const sceneId = short.generate().toString()
        let wordCount = 0
        const paragraphs: SceneParagraph[] = markdown
          .split('\n\n')
          .filter((text) => {
            return text !== chapterContent.invisibleParagraphContent && !isRoyalRoadWarning(text)
          })
          .map((text) => {
            wordCount += text.split(' ').length
            return {
              id: short.generate().toString(),
              text: text,
              state: 'draft',
              modifiedAt: new Date().toISOString(),
              comments: [],
              plot_point_actions: [],
            }
          })
        storyData.story.scene[sceneId] = {
          id: sceneId,
          title: chapter.title,
          summary: '',
          paragraphs,
          words: wordCount,
          cursor: 0,
          selectedParagraph: undefined,
          text: '',
          plot_point_actions: [],
        }
        const arcStructure = volumeMapping.get(chapter.volumeId ?? 0)
        if (!arcStructure) {
          throw new Error('No arc structure found')
        }
        if (!arcStructure.children) {
          throw new Error('No children property in arcstructure')
        }
        arcStructure.children.push({
          id: chapterId,
          type: 'chapter',
          name: chapter.title,
          isOpen: true,
          nodeType: 'story' as const,
          children: [
            {
              id: sceneId,
              type: 'scene',
              name: chapter.title,
              isOpen: true,
              nodeType: 'story' as const,
            },
          ],
        })
        yield {
          kind: 'chapterImported',
          data: chapter.id,
        }
      }
      console.log('Done!')

      yield {
        kind: 'storyImported',
        data: storyData,
      }
    } catch (e) {
      console.error(e)
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to import from Royal Road',
        cause: e,
      })
    } finally {
      await browser.close()
    }
  })
