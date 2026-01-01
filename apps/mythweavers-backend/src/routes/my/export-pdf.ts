import { exec } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { promisify } from 'node:util'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { prisma } from '../../lib/prisma.js'
import { errorSchema } from '../../schemas/common.js'

const execAsync = promisify(exec)

// Helper function to escape Typst special characters
function escapeTypst(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/#/g, '\\#')
    .replace(/\$/g, '\\$')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
}

// Typst code for a centered horizontal line separator
const TYPST_SEPARATOR = `#v(0.5cm)
#align(center)[#line(length: 30%, stroke: 0.5pt + gray)]
#v(0.5cm)`

// Helper function to process text - replace separator patterns with styled separators
function processText(text: string): string {
  // First, check if the entire text is just a separator
  const trimmed = text.trim()
  if (
    /^[-*_]{3,}$/.test(trimmed) || // --- or *** or ___
    /^[-*_](\s+[-*_]){2,}$/.test(trimmed) || // - - - or * * *
    /^[*]{3,}$/.test(trimmed)
  ) {
    // ***
    return TYPST_SEPARATOR
  }

  // Replace separator lines within the text (on their own line)
  let processed = text.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, TYPST_SEPARATOR)
  processed = processed.replace(/^[ \t]*[-*_](\s+[-*_]){2,}[ \t]*$/gm, TYPST_SEPARATOR)

  // Escape Typst special characters for non-separator content
  // Split by our separator, escape each part, rejoin
  const parts = processed.split(TYPST_SEPARATOR)
  return parts.map((part) => escapeTypst(part)).join(TYPST_SEPARATOR)
}

// Types for the scene/chapter data
interface SceneWithContent {
  id: string
  name: string
  chapterName: string
  viewpointCharacterId: string | null
  content: string
}

interface CharacterInfo {
  id: string
  firstName: string
  lastName: string | null
  isMainCharacter: boolean
}

// Helper function to generate Typst content
function generateTypstContent(
  storyName: string,
  storySummary: string | null,
  scenes: SceneWithContent[],
  characterMap: Map<string, CharacterInfo>,
  protagonistId: string | null,
  coverImagePath?: string,
): string {
  // Group scenes by chapter for TOC
  const chapters: { title: string; label: string }[] = []
  let chapterCounter = 0
  let lastChapterName = ''

  // Build chapter info for TOC and track scene->chapter mapping
  const sceneChapterLabels = new Map<string, string>()
  for (const scene of scenes) {
    if (scene.chapterName !== lastChapterName) {
      chapterCounter++
      const chapterLabel = `chapter_${chapterCounter}`
      chapters.push({ title: scene.chapterName, label: chapterLabel })
      lastChapterName = scene.chapterName
    }
    sceneChapterLabels.set(scene.id, `chapter_${chapterCounter}`)
  }

  // Build content following scene order
  let processedContent = ''
  lastChapterName = ''

  for (const scene of scenes) {
    // Add chapter header when chapter changes
    if (scene.chapterName !== lastChapterName) {
      const chapterLabel = sceneChapterLabels.get(scene.id)
      const chapterTitle = escapeTypst(scene.chapterName.replace(/[\r\n]+/g, ' ').trim())

      // Check if this chapter has a different POV character
      let povLine = ''
      if (scene.viewpointCharacterId && protagonistId) {
        if (scene.viewpointCharacterId !== protagonistId) {
          const povChar = characterMap.get(scene.viewpointCharacterId)
          if (povChar) {
            const povName = povChar.lastName
              ? `${povChar.firstName} ${povChar.lastName}`
              : povChar.firstName
            povLine = `\n#align(center)[#text(style: "italic", size: 10pt)[${escapeTypst(povName)}]]\n`
          }
        }
      }

      processedContent += `#label("${chapterLabel}")
#context {
  state("current-chapter").update("${chapterTitle}")
}

= ${chapterTitle}
${povLine}
`
      lastChapterName = scene.chapterName
    }

    // Add scene content
    if (scene.content) {
      const content = processText(scene.content)
      processedContent += `${content}\n\n`
    }
  }

  // Generate TOC entries
  const tocEntries = chapters
    .map((ch) => {
      const cleanTitle = escapeTypst(ch.title.replace(/[\r\n]+/g, ' ').trim())
      return `#link(label("${ch.label}"))[${cleanTitle}] #box(width: 1fr, repeat[.]) #context counter(page).at(label("${ch.label}")).first()`
    })
    .join('\n\n')

  return `// Define state for current chapter
#let current-chapter = state("current-chapter", "")

#set document(
  title: "${escapeTypst(storyName)}",
  author: "MythWeavers",
)

#set page(
  width: 6in,
  height: 9in,
  margin: (x: 0.75in, y: 1in),
  header: context {
    // Get current page number
    let page-num = counter(page).get().first()

    // Only show header after page 2 (title and TOC)
    if page-num > 2 {
      set text(9pt, style: "italic")
      let chapter = current-chapter.get()
      if chapter != "" {
        align(center)[
          #chapter
        ]
        line(length: 100%, stroke: 0.5pt)
      }
    }
  },
  footer: context [
    #set text(9pt)
    #align(center)[
      #counter(page).display("1")
    ]
  ]
)

#set text(
  font: "Linux Libertine",
  size: 11pt,
  fallback: true,
)

#set par(
  justify: true,
  leading: 0.65em,
)

// Style headings for chapters
#set heading(
  numbering: none,  // No chapter numbers
)

#show heading.where(level: 1): it => {
  pagebreak()
  v(2cm)
  text(size: 20pt, weight: "bold")[
    #align(center)[#it.body]
  ]
  v(1cm)
}

${
  coverImagePath
    ? `// Cover page (full bleed)
#page(margin: 0pt)[
  #image("${coverImagePath}", width: 100%, height: 100%, fit: "cover")
]

