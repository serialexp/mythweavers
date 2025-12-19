#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js'
import {
  type Book,
  type Character,
  type Language,
  type Location,
  type Node,
  type Scene,
  type SceneParagraph,
  type Story,
  characterToMarkdown,
  contentSchemaToText,
  locationToMarkdown,
  sceneToMarkdown,
  storyToMarkdown,
} from '@writer/shared'

const server = new Server(
  {
    name: 'writer-files',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

// Helper function to read JSON file
async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(content) as T
}

// Helper function to list directories
async function listDirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch (_error) {
    return []
  }
}

// Helper function to check if file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

// Helper function to traverse the story structure
function traverseStructure(nodes: Node[], callback: (node: Node, parent?: Node) => void, parent?: Node) {
  for (const node of nodes) {
    callback(node, parent)
    if (node.children) {
      traverseStructure(node.children, callback, node)
    }
  }
}

// Helper function to find all nodes of a specific type
function findNodesOfType(nodes: Node[], type: string): Node[] {
  const result: Node[] = []
  traverseStructure(nodes, (node) => {
    if (node.type === type) {
      result.push(node)
    }
  })
  return result
}

// Helper function to find parent node
function findParentOfNode(nodes: Node[], targetId: string, type: string): Node | null {
  let parent: Node | null = null
  traverseStructure(nodes, (node) => {
    if (node.children) {
      for (const child of node.children) {
        if (child.id === targetId && node.type === type) {
          parent = node
          return
        }
      }
    }
  })
  return parent
}

// Helper function to find all context nodes
function findContextNodes(nodes: Node[]): Node[] {
  const contextNodes: Node[] = []

  const traverse = (node: Node, parentIsContext = false) => {
    // If this is a scene node and either:
    // 1. It has nodeType "context", or
    // 2. Its parent is a context node
    if (node.type === 'scene' && (node.nodeType === 'context' || parentIsContext)) {
      contextNodes.push(node)
    }

    // If this node is a context node, mark all its children as being under a context node
    const isContext = node.nodeType === 'context'

    if (node.children) {
      for (const child of node.children) {
        traverse(child, isContext)
      }
    }
  }

  for (const node of nodes) {
    traverse(node)
  }

  return contextNodes
}

