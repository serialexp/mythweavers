import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { join } from 'node:path'
import cliProgress from 'cli-progress'
import Color from 'color'
import { decode } from 'html-entities'
import OpenAI from 'openai'
import PQueue from 'p-queue'
import pThrottle from 'p-throttle'
import sharp from 'sharp'
import type { User } from './generated/prisma/client/index.js'
import { prisma } from './prisma.js'
import { uploadFile } from './util/file-storage.js'
const queue = new PQueue({ concurrency: 20 })

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
const openAIThrottle = pThrottle({
  limit: 5000,
  interval: 60000,
})

// List of visually distinctive, commonly available font families
const FONT_FAMILIES = [
  'Georgia, serif',
  'Palatino, serif',
  "'Times New Roman', serif",
  "'Bookman Old Style', serif",
  "'Trebuchet MS', sans-serif",
  'Verdana, sans-serif',
  "'Arial Black', sans-serif",
  "'Impact', sans-serif",
  "'Gill Sans', sans-serif",
  "'Lucida Sans', sans-serif",
] as const

// Function to get a random font family
function getRandomFontFamily(): string {
  return FONT_FAMILIES[Math.floor(Math.random() * FONT_FAMILIES.length)]
}

// Function to generate a random color with good contrast
function generateRandomColors(): {
  background: string
  text: string
  contrastOk: boolean
} {
  // Generate a random hue (0-360)
  const hue = Math.floor(Math.random() * 360)
  // Use a moderate saturation and lightness for the background
  const luminance = Math.random() > 0.5 ? 20 : 80
  const background = Color.lch(luminance, 50, hue)

  // Determine if the background is dark
  const isDark = background.isDark()

  // Choose white text for dark backgrounds, black for light backgrounds
  // Add slight variation to make it more interesting
  const textColor = isDark
    ? Color.lch(85 + Math.random() * 10, 20 + Math.random() * 15, hue + Math.random() * 360) // Light text for dark backgrounds
    : Color.lch(10 + Math.random() * 5, 20 + Math.random() * 15, hue - Math.random() * 360) // Dark text for light backgrounds

  return {
    background: background.hex(),
    text: textColor.hex(),
    contrastOk: background.contrast(textColor) > 7,
  }
}

//test random colors (output html file with examples)

// let file = "";

// file += "<html><body>";
// for (let i = 0; i < 100; i++) {
//   const colors = generateRandomColors();
//   file += `<div style="background-color: ${colors.background}; color: ${colors.text};">${colors.background} ${colors.text} ${colors.contrastOk ? "OK" : "NOT OK"}</div>`;
// }
// file += "</body></html>";

// fs.writeFileSync("random-colors.html", file);
// console.log("done");
// process.exit(0);

interface Chapter {
  id: string
  title: string
  url: string
  volumeId: string | null
  slug: string
  date: string
  order: number
  visible: number
  subscriptionTiers: string | null
  doesNotRollOver: boolean
  isUnlocked: boolean
}

interface Volume {
  id: string
  title: string
  cover: string
  order: number
}

interface Story {
  id: string
  category: string
  slug: string
  title: string
  description: string
  wordsPerDay?: number
  url: string
  author: string
  isFanfiction: boolean
  isCompleted: boolean
  tags: string[]
  color?: string
  textColor?: string
  pages: number
  cover?: string
  chapters: Chapter[]
  volumes: Volume[]
}

// create a new progress bar instance and use shades_classic theme
const bar1 = new cliProgress.SingleBar(
  {
    etaBuffer: 1000,
  },
  cliProgress.Presets.shades_classic,
)

const royalroadData: Record<string, string> = JSON.parse(fs.readFileSync('../reader/royalroad.json', 'utf-8'))

const cacheFolder = join('..', 'reader', 'cache', 'royalroad')
// start the progress bar with a total value of 200 and start value of 0
bar1.start(Object.keys(royalroadData).length, 0)