`
    : ''
}// Title page
#align(center)[
  #text(size: 24pt, weight: "bold")[${escapeTypst(storyName)}]

  #v(0.5cm)

  #text(size: 10pt, style: "italic")[
    ${escapeTypst(storySummary || 'A Story')}
  ]

  #v(0.3cm)

  #text(size: 9pt)[
    Generated on ${new Date().toLocaleDateString()}
  ]
]

#v(1cm)


#pagebreak()

// Table of Contents
${
  chapters.length > 0
    ? `#heading(level: 2, outlined: false)[Table of Contents]

${tocEntries}

#pagebreak()
`
    : ''
}

// Main content
${processedContent}
`
}

const exportPdfRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth)

  // GET /my/stories/:storyId/pdf - Export story as PDF
  fastify.get(
    '/stories/:storyId/pdf',
    {
      schema: {
        description: 'Export story as PDF using Typst',
        tags: ['my-stories'],
        security: [{ sessionAuth: [] }],
        produces: ['application/pdf'],
        params: z.strictObject({
          storyId: z.string().meta({
            description: 'Story ID',
            example: 'clx1234567890',
          }),
        }),
        response: {
          200: {
            description: 'PDF file content',
            content: {
              'application/pdf': {
                schema: z.string().meta({ format: 'binary' }),
              },
            },
          },
          401: errorSchema,
          404: errorSchema,
          500: errorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { storyId } = request.params

        // Load story with hierarchy
        const story = await prisma.story.findFirst({
          where: {
            id: storyId,
            ownerId: userId,
          },
          select: {
            id: true,
            name: true,
            summary: true,
            coverArtFileId: true,
            defaultProtagonistId: true,
          },
        })

        if (!story) {
          return reply.status(404).send({ error: 'Story not found' })
        }

        // Load all books with nested hierarchy
        const books = await prisma.book.findMany({
          where: { storyId, deleted: false },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            arcs: {
              where: { deleted: false },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                name: true,
                chapters: {
                  where: { deleted: false },
                  orderBy: { sortOrder: 'asc' },
                  select: {
                    id: true,
                    name: true,
                    scenes: {
                      where: { deleted: false },
                      orderBy: { sortOrder: 'asc' },
                      select: {
                        id: true,
                        name: true,
                        viewpointCharacterId: true,
                        messages: {
                          where: { deleted: false },
                          orderBy: { sortOrder: 'asc' },
                          select: {
                            id: true,
                            currentMessageRevision: {
                              select: {
                                paragraphs: {
                                  orderBy: { sortOrder: 'asc' },
                                  select: {
                                    currentParagraphRevision: {
                                      select: {
                                        body: true,
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        })

        // Load characters for POV lookup
        const characters = await prisma.character.findMany({
          where: { storyId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            isMainCharacter: true,
          },
        })

        const characterMap = new Map<string, CharacterInfo>()
        let protagonistId: string | null = story.defaultProtagonistId
        for (const char of characters) {
          characterMap.set(char.id, char)
          if (char.isMainCharacter && !protagonistId) {
            protagonistId = char.id
          }
        }

        // Flatten scenes in story order with content
        const scenes: SceneWithContent[] = []
        for (const book of books) {
          for (const arc of book.arcs) {
            for (const chapter of arc.chapters) {
              for (const scene of chapter.scenes) {
                // Combine all paragraph content for this scene
                const paragraphs: string[] = []
                for (const message of scene.messages) {
                  if (message.currentMessageRevision) {
                    for (const para of message.currentMessageRevision.paragraphs) {
                      if (para.currentParagraphRevision?.body) {
                        paragraphs.push(para.currentParagraphRevision.body)
                      }
                    }
                  }
                }

                scenes.push({
                  id: scene.id,
                  name: scene.name,
                  chapterName: chapter.name,
                  viewpointCharacterId: scene.viewpointCharacterId,
                  content: paragraphs.join('\n\n'),
                })
              }
            }
          }
        }

        // Create a temporary directory for the Typst files
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'story-pdf-'))
        const typstFile = path.join(tempDir, 'story.typ')
        const pdfFile = path.join(tempDir, 'story.pdf')

        try {
          // Fetch and save cover image if it exists
          let coverImagePath: string | undefined
          if (story.coverArtFileId) {
            const coverFile = await prisma.file.findUnique({
              where: { id: story.coverArtFileId },
              select: { mimeType: true, path: true },
            })
            if (coverFile?.path) {
              // Copy the file to temp directory
              const extension = coverFile.mimeType?.split('/')[1] || 'png'
              coverImagePath = `cover.${extension}`
              const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
              const sourcePath = path.join(uploadDir, coverFile.path)
              await fs.copyFile(sourcePath, path.join(tempDir, coverImagePath))
            }
          }

          // Generate Typst content
          const typstContent = generateTypstContent(
            story.name,
            story.summary,
            scenes,
            characterMap,
            protagonistId,
            coverImagePath,
          )

          // Write Typst file
          await fs.writeFile(typstFile, typstContent, 'utf8')

          // Run Typst to generate PDF
          const { stderr } = await execAsync(`typst compile "${typstFile}" "${pdfFile}"`)
          if (stderr) {
            fastify.log.warn({ stderr }, 'Typst stderr output')
          }

          // Check if PDF was created
          try {
            await fs.access(pdfFile)
          } catch {
            throw new Error('PDF generation failed - output file not created')
          }

          // Send the PDF
          const pdfBuffer = await fs.readFile(pdfFile)
          const sanitizedName = story.name.replace(/[^a-z0-9]/gi, '_')

          return reply
            .header('Content-Type', 'application/pdf')
            .header('Content-Disposition', `attachment; filename="${sanitizedName}.pdf"`)
            .send(pdfBuffer as unknown as string) // Buffer sent as binary, typed as string for OpenAPI schema
        } finally {
          // Clean up temporary files
          await fs.rm(tempDir, { recursive: true, force: true })
        }
      } catch (error) {
        fastify.log.error({ error }, 'Error generating PDF')
        return reply.status(500).send({
          error: 'Failed to generate PDF. Make sure Typst is installed.',
        })
      }
    },
  )
}

export default exportPdfRoutes
