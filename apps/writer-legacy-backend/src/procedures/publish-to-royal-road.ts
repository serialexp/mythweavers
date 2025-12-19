import { contentSchemaToHtml } from '@writer/shared'
import markdownit from 'markdown-it'
import type MarkdownIt from 'markdown-it'
import { firefox } from 'playwright'
import z from 'zod'
import { PublishingPlatform, PublishingStatus } from '../generated/prisma/client/index.js'
import { prisma } from '../prisma.js'
import { protectedProcedure } from '../trpc.js'

const md: MarkdownIt = markdownit({
  html: true,
  typographer: true,
})

// Define types for the chapter data
interface Scene {
  paragraphs: Array<{
    paragraphRevisions: Array<{
      body: string
      contentSchema: string | null
    }>
  }>
}

interface Chapter {
  id: string
  name: string
  royalRoadId: number | null
  scenes: Scene[]
}

/**
 * Publishes a chapter to Royal Road
 * @param chapterId The ID of the chapter to publish
 * @param username Royal Road username
 * @param password Royal Road password
 * @param userId The ID of the user who owns the chapter
 * @returns Object with success status and optional error message
 */
export async function publishChapterToRoyalRoad(
  chapterId: string,
  username: string,
  password: string,
  userId: number,
  royalRoadId?: number,
  _publishDate?: Date,
) {
  const chapter = (await prisma.chapter.findUnique({
    where: {
      id: chapterId,
      arc: {
        book: {
          story: {
            ownerId: userId,
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      scenes: {
        orderBy: { sortOrder: 'asc' },
        include: {
          paragraphs: {
            orderBy: { sortOrder: 'asc' },
            include: {
              paragraphRevisions: {
                orderBy: { createdAt: 'desc' },
                distinct: ['paragraphId'],
                select: {
                  id: true,
                  body: true,
                  createdAt: true,
                  contentSchema: true,
                },
              },
            },
          },
        },
      },
    },
  })) as unknown as Chapter | null

  if (!chapter) {
    throw new Error('Chapter not found')
  }
  if (!royalRoadId) {
    throw new Error('No royal road id found for chapter')
  }
  const browser = await firefox.launch({ headless: false })

  try {
    const page = await browser.newPage()

    // Navigate to the login page
    await page.goto('https://www.royalroad.com/account/login')
    await page.fill('input[id="email"]', username)
    await page.fill('input[id="password"]', password)
    await page.click('form[class="form-login-details"] button[type="submit"]')
    await page.waitForURL('https://www.royalroad.com/home')

    // Navigate to the chapter edit page
    const response = await page.goto(`https://www.royalroad.com/author-dashboard/chapters/edit/${royalRoadId}`)

    // check response code
    if (response?.status() !== 200) {
      throw new Error('Failed to login to Royal Road')
    }

    await page.waitForSelector('#Title')

    // Fill in the chapter details
    await page.fill('#Title', chapter.name)

    console.log('filled title')

    const content = chapter.scenes
      .map((scene) => {
        const paragraphContent = scene.paragraphs.flatMap((paragraph) =>
          paragraph.paragraphRevisions.map((revision) => {
            const text = revision.body.trim()

            // Handle chapter separators
            if (text.match(/^\*+$/) || text === '* * *' || text === '----- * * * -----') {
              return '<div style="text-align: center; margin: 2em auto;"><img style="margin: 0 auto;" src="https://pub-43e7e0f137a34d1ca1ce3be7325ba046.r2.dev/Group.png" /></div>'
            }

            // If we have content schema, use it to generate HTML
            if (revision.contentSchema) {
              try {
                const contentSchema = JSON.parse(revision.contentSchema)
                return `<p>${md.render(contentSchemaToHtml(contentSchema))}</p>`
              } catch (e) {
                console.error('Failed to parse content schema:', e)
              }
            }

            // Fallback to markdown parsing if no content schema or parsing failed
            const processedText = text
              .replace(/_{2,}/g, '—') // Replace multiple underscores with em dash
              .replace(/--/g, '—') // Convert double dash to em dash

            return `<p>${md.render(processedText).trim()}</p>`
          }),
        )
        return paragraphContent.join('\n')
      })
      .join(
        '\n<div style="text-align: center; margin: 2em auto;"><img style="margin: 0 auto;" src="https://pub-43e7e0f137a34d1ca1ce3be7325ba046.r2.dev/Group.png" /></div>\n',
      )

    // click source code button on chapter content
    await page.locator('(//div[@class="tox tox-tinymce"])[2]//button[@title="Source code"]').click()

    console.log('clicked source code')
    await page.waitForTimeout(1000)

    await page.fill('.tox-dialog-wrap .tox-textarea', content)

    console.log('filled source code')

    // First click the "Ok" button in the source code dialog to apply the content
    await page.click('.tox-dialog__footer button:has-text("Save")')
    console.log('clicked ok on source code dialog')

    // Then click the main save button - using a more specific selector
    await page.click('button.btn-primary:has-text("Save Changes")')
    console.log('clicked save')

    await page.waitForTimeout(1000)
    console.log('save confirmed')

    console.log('Chapter published successfully!')
    await browser.close()

    // Update the publishing status in the database
    await prisma.chapterPublishing.upsert({
      where: {
        chapterId_platform: {
          chapterId: chapter.id,
          platform: PublishingPlatform.ROYAL_ROAD,
        },
      },
      create: {
        chapterId: chapter.id,
        platform: PublishingPlatform.ROYAL_ROAD,
        status: PublishingStatus.PUBLISHED,
        platformId: royalRoadId.toString(),
        publishedAt: new Date(),
        lastAttempt: new Date(),
      },
      update: {
        status: PublishingStatus.PUBLISHED,
        publishedAt: new Date(),
        lastAttempt: new Date(),
        errorMessage: null,
      },
    })

    return { success: true }
  } catch (e) {
    console.error('Failed to publish chapter:', e)

    // Update the publishing status in the database with error
    await prisma.chapterPublishing.upsert({
      where: {
        chapterId_platform: {
          chapterId: chapterId,
          platform: PublishingPlatform.ROYAL_ROAD,
        },
      },
      create: {
        chapterId: chapterId,
        platform: PublishingPlatform.ROYAL_ROAD,
        status: PublishingStatus.FAILED,
        lastAttempt: new Date(),
        errorMessage: e?.toString().substring(0, 250) || 'Unknown error',
      },
      update: {
        status: PublishingStatus.FAILED,
        lastAttempt: new Date(),
        errorMessage: e?.toString().substring(0, 250) || 'Unknown error',
      },
    })

    await browser.close()

    return { success: false, error: e?.toString() }
  }
}

export const publishToRoyalRoad = protectedProcedure
  .input(
    z.object({
      username: z.string(),
      password: z.string(),
      chapterId: z.string(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    return publishChapterToRoyalRoad(input.chapterId, input.username, input.password, ctx.authenticatedUser.id)
  })