// Helper function to get the path to a node
function getPathToNode(nodes: Node[], targetId: string): Node[] {
  const path: Node[] = []

  const traverse = (node: Node): boolean => {
    path.push(node)

    if (node.id === targetId) {
      return true
    }

    if (node.children) {
      for (const child of node.children) {
        if (traverse(child)) {
          return true
        }
      }
    }

    path.pop()
    return false
  }

  for (const node of nodes) {
    if (traverse(node)) {
      return path
    }
  }

  return []
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'read_story',
        description: "Read a story's metadata and structure from a writer project",
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the writer project directory',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'read_character',
        description: "Read a character's details from a writer project",
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the writer project directory',
            },
            characterId: {
              type: 'string',
              description: 'ID of the character to read',
            },
          },
          required: ['projectPath', 'characterId'],
        },
      },
      {
        name: 'read_location',
        description: "Read a location's details from a writer project",
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the writer project directory',
            },
            locationId: {
              type: 'string',
              description: 'ID of the location to read',
            },
          },
          required: ['projectPath', 'locationId'],
        },
      },
      {
        name: 'read_scene',
        description: "Read a scene's content from a writer project",
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the writer project directory',
            },
            sceneId: {
              type: 'string',
              description: 'ID of the scene to read',
            },
            includeParagraphs: {
              type: 'boolean',
              description: 'Whether to include paragraph content',
              default: true,
            },
          },
          required: ['projectPath', 'sceneId'],
        },
      },
      {
        name: 'list_characters',
        description: 'List all characters in a writer project',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the writer project directory',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'list_locations',
        description: 'List all locations in a writer project',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the writer project directory',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'read_full_story',
        description:
          'Read the complete story structure showing the hierarchy of books, arcs, chapters, and scenes with their IDs and titles',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the writer project directory',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'search_story',
        description: 'Search for content across the entire story (scenes, characters, locations, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the writer project directory',
            },
            query: {
              type: 'string',
              description: 'Search query',
            },
            searchIn: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['scenes', 'characters', 'locations', 'plotPoints', 'books', 'arcs', 'chapters'],
              },
              description: 'Types of content to search in',
              default: ['scenes', 'characters', 'locations', 'plotPoints'],
            },
          },
          required: ['projectPath', 'query'],
        },
      },
      {
        name: 'list_context_nodes',
        description:
          "List all context nodes in the story structure. Context nodes provide background information and are marked with nodeType='context'",
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the writer project directory',
            },
            includeContent: {
              type: 'boolean',
              description: 'Whether to include scene content for context nodes',
              default: false,
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'read_story_context',
        description:
          'Read all context nodes to get background information for the story. This is useful when you need to understand the world, history, or background details before working on scenes.',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the writer project directory',
            },
          },
          required: ['projectPath'],
        },
      },
      {
        name: 'list_recent_stories',
        description: 'List recently opened stories from the writer app. Returns story names and their file paths.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'read_story': {
        const { projectPath } = args as { projectPath: string }
        const indexPath = path.join(projectPath, 'index.json')

        if (!(await fileExists(indexPath))) {
          throw new McpError(ErrorCode.InvalidRequest, `No writer project found at ${projectPath}`)
        }

        const fileData = await readJsonFile<{ story: Story; language?: Language }>(indexPath)
        const story = fileData.story

        // Get list of books from structure
        const bookNodes = findNodesOfType(story.structure || [], 'book')
        const books: Book[] = []

        for (const bookNode of bookNodes) {
          if (story.book?.[bookNode.id]) {
            books.push(story.book[bookNode.id])
          }
        }

        const markdown = storyToMarkdown(story, books)

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
        }
      }

      case 'read_character': {
        const { projectPath, characterId } = args as {
          projectPath: string
          characterId: string
        }

        const characterPath = path.join(projectPath, 'characters', `${characterId}.json`)

        if (!(await fileExists(characterPath))) {
          throw new McpError(ErrorCode.InvalidRequest, `Character ${characterId} not found`)
        }

        const character = await readJsonFile<Character>(characterPath)
        const markdown = characterToMarkdown(character)

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
        }
      }

      case 'read_location': {
        const { projectPath, locationId } = args as {
          projectPath: string
          locationId: string
        }

        const locationPath = path.join(projectPath, 'locations', `${locationId}.json`)

        if (!(await fileExists(locationPath))) {
          throw new McpError(ErrorCode.InvalidRequest, `Location ${locationId} not found`)
        }

        const location = await readJsonFile<Location>(locationPath)
        const markdown = locationToMarkdown(location)

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
        }
      }

      case 'read_scene': {
        const {
          projectPath,
          sceneId,
          includeParagraphs = true,
        } = args as {
          projectPath: string
          sceneId: string
          includeParagraphs?: boolean
        }

        const scenePath = path.join(projectPath, 'scene', `${sceneId}.json`)

        if (!(await fileExists(scenePath))) {
          throw new McpError(ErrorCode.InvalidRequest, `Scene ${sceneId} not found`)
        }

        const scene = await readJsonFile<Scene>(scenePath)
        const paragraphs = includeParagraphs ? scene.paragraphs || [] : []

        const markdown = sceneToMarkdown(scene, paragraphs)

        return {
          content: [
            {
              type: 'text',
              text: markdown,
            },
          ],
        }
      }

      case 'list_characters': {
        const { projectPath } = args as { projectPath: string }
        const charactersDir = path.join(projectPath, 'characters')

        try {
          const files = await fs.readdir(charactersDir)
          const characters: Array<{ id: string; name: string }> = []

          for (const file of files) {
            if (file.endsWith('.json')) {
              const characterPath = path.join(charactersDir, file)
              const character = await readJsonFile<Character>(characterPath)
              const nameParts = []
              if (character.firstName) nameParts.push(character.firstName)
              if (character.middleName) nameParts.push(character.middleName)
              if (character.lastName) nameParts.push(character.lastName)
              const fullName = nameParts.join(' ') || character.name || 'Unnamed'

              characters.push({
                id: character.id,
                name: fullName,
              })
            }
          }

          const markdown = characters.map((c) => `- ${c.name} (ID: ${c.id})`).join('\n')

          return {
            content: [
              {
                type: 'text',
                text: `# Characters\n\n${markdown}`,
              },
            ],
          }
        } catch (_error) {
          return {
            content: [
              {
                type: 'text',
                text: 'No characters found',
              },
            ],
          }
        }
      }

      case 'list_locations': {
        const { projectPath } = args as { projectPath: string }
        const locationsDir = path.join(projectPath, 'locations')

        try {
          const files = await fs.readdir(locationsDir)
          const locations: Array<{ id: string; name: string }> = []

          for (const file of files) {
            if (file.endsWith('.json')) {
              const locationPath = path.join(locationsDir, file)
              const location = await readJsonFile<Location>(locationPath)
              locations.push({
                id: location.id,
                name: location.name,
              })
            }
          }

          const markdown = locations.map((l) => `- ${l.name} (ID: ${l.id})`).join('\n')

          return {
            content: [
              {
                type: 'text',
                text: `# Locations\n\n${markdown}`,
              },
            ],
          }
        } catch (_error) {
          return {
            content: [
              {
                type: 'text',
                text: 'No locations found',
              },
            ],
          }
        }
      }

      case 'read_full_story': {
        const { projectPath } = args as { projectPath: string }

        const indexPath = path.join(projectPath, 'index.json')

        if (!(await fileExists(indexPath))) {
          throw new McpError(ErrorCode.InvalidRequest, `No writer project found at ${projectPath}`)
        }

        const fileData = await readJsonFile<{ story: Story; language?: Language }>(indexPath)
        const story = fileData.story
        const parts: string[] = [`# Story Structure: ${story.name}\n`]

        // Add some basic stats
        if (story.structure) {
          const bookCount = findNodesOfType(story.structure, 'book').length
          const arcCount = findNodesOfType(story.structure, 'arc').length
          const chapterCount = findNodesOfType(story.structure, 'chapter').length
          const sceneCount = findNodesOfType(story.structure, 'scene').length

          parts.push('\n## Overview')
          parts.push(`- Books: ${bookCount}`)
          parts.push(`- Arcs: ${arcCount}`)
          parts.push(`- Chapters: ${chapterCount}`)
          parts.push(`- Scenes: ${sceneCount}`)
          parts.push('\n## Structure\n')
        }

        // Build an XML view of the structure
        const buildXmlView = (node: Node, indent = '') => {
          const attrs: string[] = [`id="${node.id}"`]
          if (node.name) attrs.push(`name="${node.name.replace(/"/g, '&quot;')}"`)
          if (node.nodeType && node.nodeType !== 'story') attrs.push(`nodeType="${node.nodeType}"`)

          const tag = node.type
          const attrString = attrs.join(' ')

          if (node.children && node.children.length > 0) {
            parts.push(`${indent}<${tag} ${attrString}>`)
            for (const child of node.children) {
              buildXmlView(child, `${indent}  `)
            }
            parts.push(`${indent}</${tag}>`)
          } else {
            parts.push(`${indent}<${tag} ${attrString} />`)
          }
        }

        parts.push('<structure>')
        // Build the XML view for all root nodes
        for (const node of story.structure || []) {
          buildXmlView(node, '  ')
        }
        parts.push('</structure>')

        return {
          content: [
            {
              type: 'text',
              text: parts.join('\n'),
            },
          ],
        }
      }

      case 'list_context_nodes': {
        const { projectPath, includeContent = false } = args as {
          projectPath: string
          includeContent?: boolean
        }

        const indexPath = path.join(projectPath, 'index.json')

        if (!(await fileExists(indexPath))) {
          throw new McpError(ErrorCode.InvalidRequest, `No writer project found at ${projectPath}`)
        }

        const fileData = await readJsonFile<{ story: Story; language?: Language }>(indexPath)
        const story = fileData.story
        const contextNodes = findContextNodes(story.structure || [])

        if (contextNodes.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No context nodes found in the story',
              },
            ],
          }
        }

        const parts: string[] = [`# Context Nodes\n\nFound ${contextNodes.length} context nodes:`]

        for (const node of contextNodes) {
          // Get the path to show where this node is located
          const nodePath = getPathToNode(story.structure || [], node.id)
          const locationParts: string[] = []

          for (const pathNode of nodePath) {
            if (pathNode.type === 'book' && story.book?.[pathNode.id]) {
              locationParts.push(story.book[pathNode.id].title)
            } else if (pathNode.type === 'arc' && story.arc?.[pathNode.id]) {
              locationParts.push(story.arc[pathNode.id].title)
            } else if (pathNode.type === 'chapter' && story.chapter?.[pathNode.id]) {
              locationParts.push(story.chapter[pathNode.id].title)
            }
          }

          parts.push(`\n## ${node.name || 'Unnamed Context Node'} (ID: ${node.id})`)
          parts.push(`**Location**: ${locationParts.join(' > ')}`)

          if (story.scene?.[node.id]) {
            const scene = story.scene[node.id]
            if (scene.summary) {
              parts.push(`**Summary**: ${scene.summary}`)
            }

            if (scene.words) {
              parts.push(`**Word Count**: ${scene.words}`)
            }

            if (includeContent) {
              // Try to load full scene content
              const scenePath = path.join(projectPath, 'scene', `${node.id}.json`)
              if (await fileExists(scenePath)) {
                const fullScene = await readJsonFile<Scene>(scenePath)
                let paragraphs = fullScene.paragraphs

                if (!paragraphs) {
                  const paragraphsPath = path.join(projectPath, 'scene', node.id)
                  const paragraphsFile = path.join(paragraphsPath, 'paragraphs.json')
                  if (await fileExists(paragraphsFile)) {
                    paragraphs = await readJsonFile<SceneParagraph[]>(paragraphsFile)
                  }
                }

                if (paragraphs && paragraphs.length > 0) {
                  parts.push('\n### Content')
                  for (const para of paragraphs) {
                    const text = typeof para.text === 'string' ? para.text : contentSchemaToText(para.text)
                    if (text) {
                      parts.push(`\n${text}`)
                    }
                  }
                }
              }
            }
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: parts.join('\n'),
            },
          ],
        }
      }

      case 'read_story_context': {
        const { projectPath } = args as { projectPath: string }

        const indexPath = path.join(projectPath, 'index.json')

        if (!(await fileExists(indexPath))) {
          throw new McpError(ErrorCode.InvalidRequest, `No writer project found at ${projectPath}`)
        }

        const fileData = await readJsonFile<{ story: Story; language?: Language }>(indexPath)
        const story = fileData.story
        const contextNodes = findContextNodes(story.structure || [])

        if (contextNodes.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No context nodes found in the story',
              },
            ],
          }
        }

        const parts: string[] = [
          '# Story Context\n\nThis document contains all context nodes that provide background information for the story.\n',
        ]

        // Group context nodes by their parent chapter for better organization
        const nodesByChapter = new Map<string, Array<{ node: Node; location: string[] }>>()

        for (const node of contextNodes) {
          const nodePath = getPathToNode(story.structure || [], node.id)
          const locationParts: string[] = []
          let chapterKey = 'Unknown'

          for (const pathNode of nodePath) {
            if (pathNode.type === 'book' && story.book?.[pathNode.id]) {
              locationParts.push(story.book[pathNode.id].title)
            } else if (pathNode.type === 'arc' && story.arc?.[pathNode.id]) {
              locationParts.push(story.arc[pathNode.id].title)
            } else if (pathNode.type === 'chapter' && story.chapter?.[pathNode.id]) {
              locationParts.push(story.chapter[pathNode.id].title)
              chapterKey = locationParts.join(' > ')
            }
          }

          if (!nodesByChapter.has(chapterKey)) {
            nodesByChapter.set(chapterKey, [])
          }
          nodesByChapter.get(chapterKey)!.push({ node, location: locationParts })
        }

        // Output context nodes grouped by chapter
        for (const [chapter, nodes] of nodesByChapter) {
          parts.push(`\n## ${chapter}`)

          for (const { node, location } of nodes) {
            parts.push(`\n### ${node.name || 'Context Node'} (Scene ID: ${node.id})`)

            if (story.scene?.[node.id]) {
              const scene = story.scene[node.id]

              if (scene.summary) {
                parts.push(`\n**Summary**: ${scene.summary}`)
              }

              // Always include content for context nodes
              const scenePath = path.join(projectPath, 'scene', `${node.id}.json`)
              if (await fileExists(scenePath)) {
                const fullScene = await readJsonFile<Scene>(scenePath)
                let paragraphs = fullScene.paragraphs

                if (!paragraphs) {
                  const paragraphsPath = path.join(projectPath, 'scene', node.id)
                  const paragraphsFile = path.join(paragraphsPath, 'paragraphs.json')
                  if (await fileExists(paragraphsFile)) {
                    paragraphs = await readJsonFile<SceneParagraph[]>(paragraphsFile)
                  }
                }

                if (paragraphs && paragraphs.length > 0) {
                  parts.push('\n**Content**:')
                  for (const para of paragraphs) {
                    const text = typeof para.text === 'string' ? para.text : contentSchemaToText(para.text)
                    if (text) {
                      parts.push(`\n${text}`)
                    }
                  }
                } else if (scene.text) {
                  parts.push(`\n**Content**:\n${scene.text}`)
                }
              }
            }
          }
        }

        parts.push(`\n---\n\n*Total context nodes: ${contextNodes.length}*`)

        return {
          content: [
            {
              type: 'text',
              text: parts.join('\n'),
            },
          ],
        }
      }

      case 'search_story': {
        const {
          projectPath,
          query,
          searchIn = ['scenes', 'characters', 'locations', 'plotPoints'],
        } = args as {
          projectPath: string
          query: string
          searchIn?: string[]
        }

        const indexPath = path.join(projectPath, 'index.json')

        if (!(await fileExists(indexPath))) {
          throw new McpError(ErrorCode.InvalidRequest, `No writer project found at ${projectPath}`)
        }

        const fileData = await readJsonFile<{ story: Story; language?: Language }>(indexPath)
        const story = fileData.story
        const results: string[] = []
        const searchQuery = query.toLowerCase()

        // Search in scenes
        if (searchIn.includes('scenes') && story.scene) {
          for (const [sceneId, scene] of Object.entries(story.scene)) {
            const matches: string[] = []

            if (scene.title?.toLowerCase().includes(searchQuery)) {
              matches.push(`Title: "${scene.title}"`)
            }
            if (scene.summary?.toLowerCase().includes(searchQuery)) {
              matches.push(`Summary: "${scene.summary}"`)
            }
            if (scene.text?.toLowerCase().includes(searchQuery)) {
              matches.push('Content matches')
            }

            // Check paragraphs if they exist
            if (scene.paragraphs) {
              for (const para of scene.paragraphs) {
                const text = typeof para.text === 'string' ? para.text : contentSchemaToText(para.text)
                if (text.toLowerCase().includes(searchQuery)) {
                  matches.push('Paragraph content matches')
                  break
                }
              }
            }

            if (matches.length > 0) {
              results.push(`\n## Scene: ${scene.title} (ID: ${sceneId})\n${matches.join('\n')}`)
            }
          }
        }

        // Search in characters
        if (searchIn.includes('characters') && story.characters) {
          for (const [charId, character] of Object.entries(story.characters)) {
            const matches: string[] = []
            const fullName =
              [character.firstName, character.middleName, character.lastName].filter(Boolean).join(' ') ||
              character.name ||
              ''

            if (fullName.toLowerCase().includes(searchQuery)) {
              matches.push(`Name: "${fullName}"`)
            }
            if (character.nickname?.toLowerCase().includes(searchQuery)) {
              matches.push(`Nickname: "${character.nickname}"`)
            }
            if (character.summary?.toLowerCase().includes(searchQuery)) {
              matches.push('Summary matches')
            }
            if (character.background?.toLowerCase().includes(searchQuery)) {
              matches.push('Background matches')
            }
            if (character.personality?.toLowerCase().includes(searchQuery)) {
              matches.push('Personality matches')
            }

            if (matches.length > 0) {
              results.push(`\n## Character: ${fullName} (ID: ${charId})\n${matches.join('\n')}`)
            }
          }
        }

        // Search in locations
        if (searchIn.includes('locations') && story.locations) {
          for (const [locId, location] of Object.entries(story.locations)) {
            const matches: string[] = []

            if (location.name?.toLowerCase().includes(searchQuery)) {
              matches.push(`Name: "${location.name}"`)
            }
            if (location.description?.toLowerCase().includes(searchQuery)) {
              matches.push('Description matches')
            }

            if (matches.length > 0) {
              results.push(`\n## Location: ${location.name} (ID: ${locId})\n${matches.join('\n')}`)
            }
          }
        }

        // Search in plot points
        if (searchIn.includes('plotPoints') && story.plotPoints) {
          for (const [ppId, plotPoint] of Object.entries(story.plotPoints)) {
            const matches: string[] = []

            if (plotPoint.title?.toLowerCase().includes(searchQuery)) {
              matches.push(`Title: "${plotPoint.title}"`)
            }
            if (plotPoint.summary?.toLowerCase().includes(searchQuery)) {
              matches.push('Summary matches')
            }

            if (matches.length > 0) {
              results.push(
                `\n## Plot Point: ${plotPoint.title} (ID: ${ppId})\nStatus: ${plotPoint.state}\n${matches.join('\n')}`,
              )
            }
          }
        }

        // Search in books
        if (searchIn.includes('books') && story.book) {
          for (const [bookId, book] of Object.entries(story.book)) {
            const matches: string[] = []

            if (book.title?.toLowerCase().includes(searchQuery)) {
              matches.push(`Title: "${book.title}"`)
            }
            if (book.summary?.toLowerCase().includes(searchQuery)) {
              matches.push('Summary matches')
            }

            if (matches.length > 0) {
              results.push(`\n## Book: ${book.title} (ID: ${bookId})\n${matches.join('\n')}`)
            }
          }
        }

        // Search in arcs
        if (searchIn.includes('arcs') && story.arc) {
          for (const [arcId, arc] of Object.entries(story.arc)) {
            const matches: string[] = []

            if (arc.title?.toLowerCase().includes(searchQuery)) {
              matches.push(`Title: "${arc.title}"`)
            }
            if (arc.summary?.toLowerCase().includes(searchQuery)) {
              matches.push('Summary matches')
            }

            if (matches.length > 0) {
              results.push(`\n## Arc: ${arc.title} (ID: ${arcId})\n${matches.join('\n')}`)
            }
          }
        }

        // Search in chapters
        if (searchIn.includes('chapters') && story.chapter) {
          for (const [chapterId, chapter] of Object.entries(story.chapter)) {
            const matches: string[] = []

            if (chapter.title?.toLowerCase().includes(searchQuery)) {
              matches.push(`Title: "${chapter.title}"`)
            }
            if (chapter.summary?.toLowerCase().includes(searchQuery)) {
              matches.push('Summary matches')
            }

            if (matches.length > 0) {
              results.push(`\n## Chapter: ${chapter.title} (ID: ${chapterId})\n${matches.join('\n')}`)
            }
          }
        }

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No results found for "${query}"`,
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `# Search Results for "${query}"\n\nFound ${results.length} matches:\n${results.join('\n')}`,
            },
          ],
        }
      }

      case 'list_recent_stories': {
        try {
          // Construct the path to the global settings file
          const homeDir = os.homedir()
          const settingsPath = path.join(
            homeDir,
            '.local',
            'share',
            'com.serial-experiments.writer',
            'global-settings.bin',
          )

          // Check if the file exists
          if (!(await fileExists(settingsPath))) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No recent stories found. The writer app settings file does not exist.',
                },
              ],
            }
          }

          // Read the settings file
          const settingsContent = await fs.readFile(settingsPath, 'utf-8')

          // Parse the JSON content
          let settings: any
          try {
            settings = JSON.parse(settingsContent)
          } catch (_parseError) {
            throw new McpError(ErrorCode.InternalError, 'Failed to parse settings file. It may be corrupted.')
          }

          // Extract recent stories
          const recentStories = settings.recentStories || []

          if (recentStories.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No recent stories found in the writer app.',
                },
              ],
            }
          }

          // Format the output
          const parts: string[] = ['# Recent Stories\n']

          for (const story of recentStories) {
            parts.push(`## ${story.name || 'Unnamed Story'}`)
            parts.push(`**Path**: ${story.path}`)

            // Check if the story still exists at that path
            const indexPath = path.join(story.path, 'index.json')
            const exists = await fileExists(indexPath)
            if (!exists) {
              parts.push('*⚠️  Story file not found at this location*')
            }

            parts.push('') // Empty line between stories
          }

          return {
            content: [
              {
                type: 'text',
                text: parts.join('\n'),
              },
            ],
          }
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Error reading recent stories: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Writer MCP server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
