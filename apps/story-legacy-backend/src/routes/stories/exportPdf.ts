import { exec } from 'node:child_process'
import * as os from 'node:os'
import * as path from 'node:path'
import { promisify } from 'node:util'
import { Router } from 'express'
import * as fs from 'fs-extra'
import { prisma } from '../../lib/prisma'
import { AuthRequest } from '../../middleware/auth'
import { evaluateTemplate, executeScriptsUpToMessage } from '../../utils/scriptEngine'

const router = Router()
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

// Helper function to process text
function processText(text: string): string {
  // Escape Typst special characters
  return escapeTypst(text)
}

// Helper function to generate Typst content
function generateTypstContent(story: any, evaluatedCharacters: any[]): string {
  const characters = evaluatedCharacters
    .map(
      (c: any) => `- *${escapeTypst(c.name)}*${c.isProtagonist ? ' (Protagonist)' : ''}: ${escapeTypst(c.description)}`,
    )
    .join('\n')

  // Collect chapters for TOC and content processing
  const chapters: { title: string; label: string }[] = []
  let processedContent = ''
  let chapterCounter = 0

  for (const msg of story.messages) {
    if (msg.type === 'chapter') {
      chapterCounter++
      const chapterLabel = `chapter_${chapterCounter}`
      chapters.push({ title: msg.content, label: chapterLabel })

      // Add chapter title with label for TOC and header state update
      const chapterTitle = escapeTypst(msg.content)

      // Use heading level 1 for chapters - this creates PDF bookmarks
      // The pagebreak is handled by the heading style
      processedContent += `#label("${chapterLabel}")
#context {
  state("current-chapter").update("${chapterTitle}")
}

= ${chapterTitle}

`
    } else {
      // Regular message content
      const content = processText(msg.content)

      // Add message with a subtle separator
      processedContent += `${content}

#align(center)[
  #text(size: 8pt, fill: gray)[• • •]
]

#v(0.3cm)

`
    }
  }

  // Generate TOC entries
  const tocEntries = chapters
    .map(
      (ch) =>
        `  #link(label("${ch.label}"))[${escapeTypst(ch.title)}] #box(width: 1fr, repeat[.]) #context counter(page).at(label("${ch.label}")).first()\n`,
    )
    .join('')

  return `// Define state for current chapter
#let current-chapter = state("current-chapter", "")

#set document(
  title: "${escapeTypst(story.name)}",
  author: "Story App",
)

#set page(
  paper: "a4",
  margin: (x: 2cm, y: 2.5cm),
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

// Title page
#align(center)[
  #text(size: 24pt, weight: "bold")[${escapeTypst(story.name)}]

  #v(0.5cm)

  #text(size: 10pt, style: "italic")[
    ${escapeTypst(story.storySetting || 'A Story')}
  ]

  #v(0.3cm)

  #text(size: 9pt)[
    Generated on ${new Date().toLocaleDateString()}
  ]
]

#v(1cm)

${
  characters.length > 0
    ? `#heading(level: 2, outlined: false)[Characters]

${characters}

#v(0.5cm)
`
    : ''
}

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

// GET story as PDF
router.get('/stories/:id/pdf', async (req, res) => {
  try {
    const story = await prisma.story.findFirst({
      where: {
        id: req.params.id,
        userId: (req as any as AuthRequest).userId,
        deleted: false,
      },
      include: {
        messages: {
          where: {
            deleted: false,
            isQuery: false,
          },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            content: true,
            type: true,
            order: true,
            role: true,
            script: true,
          },
        },
        characters: true,
        contextItems: true,
      },
    })

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
    }

    // Get the last message ID for script evaluation
    const lastMessage = story.messages[story.messages.length - 1]
    let evaluatedCharacters = story.characters

    if (lastMessage && story.characters.length > 0) {
      // Execute scripts up to the last message to get the final state
      const scriptData = executeScriptsUpToMessage(
        story.messages as any,
        lastMessage.id,
        story.globalScript || undefined,
      )

      // Evaluate character templates with the final script data
      evaluatedCharacters = story.characters.map((character) => ({
        ...character,
        name: evaluateTemplate(character.name, scriptData),
        description: evaluateTemplate(character.description, scriptData),
      }))
    }

    // Create a temporary directory for the Typst files
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'story-pdf-'))
    const typstFile = path.join(tempDir, 'story.typ')
    const pdfFile = path.join(tempDir, 'story.pdf')

    try {
      // Generate Typst content with evaluated characters
      const typstContent = generateTypstContent(story, evaluatedCharacters)

      // Write Typst file
      await fs.writeFile(typstFile, typstContent, 'utf8')

      // Run Typst to generate PDF
      const { stderr } = await execAsync(`typst compile "${typstFile}" "${pdfFile}"`)

      if (stderr) {
        console.error('Typst stderr:', stderr)
      }

      // Check if PDF was created
      if (!(await fs.pathExists(pdfFile))) {
        throw new Error('PDF generation failed')
      }

      // Send the PDF
      const pdfBuffer = await fs.readFile(pdfFile)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${story.name.replace(/[^a-z0-9]/gi, '_')}.pdf"`)
      res.send(pdfBuffer)
    } finally {
      // Clean up temporary files
      await fs.remove(tempDir)
    }
  } catch (error) {
    console.error('Error generating PDF:', error)
    res.status(500).json({
      error: 'Failed to generate PDF. Make sure Typst is installed.',
    })
  }
})

export default router
