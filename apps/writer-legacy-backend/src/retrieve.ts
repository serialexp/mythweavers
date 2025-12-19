import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { join } from 'node:path'
import { DOMParser } from '@xmldom/xmldom'
import axios from 'axios'
import color from 'color'
import { decode } from 'html-entities'
import OpenAI from 'openai'
import PQueue from 'p-queue'
import pThrottle from 'p-throttle'
import sharp from 'sharp'
import xpath from 'xpath'
import type { StoryStatus, StoryType, User } from './generated/prisma/client/index.js'
import { prisma } from './prisma.js'
import { uploadFile } from './util/file-storage.js'

// --- OpenAI Setup ---
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
const openAIThrottle = pThrottle({
  limit: 5000, // Adjust limits as needed
  interval: 60000,
})

const throttledOpenApi = openAIThrottle(async (fixedSummary: string): Promise<number> => {
  try {
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
{"score": 2} - this is a ff based off of some of the concepts from 'dawn traveler' but is ultimately my own world david lee is a hybrid half goblin/human he himself is unaware of his goblin heritage
{"score": 3} - A novel about a young man with limitless power and his adventures on conquering Girls with his might.
{"score": 4} - Drake's last memory before arriving to the new world was sitting in his office in Dundee, slurping his coffee from his favorite mug as he refused the girl's request.
Score the following text:
${fixedSummary}`,
        },
      ],
      response_format: { type: 'json_object' },
    })
    return spellingScore.choices[0].message.content ? JSON.parse(spellingScore.choices[0].message.content).score : 1
  } catch (error) {
    console.error('Error scoring story:', error)
    return 0 // Return 0 or handle error appropriately
  }
})

// --- Font/Color Fallback Logic ---
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

function getRandomFontFamily(): string {
  return FONT_FAMILIES[Math.floor(Math.random() * FONT_FAMILIES.length)]
}

function generateRandomColors(): { background: string; text: string } {
  const hue = Math.floor(Math.random() * 360)
  const luminance = Math.random() > 0.5 ? 20 : 80
  const background = color({ h: hue, s: 50, l: luminance })
  const textColor = background.isDark()
    ? color({
        h: hue + Math.random() * 360,
        s: 20 + Math.random() * 15,
        l: 85 + Math.random() * 10,
      })
    : color({
        h: hue - Math.random() * 360,
        s: 20 + Math.random() * 15,
        l: 10 + Math.random() * 5,
      })
  return {
    background: background.hex(),
    text: textColor.hex(),
  }
}

// --- RoyalRoad Constants ---
const royalRoadUrl = 'https://www.royalroad.com'
const pages = 4356 // Consider making this dynamic or configurable
const cacheFolder = 'cache/royalroad/'

// --- Cache Folder Setup ---
fs.mkdirSync(cacheFolder, { recursive: true })
fs.mkdirSync(join(cacheFolder, 'covers'), { recursive: true })
// No longer need cache/stories for JSON files
// fs.mkdirSync(join(cacheFolder, "stories"), { recursive: true });

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((x) => {
      const hex = x.toString(16)
      return hex.length === 1 ? `0${hex}` : hex
    })
    .join('')}`

const clearCacheCategory = (category: string) => {
  fs.rmSync(join(cacheFolder, category), { recursive: true, force: true })
}

// --- Sequential Page Fetching ---
const getPage = async (url: string, category: string, extension?: string): Promise<string | Buffer> => {
  const hash = createHash('sha256').update(url).digest('hex')
  const filePath = join(cacheFolder, category, extension ? `${hash}.${extension}` : hash)

  fs.mkdirSync(join(cacheFolder, category), { recursive: true })

  if (fs.existsSync(filePath)) {
    console.log(`Cache hit for ${url}`)
    return fs.readFileSync(filePath, extension === 'jpg' ? undefined : 'utf-8')
  }

  console.log(`Cache miss for ${url}`)
  try {
    const response = await axios.get(url, {
      responseType: extension === 'jpg' ? 'arraybuffer' : 'text', // Explicitly text for HTML
      // Add headers to mimic a browser, potentially reducing blocks
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000, // Add a timeout
    })

    if (response.data) {
      console.log(`Writing ${url} to cache`)
      fs.writeFileSync(filePath, response.data)
      return response.data
    }
    throw new Error('No data received')
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Error fetching ${url}: ${error.message}`)
    } else {
      console.error(`Error fetching ${url}: ${String(error)}`)
    }
    // Optional: Wait before retrying or just fail
    // await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
    throw error // Re-throw to signal failure
  }
}

// --- XPath Helpers ---
const selectNodes = (xpathString: string, node: Node): Node[] => {
  // Ensure the result is always an array of Nodes
  const result = xpath.select(xpathString, node)
  if (Array.isArray(result)) {
    return result.filter((item): item is Node => typeof item === 'object' && item !== null && 'nodeType' in item)
  }
  return [] // Return empty array if not an array
}

const selectString = (xpathString: string, node: Node): string | undefined => {
  const result = xpath.select1(xpathString, node)
  // Handle cases where select1 returns non-Node types or null/undefined
  if (result && typeof result === 'object' && 'nodeValue' in result && result.nodeValue !== null) {
    return result.nodeValue as string
  }
  if (typeof result === 'string') {
    return result // Handle attribute values directly returned as strings
  }
  return undefined
}

// --- Main Retrieve Function ---
const retrieve = async () => {
  if (process.argv.includes('--clear-list')) {
    await clearCacheCategory('list')
  }
  if (process.argv.includes('--clear-covers')) {
    await clearCacheCategory('covers')
  }
  if (process.argv.includes('--clear-fiction')) {
    await clearCacheCategory('fiction')
  }

  // Initialize Parallel Queue (adjust concurrency as needed)
  const queue = new PQueue({ concurrency: 10 }) // e.g., 10 parallel processing tasks
  let processingCounter = 0 // Track active queue tasks

  // Fetch existing stories for update checks (sequential)
  const dbStories = await prisma.story.findMany({
    select: {
      id: true,
      royalRoadId: true,
      lastChapterReleasedAt: true,
      spellingLevel: true, // Fetch existing score
    },
  })
  const dbStoriesMap = new Map<number, { lastUpdate: Date | null; spellingLevel: number | null }>()
  for (const story of dbStories) {
    if (story.royalRoadId) {
      dbStoriesMap.set(story.royalRoadId, {
        lastUpdate: story.lastChapterReleasedAt,
        spellingLevel: story.spellingLevel,
      })
    }
  }

  let updatedCount = 0
  let createdCount = 0
  let skippedCount = 0
  let consecutiveSkippedCount = 0
  const tagMap = new Map<string, string>() // Cache tags locally

  // Pre-fetch all tags
  const allTags = await prisma.tag.findMany()
  for (const tag of allTags) {
    tagMap.set(tag.name, tag.id)
  }

  // Process Pages Sequentially
  label: for (let i = 1; i < pages; i++) {
    console.log(`Fetching list page ${i}`)
    let page: string | Buffer
    try {
      page = await getPage(`${royalRoadUrl}/fictions/search?orderBy=last_update&page=${i}`, 'list')
    } catch (_error) {
      console.error(`Failed to fetch list page ${i}, skipping page.`)
      continue // Skip to next page if fetch fails
    }

    const doc = new DOMParser({ errorHandler: () => {} }).parseFromString(page as string)
    console.log(`Processing list page ${i}`)
    const nodes = selectNodes("//div[@class='row fiction-list-item']", doc)

    if (nodes.length === 0) {
      console.log(`No stories found on page ${i}, potentially end of list or parsing issue.`)
      // Optional: break label; if you assume this means end of content
    }

    // Process Stories on Page Sequentially (for fetching)
    for (const node of nodes) {
      try {
        // --- Sequential Data Extraction from List Page ---
        const title = selectString(".//h2[@class='fiction-title']/a/text()", node)
        const url = selectString(".//h2[@class='fiction-title']/a/@href", node)
        const fictionId = url?.split('/')?.[2]

        if (!fictionId || !url || !title) {
          console.warn('Missing fictionId, url, or title on list page item. Skipping.')
          continue
        }
        const numericFictionId = Number.parseInt(fictionId)
        const websiteLastUpdateNode = selectNodes(
          ".//div[@class='col-sm-6 uppercase bold font-blue-dark']/time",
          node,
        )[0]
        const websiteLastUpdate =
          websiteLastUpdateNode.nodeType === 1 // Check type here
            ? new Date((websiteLastUpdateNode as Element).getAttribute('datetime') || '')
            : websiteLastUpdateNode?.textContent // Use textContent only if it exists
              ? new Date(websiteLastUpdateNode.textContent.trim())
              : new Date(0) // Invalid date if no node or text

        if (Number.isNaN(websiteLastUpdate.getTime()) || websiteLastUpdate.getTime() === 0) {
          console.warn(`Invalid date found for ${title} (ID: ${fictionId}), skipping update check.`)
          // Decide whether to process anyway or skip
          continue
        }

        // --- Update Check (Sequential) ---
        const dbStoryInfo = dbStoriesMap.get(numericFictionId)
        const dbLastUpdate = dbStoryInfo?.lastUpdate

        if (dbLastUpdate && websiteLastUpdate.getTime() <= dbLastUpdate.getTime()) {
          // console.log(`Skipping ${title} (ID: ${fictionId}) - No updates since ${dbLastUpdate.toISOString()}`);
          skippedCount++
          consecutiveSkippedCount++
          if (consecutiveSkippedCount >= 15) {
            // Increase threshold slightly
            console.log('Found 15 consecutive stories with no updates, stopping page processing.')
            break label
          }
          continue // Skip to next story node
        }

        // Reset skip count if a story needs processing
        consecutiveSkippedCount = 0
        console.log(`Update required for ${title} (ID: ${fictionId}). Fetching details...`)

        // --- Fetch Story Page and Cover Sequentially ---
        let bookPage: string | Buffer
        let coverData: Buffer | undefined
        let coverUrl: string | undefined
        let originalCoverUrl: string | undefined // Store the URL fetched

        try {
          bookPage = await getPage(`${royalRoadUrl}${url}`, 'fiction')
          const bookDocForCover = new DOMParser({
            errorHandler: () => {},
          }).parseFromString(bookPage as string) // Parse once for cover URL
          originalCoverUrl = selectString(".//img[@data-type='cover']/@src", bookDocForCover)

          if (originalCoverUrl && !originalCoverUrl.includes('nocover')) {
            coverUrl = originalCoverUrl.startsWith('http') ? originalCoverUrl : `${royalRoadUrl}${originalCoverUrl}`
            try {
              coverData = (await getPage(
                coverUrl.replace('covers-full', 'covers-large'), // Try large first
                'cover',
                'jpg',
              )) as Buffer
            } catch (_e) {
              console.warn(`Failed to get large cover for ${title}, trying original: ${coverUrl}`)
              try {
                coverData = (await getPage(coverUrl, 'cover', 'jpg')) as Buffer
              } catch (e2) {
                console.error(`Failed to get any cover for ${title}: ${coverUrl}. Error: ${e2}`)
                coverUrl = undefined // Ensure coverUrl is undefined if fetch failed
              }
            }
          } else {
            console.log(`No cover or 'nocover' for ${title}`)
            coverUrl = undefined
          }

          // Fetch Volume Covers Sequentially (Can be optimized later if needed)
          // This part is less critical and adds sequential fetches. Consider removing if not essential or making parallel later.
          // const scriptTags = selectNodes("//script", bookDocForCover);
          // let volumesData: { id: number; cover: string; title: string; order: number }[] = [];
          // let fetchedVolumeCovers = new Map<number, Buffer>(); // Store fetched volume covers

          // for (const scriptTag of scriptTags) {
          //   const scriptContent = scriptTag.textContent;
          //   if (scriptContent?.includes("window.volumes = ")) {
          //      const volumeMatch = scriptContent.match(/window.volumes\\s*=\\s*(\\[.*?]);/);
          //       if (volumeMatch && volumeMatch[1]) {
          //           try {
          //                volumesData = JSON.parse(volumeMatch[1]);
          //                if (volumesData.length > 0) {
          //                    for (const volume of volumesData) {
          //                        if (volume.cover && !volume.cover.includes("nocover")) {
          //                           const volumeCoverUrl = volume.cover.startsWith('http') ? volume.cover : \`\${royalRoadUrl}\${volume.cover}\`;
          //                            try {
          //                                const volCoverData = await getPage(volumeCoverUrl, "cover", "jpg") as Buffer;
          //                                fetchedVolumeCovers.set(volume.id, volCoverData);
          //                                // Optional: Save volume cover to cache (might clutter cache)
          //                                // fs.writeFileSync(join(cacheFolder, "covers", \`\${fictionSlug}-volume-\${volume.id}.jpg\`), volCoverData);
          //                            } catch (e) {
          //                                console.warn(\`Failed to fetch cover for volume \${volume.title} (ID: \${volume.id}) for story \${title}\`);
          //                            }
          //                        }
          //                    }
          //                }
          //           } catch (jsonError) {
          //                console.error(\`Failed to parse volumes JSON for \${title}: \${jsonError}\`);
          //           }
          //       }
          //       break; // Assume only one script tag has volumes
          //   }
          // }

          // --- Queue Parallel Processing Task ---
          processingCounter++
          queue.add(async () => {
            try {
              // Re-parse here inside the task to avoid passing large mutable objects
              const bookDoc = new DOMParser({
                errorHandler: () => {},
              }).parseFromString(bookPage as string)

              // Extract remaining data inside the task
              const author = selectString(".//h4[contains(@class,'font-white')]/span/a/text()", bookDoc)
              const descriptionParagraphs = selectNodes(".//div[@class='description']//p", bookDoc)
              const rawDescription = descriptionParagraphs
                .filter((p) => p.textContent?.trim() && p.textContent?.trim() !== '&nbsp;')
                .map((p) => p.toString()) // Keep HTML for potential rendering
                .join('\n') // Join with newline, not space

              const decodedDescription = decode(rawDescription) // Decode for OpenAI/DB
              // Basic plain text for scoring, limit length early
              const plainTextDescription = decodedDescription
                .replace(/<[^>]*>?/gm, '\n')
                .replace(/\n+/g, '\n')
                .trim()
                .substring(0, 10000)

              const defaultLabels = selectNodes("//span[contains(@class, 'label-default')]/text()", bookDoc)
              const isFanfiction = defaultLabels.some((label) => label.textContent?.includes('Fan Fiction'))
              const isCompleted = defaultLabels.some((label) => label.textContent?.includes('COMPLETED'))

              const tagsNodes = selectNodes(".//a[contains(@class, 'fiction-tag')]", bookDoc)
              const tags = tagsNodes.map((tagNode) => tagNode.textContent?.trim() ?? '').filter(Boolean) // Ensure tags are strings

              const pagesNode = selectNodes(".//div[@class='col-sm-6 uppercase bold font-blue-dark']", node)[2] // From list node
              const pages = Number.parseInt(
                pagesNode?.textContent?.trim().replace(' Pages', '').replaceAll(',', '') ?? '0',
              )

              // Chapters and Volumes from script tag (can be parsed again or passed)
              let chapters: { id: number; title: string; date: string }[] = []
              // let volumes: { id: number; cover: string; title: string; order: number }[] = []; // Already have volumesData
              const scriptTags = selectNodes('//script', bookDoc)
              for (const scriptTag of scriptTags) {
                const scriptContent = scriptTag.textContent
                if (scriptContent?.includes('window.chapters = ')) {
                  const chapterMatch = scriptContent.match(/window.chapters\\s*=\\s*(\\[.*?]);/)
                  if (chapterMatch?.[1]) {
                    try {
                      chapters = JSON.parse(chapterMatch[1])
                    } catch (jsonError) {
                      console.error(`Failed to parse chapters JSON for ${title}: ${jsonError}`)
                    }
                  }
                  break // Found chapters
                }
              }

              const firstChapter = chapters[0]
              const lastChapter = chapters[chapters.length - 1]
              let lastChapterDate: Date | null = null
              try {
                if (lastChapter?.date) {
                  lastChapterDate = new Date(lastChapter.date)
                  if (Number.isNaN(lastChapterDate.getTime())) lastChapterDate = null // Invalidate if parsing failed
                }
              } catch (_e) {
                lastChapterDate = null
              }

              let firstChapterDate: Date | null = null
              try {
                if (firstChapter?.date) {
                  firstChapterDate = new Date(firstChapter.date)
                  if (Number.isNaN(firstChapterDate.getTime())) firstChapterDate = null
                }
              } catch (_e) {
                firstChapterDate = null
              }

              // --- Calculations (Inside Task) ---
              const words = pages * 275 // Approximation
              let wordsPerDay = 0
              if (firstChapterDate && lastChapterDate && lastChapterDate > firstChapterDate) {
                const daysBetween = Math.max(
                  (lastChapterDate.getTime() - firstChapterDate.getTime()) / (1000 * 60 * 60 * 24),
                  7,
                )
                wordsPerDay = words / daysBetween
              } else if (words > 0) {
                wordsPerDay = words / 7 // Assume 1 week if single chapter or bad dates
              }
              const wordsPerWeek = isCompleted ? 0 : Math.round(wordsPerDay * 7)

              const storyStatus = isCompleted
                ? 'COMPLETED'
                : lastChapterDate && lastChapterDate.getTime() < Date.now() - 60 * 24 * 60 * 60 * 1000 // Older than 60 days?
                  ? 'HIATUS'
                  : 'ONGOING'

              // --- Spelling Score (Inside Task) ---
              let spellingLevel = dbStoryInfo?.spellingLevel ?? 0 // Use existing score if available
              if (spellingLevel === 0 && plainTextDescription.length > 50) {
                // Only score if not already scored and has enough text
                console.log(`Scoring spelling for ${title}...`)
                spellingLevel = await throttledOpenApi(plainTextDescription.substring(0, 4000)) // Limit input size for OpenAI
              }

              // --- Color Processing (Inside Task) ---
              let coverColor: string | undefined
              let coverTextColor: string | undefined
              let coverFontFamily: string | undefined
              let finalCoverArtAsset: string | undefined // Path for DB

              if (coverData && coverUrl) {
                // Check coverUrl too
                try {
                  const stats = await sharp(coverData).stats()
                  const { r, g, b } = stats.dominant
                  coverColor = rgbToHex(r, g, b)
                  coverTextColor = color({ r, g, b }).isDark() ? '#FFFFFF' : '#000000'
                  coverFontFamily = 'Georgia, serif' // Default for real covers
                  // Use a consistent local path reference in DB
                  finalCoverArtAsset = '/cover.jpg'
                } catch (sharpError) {
                  console.error(`Error processing cover with sharp for ${title}: ${sharpError}`)
                  coverData = undefined // Nullify coverData if processing failed
                  coverUrl = undefined
                }
              }

              // Apply fallbacks if no cover data or processing failed
              if (!coverData || !coverUrl || !finalCoverArtAsset) {
                const randomColors = generateRandomColors()
                coverColor = randomColors.background
                coverTextColor = randomColors.text
                coverFontFamily = getRandomFontFamily()
                finalCoverArtAsset = '' // No cover asset
              }

              // --- Find/Create Author (Inside Task) ---
              let authorUser: User | null = null
              if (author) {
                authorUser = await prisma.user.findUnique({
                  where: { name: author },
                })
                if (!authorUser) {
                  try {
                    authorUser = await prisma.user.create({
                      data: {
                        name: author,
                        // Ensure unique email using fiction ID as fallback
                        email: `${author.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.${numericFictionId}@example.com`,
                        password: createHash('sha256').update(Math.random().toString()).digest('hex'), // Random secure password
                        role: 'author', // Assign an author role maybe?
                      },
                    })
                  } catch (e: unknown) {
                    if (e instanceof Error && 'code' in e && e.code === 'P2002') {
                      // Unique constraint violation
                      console.warn(`Author ${author} likely created by concurrent task, refetching...`)
                      await new Promise((resolve) => setTimeout(resolve, Math.random() * 500)) // Small random delay
                      authorUser = await prisma.user.findUnique({
                        where: { name: author },
                      })
                    } else {
                      console.error(`Error creating author ${author}: ${e}`)
                      throw e
                    }
                  }
                }
              }

              if (!authorUser) {
                // If author still null (either not found or creation failed)
                console.error(
                  `Story ${title} (ID: ${numericFictionId}) could not associate author '${author}'. Assigning to default user ID 1.`,
                )
                authorUser = await prisma.user.findUnique({ where: { id: 1 } }) // Assuming user ID 1 exists
                if (!authorUser) throw new Error('Default user ID 1 not found! Cannot proceed without an author.')
              }

              // --- Upsert Story (Inside Task) ---
              const storyDataPayload = {
                name: title,
                summary: decodedDescription.substring(0, 65000), // Limit size
                ownerId: authorUser.id, // Author user ID
                royalRoadId: numericFictionId,
                status: storyStatus as StoryStatus,
                type: isFanfiction ? 'FANFICTION' : ('ORIGINAL' as StoryType),
                wordsPerWeek: wordsPerWeek, // Already rounded
                spellingLevel: spellingLevel > 0 ? spellingLevel : null, // Store null if not scored
                chapters: chapters.length,
                firstChapterReleasedAt: firstChapterDate,
                lastChapterReleasedAt: lastChapterDate,
                coverArtAsset: finalCoverArtAsset ?? '',
                coverColor: coverColor ?? '#000000',
                coverTextColor: coverTextColor ?? '#FFFFFF',
                coverFontFamily: coverFontFamily ?? 'Georgia, serif',
                published: true,
                pages: pages,
              }

              const upsertedStory = await prisma.story.upsert({
                where: { royalRoadId: numericFictionId },
                create: storyDataPayload,
                update: storyDataPayload,
                include: { storyTags: { include: { tag: true } } }, // Include for tag comparison
              })

              // --- Cover File Upload and DB Record (Inside Task) ---
              if (coverData && finalCoverArtAsset && upsertedStory) {
                try {
                  const coverMetadata = await sharp(coverData).metadata()
                  const coverHash = createHash('sha256').update(coverData).digest('hex')
                  // Define a structured storage path using story ID
                  const storagePath = `uploads/users/${authorUser.id}/stories/${upsertedStory.id}/cover.jpg`
                  const localPathForDb = finalCoverArtAsset // Should be /cover.jpg

                  const existingFile = await prisma.file.findFirst({
                    where: { path: storagePath },
                  })

                  // Upload only if file doesn't exist in DB record or hash differs
                  const shouldUpload = !existingFile || existingFile.sha256 !== coverHash

                  if (shouldUpload) {
                    console.log(`Uploading cover for ${title} to ${storagePath}`)
                    await uploadFile(coverData, storagePath, 'image/jpeg')
                  } else {
                    console.log(`Cover ${storagePath} already exists with same hash for ${title}. Skipping upload.`)
                  }

                  // Always upsert file record to ensure metadata & linkage are correct
                  await prisma.file.upsert({
                    where: { path: storagePath },
                    create: {
                      ownerId: authorUser.id,
                      storyId: upsertedStory.id,
                      path: storagePath,
                      localPath: localPathForDb,
                      mimeType: 'image/jpeg',
                      width: coverMetadata.width,
                      height: coverMetadata.height,
                      bytes: coverMetadata.size,
                      sha256: coverHash,
                    },
                    update: {
                      ownerId: authorUser.id,
                      storyId: upsertedStory.id,
                      localPath: localPathForDb,
                      mimeType: 'image/jpeg',
                      width: coverMetadata.width,
                      height: coverMetadata.height,
                      bytes: coverMetadata.size,
                      sha256: coverHash,
                    },
                  })
                } catch (fileError) {
                  console.error(`Error processing/uploading cover file for ${title}: ${fileError}`)
                  // If file handling fails, ensure story record doesn't point to a non-existent file
                  if (upsertedStory.coverArtAsset === finalCoverArtAsset) {
                    await prisma.story.update({
                      where: { id: upsertedStory.id },
                      data: { coverArtAsset: '' }, // Clear asset path
                    })
                  }
                }
              }

              // --- Tag Management (Inside Task) ---
              const existingTagNames = new Set(upsertedStory.storyTags.map((st) => st.tag.name))
              const tagsToCreate: { storyId: string; tagId: string }[] = []

              for (const tagName of tags) {
                if (!existingTagNames.has(tagName)) {
                  let tagId = tagMap.get(tagName)
                  if (!tagId) {
                    try {
                      // Use Prisma transaction for findOrCreate behavior attempt
                      const tag = await prisma.tag.upsert({
                        where: { name: tagName },
                        create: { name: tagName },
                        update: {}, // No update needed if found
                      })
                      tagId = tag.id
                      tagMap.set(tagName, tagId) // Update local cache
                    } catch (e: unknown) {
                      // Catch potential errors during upsert (though less likely for tags)
                      console.error(`Error upserting tag '${tagName}': ${e}`)
                      // Optionally retry or fetch again
                      const existingTag = await prisma.tag.findUnique({
                        where: { name: tagName },
                      })
                      if (existingTag) tagId = existingTag.id
                      else {
                        console.error(`Could not find or create tag '${tagName}' after error.`)
                        continue // Skip this tag if creation failed
                      }
                    }
                  }
                  if (tagId) {
                    // Ensure we have a tagId before pushing
                    tagsToCreate.push({
                      storyId: upsertedStory.id,
                      tagId: tagId,
                    })
                  }
                }
              }
              if (tagsToCreate.length > 0) {
                await prisma.storyTag.createMany({
                  data: tagsToCreate,
                  skipDuplicates: true, // Avoid errors if race condition occurs here too
                })
              }

              // Increment counters after successful processing
              if (dbStoryInfo) {
                updatedCount++
              } else {
                createdCount++
              }
            } catch (taskError) {
              console.error(`Error processing story ${title} (ID: ${numericFictionId}) in parallel task: ${taskError}`)
              // Optional: Add retry logic or specific error handling here
            } finally {
              processingCounter-- // Decrement counter when task finishes
              if (processingCounter % 20 === 0 || queue.size < 5) {
                // Log less frequently
                console.log(
                  `Finished task. Queue size: ${queue.size}, Pending: ${queue.pending}, Active: ${processingCounter}`,
                )
              }
            }
          }) // End of queue.add
        } catch (fetchError) {
          console.error(`Error fetching page or cover for ${title} (ID: ${numericFictionId}): ${fetchError}`)
          // Skip this story if essential data fetching failed
        }
      } catch (listNodeError) {
        console.error(`Error processing a node on list page ${i}: ${listNodeError}`)
      }
    } // End loop over story nodes

    console.log(
      `Finished list page ${i}. Updated: ${updatedCount}, Created: ${createdCount}, Skipped: ${skippedCount}. Queue size: ${queue.size}`,
    )
  } // End loop over pages

  console.log('Finished iterating pages. Waiting for processing queue to complete...')
  await queue.onIdle() // Wait for all queued tasks to finish
  console.log(
    `Retrieval process complete. Total Created: ${createdCount}, Total Updated: ${updatedCount}, Total Skipped: ${skippedCount}`,
  )
}

// --- Run the Retrieve Function ---
retrieve()
  .catch((e) => {
    console.error('Unhandled error during retrieval:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