const throttledOpenApi = openAIThrottle(async (fixedSummary: string): Promise<number> => {
  const spellingScore = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: `
Score the spelling and grammar of the following text. Be strict about it, stilted language is one thing, but if the text is not readable, it should be scored lower.

Return a number between 1 and 4, where 1 is terrible and 4 is perfect. 

Return a JSON object that looks EXACTLY like this: {"score": 3}. Don't add any extra properties. Only the score property is allowed.

Examples:
{"score": 1} - the year is 2144 after years of research the teslar corporation one the top game produces in the world launch their newest creation TERRA an MMORPG that has never been seen before 
{"score": 2} - This is a FF based off of some of the concepts from 'Dawn Traveler' but is ultimately my own world. David Lee is a hybrid half goblin/human; he himself is unaware of his goblin heritage.
{"score": 3} - A novel about a young man with limitless power and his adventures on conquering Girls with his might.
{"score": 4} - Drake's last memory before arriving to the new world was sitting in his office in Dundee, slurping his coffee from his favorite mug as he refused the girl's request.

Score the following text:

${fixedSummary}`,
      },
    ],
    response_format: { type: 'json_object' },
  })
  return spellingScore.choices[0].message.content ? JSON.parse(spellingScore.choices[0].message.content).score : 1
})

const insert = async () => {
  const tags = await prisma.tag.findMany()
  const tagMap = new Map<string, string>(tags.map((tag) => [tag.name, tag.id]))

  for (const storyFile of Object.values(royalroadData)) {
    const story: Story = JSON.parse(fs.readFileSync(join(cacheFolder, 'stories', storyFile), 'utf-8'))
    for (const tag of story.tags) {
      if (!tagMap.has(tag)) {
        const newTag = await prisma.tag.create({
          data: { name: tag },
        })
        tagMap.set(tag, newTag.id)
      }
    }
    bar1.increment()
  }

  console.log('Processing stories')
  bar1.start(Object.keys(royalroadData).length, 0)

  const seenExamples = new Set<number>()
  for (const storyFile of Object.values(royalroadData)) {
    const story: Story = JSON.parse(fs.readFileSync(join(cacheFolder, 'stories', storyFile), 'utf-8'))
    if (!story.author) {
      console.error('Story has no author', story.author)
      continue
    }
    queue.add(async () => {
      let createdAuthor: User | null = null
      // try three times, because concurrency may mess this up
      for (let i = 0; i < 3; i++) {
        try {
          createdAuthor = await prisma.user.upsert({
            where: { name: story.author },
            update: {},
            create: {
              email: story.author,
              name: story.author,
              password: 'password',
            },
          })
          if (createdAuthor) {
            break
          }
        } catch (error) {
          if (i === 2) {
            console.error('Error creating author', error)
          }
        }
      }

      if (!createdAuthor) {
        console.error('Failed to create author', story.author)
        return
      }

      const fixedSummary = decode(story.description)
        .replace(/\n+/g, '\n\n')
        .substring(0, 65000)
        .replaceAll('&nbsp;', ' ')

      const existingScore = await prisma.story.findFirst({
        where: {
          royalRoadId: Number.parseInt(story.id),
        },
        select: {
          spellingLevel: true,
        },
      })
      let score = existingScore?.spellingLevel || 0

      // if we already have a score, don't re-score
      if (score === 0 && fixedSummary.length > 50) {
        try {
          console.log('Scoring story', story.title)
          const scoreRes = await throttledOpenApi(fixedSummary)
          score = scoreRes

          if (!seenExamples.has(score)) {
            fs.writeFileSync(
              `spelling-score-${score}-${Math.random()}.json`,
              JSON.stringify(
                {
                  fixedSummary,
                  score,
                },
                null,
                2,
              ),
            )

            seenExamples.add(score)
            if (Math.random() < 0.1) {
              seenExamples.clear()
            }
          }
        } catch (error) {
          console.error('Error scoring story', error)
        }
      }

      // Generate random colors if no cover or colors specified
      const needsRandomColors = !story.cover || story.cover.includes('nocover') || !story.color || !story.textColor
      const colors = needsRandomColors
        ? generateRandomColors()
        : {
            background: story.color || '#000000',
            text: story.textColor || '#FFFFFF',
          }

      // Always generate a random font family for stories without covers
      const fontFamily = needsRandomColors ? getRandomFontFamily() : 'Georgia, serif'

      const storyStatus = story.isCompleted
        ? 'COMPLETED'
        : new Date(story.chapters[story.chapters.length - 1]?.date).getTime() <
            new Date().getTime() - 1000 * 60 * 60 * 24 * 60
          ? 'HIATUS'
          : 'ONGOING'

      const storyData = await prisma.story.upsert({
        where: { royalRoadId: Number.parseInt(story.id) },
        update: {
          wordsPerWeek: story.isCompleted
            ? 0
            : story.wordsPerDay && story.chapters.length > 5
              ? story.wordsPerDay * 7
              : 0,
          coverArtAsset: story.cover?.includes('nocover') ? '' : '/cover.jpg',
          summary: fixedSummary,
          coverColor: colors.background,
          coverTextColor: colors.text,
          firstChapterReleasedAt: story.chapters[0]?.date,
          lastChapterReleasedAt: story.chapters[story.chapters.length - 1]?.date,
          coverFontFamily: fontFamily,
          spellingLevel: score,
          status: storyStatus,
          chapters: story.chapters.length,
          pages: story.pages,
          royalRoadId: Number.parseInt(story.id),
        },
        create: {
          summary: fixedSummary,
          ownerId: createdAuthor.id,
          name: story.title,
          royalRoadId: Number.parseInt(story.id),
          wordsPerWeek: story.isCompleted
            ? 0
            : story.wordsPerDay && story.chapters.length > 5
              ? story.wordsPerDay * 7
              : 0,
          status: storyStatus,
          type: story.isFanfiction ? 'FANFICTION' : 'ORIGINAL',
          published: true,
          chapters: story.chapters.length,
          firstChapterReleasedAt: story.chapters[0]?.date,
          lastChapterReleasedAt: story.chapters[story.chapters.length - 1]?.date,
          pages: story.pages,
          coverArtAsset: story.cover?.includes('nocover') ? '' : '/cover.jpg',
          coverColor: colors.background,
          coverTextColor: colors.text,
          coverFontFamily: fontFamily,
          spellingLevel: score,
        },
        include: { storyTags: true },
      })
      const storyTags: { tagId: string; storyId: string }[] = []
      for (const tag of story.tags) {
        const tagId = tagMap.get(tag)
        if (!tagId) {
          console.error('Tag not found', tag)
          continue
        }
        storyTags.push({
          tagId,
          storyId: storyData.id,
        })
      }

      const existingStoryTags = storyData.storyTags.map((tag) => tag.tagId)
      const newStoryTags = storyTags.filter((tag) => !existingStoryTags.includes(tag.tagId))
      await prisma.storyTag.createMany({
        data: newStoryTags,
      })

      let hasCover = false
      try {
        if (story.cover && !story.cover.includes('nocover')) {
          const coverPath = join(cacheFolder, 'covers', `${story.id}-${story.slug}.jpg`)
          if (fs.existsSync(coverPath)) {
            const coverData = fs.readFileSync(coverPath)
            const sharpData = await sharp(coverData).metadata()
            const coverHash = createHash('sha256').update(coverData).digest('hex')
            const pathHash = createHash('sha256').update('/cover.jpg').digest('hex')
            const storagePath = `upload/${createdAuthor.id}/${storyData.id}/${pathHash}.jpg`

            const existingFile = await prisma.file.findFirst({
              where: {
                ownerId: createdAuthor.id,
                storyId: storyData.id,
                path: storagePath,
              },
            })

            if (!existingFile || existingFile.sha256 !== coverHash) {
              await uploadFile(coverData, storagePath, 'image/jpeg')
            }
            const _result = await prisma.file.upsert({
              where: {
                path: storagePath,
                storyId: storyData.id,
              },
              create: {
                ownerId: createdAuthor.id,
                storyId: storyData.id,
                path: storagePath,
                localPath: '/cover.jpg',
                mimeType: 'image/jpeg',
                width: sharpData.width,
                height: sharpData.height,
                bytes: sharpData.size,
                sha256: coverHash,
              },
              update: {
                mimeType: 'image/jpeg',
                localPath: '/cover.jpg',
                width: sharpData.width,
                height: sharpData.height,
                bytes: sharpData.size,
                sha256: coverHash,
              },
            })
            hasCover = true
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error('Cover image error:', error.message)
        } else {
          console.error('Cover image error: Unknown error')
        }
      }

      // If we failed to process the cover, update the story with random colors and font
      if (!hasCover) {
        const randomColors = generateRandomColors()
        const randomFont = getRandomFontFamily()
        await prisma.story.update({
          where: { id: storyData.id },
          data: {
            coverArtAsset: '',
            coverColor: randomColors.background,
            coverTextColor: randomColors.text,
            coverFontFamily: randomFont,
          },
        })
      }

      bar1.increment()
    })
  }
  queue.onIdle().then(() => {
    bar1.stop()
  })
}

insert()
