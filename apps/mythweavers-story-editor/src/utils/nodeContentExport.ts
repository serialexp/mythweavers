import { charactersStore } from '../stores/charactersStore'
import { contextItemsStore } from '../stores/contextItemsStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { TreeNode, nodeStore } from '../stores/nodeStore'
import { Message, Node } from '../types/core'
import { getCharacterDisplayName } from './character'
import { calculateActivePath, getChaptersInStoryOrder } from './nodeTraversal'

function isDescendantOf(node: Node, ancestorId: string, nodesById: Record<string, Node>): boolean {
  let currentParentId: string | null | undefined = node.parentId
  while (currentParentId) {
    if (currentParentId === ancestorId) {
      return true
    }
    const parentNode = nodesById[currentParentId]
    currentParentId = parentNode?.parentId
  }
  return false
}

export function getChapterIdsForNode(nodeId: string): string[] {
  const targetNode = nodeStore.nodes[nodeId]
  if (!targetNode) {
    return []
  }

  if (targetNode.type === 'chapter') {
    return [targetNode.id]
  }

  const nodesArray = nodeStore.nodesArray
  const nodesById = nodeStore.nodes
  const chaptersInOrder = getChaptersInStoryOrder(nodesArray)

  return chaptersInOrder.filter((chapter) => isDescendantOf(chapter, nodeId, nodesById)).map((chapter) => chapter.id)
}

export function getNodeMessageContents(nodeId: string): string[] {
  const chapterIds = getChapterIdsForNode(nodeId)
  if (chapterIds.length === 0) {
    return []
  }

  const chapterIdSet = new Set(chapterIds)
  const chapterMessageMap = new Map<string, string[]>()

  chapterIds.forEach((id) => {
    chapterMessageMap.set(id, [])
  })

  const messages = messagesStore.messages

  for (let i = 0; i < messages.length; i++) {
    const message: Message = messages[i]
    if (message.role !== 'assistant') continue
    if (message.isQuery) continue
    if (message.type === 'chapter') continue

    const nodeIdMatch = message.nodeId && chapterIdSet.has(message.nodeId)
    const chapterIdMatch = message.chapterId && chapterIdSet.has(message.chapterId)
    const owningChapterId = nodeIdMatch ? message.nodeId! : chapterIdMatch ? message.chapterId! : undefined
    if (!owningChapterId || !chapterIdSet.has(owningChapterId)) continue

    const trimmedContent = message.content?.trim()
    if (!trimmedContent) continue

    const bucket = chapterMessageMap.get(owningChapterId)
    if (bucket) {
      bucket.push(trimmedContent)
    }
  }

  const orderedContents: string[] = []
  chapterIds.forEach((id) => {
    const bucket = chapterMessageMap.get(id)
    if (bucket && bucket.length > 0) {
      orderedContents.push(...bucket)
    }
  })

  return orderedContents
}

export function buildNodeMarkdown(nodeId: string): string {
  const contents = getNodeMessageContents(nodeId)
  if (contents.length === 0) {
    return ''
  }
  return contents.join('\n\n')
}

export interface TreeMarkdownOptions {
  includeSummaryText?: boolean
}

/**
 * Build a markdown document representing the entire story tree hierarchy.
 */
export function buildTreeMarkdown(options: TreeMarkdownOptions = {}): string {
  const { includeSummaryText = false } = options
  const sections: string[] = []

  const nodes = nodeStore.nodes
  const tree = nodeStore.tree

  const countWords = (text: string | undefined | null): number => {
    if (!text) return 0
    const trimmed = text.trim()
    if (!trimmed) return 0
    return trimmed.split(/\s+/).length
  }

  const contentWordCountCache = new Map<string, number>()

  const getContentWordCount = (nodeId: string): number => {
    if (contentWordCountCache.has(nodeId)) {
      return contentWordCountCache.get(nodeId)!
    }
    const contents = getNodeMessageContents(nodeId)
    if (contents.length === 0) {
      const node = nodes[nodeId]
      if (node?.wordCount !== undefined) {
        contentWordCountCache.set(nodeId, node.wordCount)
        return node.wordCount
      }
      contentWordCountCache.set(nodeId, 0)
      return 0
    }
    const total = contents.reduce((acc, content) => acc + countWords(content), 0)
    contentWordCountCache.set(nodeId, total)
    return total
  }

  const traverse = (treeNodes: TreeNode[], depth: number) => {
    for (const treeNode of treeNodes) {
      const node = nodes[treeNode.id]
      if (!node) continue

      const headingLevel = Math.min(6, depth + 1)
      const headingPrefix = '#'.repeat(Math.max(1, headingLevel))
      sections.push(`${headingPrefix} ${node.title}`)

      const summaryWords = countWords(node.summary)
      const contentWords = getContentWordCount(node.id)

      const details: string[] = []
      details.push(`- Summary words: ${summaryWords}`)
      details.push(`- Content words: ${contentWords}`)

      sections.push(details.join('\n'))

      if (includeSummaryText && node.summary && node.summary.trim().length > 0) {
        sections.push(node.summary.trim())
      }

      if (treeNode.children.length > 0) {
        traverse(treeNode.children, depth + 1)
      }
    }
  }

  traverse(tree, 0)

  return sections.join('\n\n').trim()
}

export type PrecedingContextMode = 'summary' | 'full'

export interface PrecedingContextOptions {
  includeCurrentNode?: boolean
  mode?: PrecedingContextMode
  headingLevel?: number
  maxParagraphsFromContent?: number
  includeCharacterContext?: boolean
  includeStoryContextItems?: boolean
}

/**
 * Build a markdown snippet that captures the chapters that appear before the
 * provided node. This is useful for giving readers or models a quick recap
 * without copying the entire story.
 */
export function buildPrecedingContextMarkdown(nodeId: string, options: PrecedingContextOptions = {}): string {
  const targetNode = nodeStore.nodes[nodeId]
  if (!targetNode) {
    return ''
  }

  const {
    includeCurrentNode = false,
    mode = 'summary',
    headingLevel = 2,
    maxParagraphsFromContent = 2,
    includeCharacterContext = true,
    includeStoryContextItems = true,
  } = options

  const precedingChapters = nodeStore.getPrecedingChapters(nodeId)
  let nodesToExport = [...precedingChapters]

  if (includeCurrentNode && targetNode.type === 'chapter') {
    nodesToExport.push(targetNode)
  }

  const { activeNodeIds } = calculateActivePath(
    messagesStore.messages,
    nodeStore.nodesArray,
    currentStoryStore.branchChoices,
  )

  if (activeNodeIds.size > 0) {
    nodesToExport = nodesToExport.filter((node) => activeNodeIds.has(node.id))
  }

  if (nodesToExport.length === 0) {
    return ''
  }

  const headingPrefix = '#'.repeat(Math.min(Math.max(1, headingLevel), 6))
  const sections: string[] = []

  const characters = charactersStore.characters
  const contextItems = contextItemsStore.contextItems

  const rosterSections: string[] = []

  if (includeCharacterContext && characters.length > 0) {
    const characterLines = characters.map((char) => {
      const displayName = getCharacterDisplayName(char)
      const name = `${displayName}${char.isMainCharacter ? ' (protagonist)' : ''}`
      return char.description ? `- ${name}: ${char.description}` : `- ${name}`
    })

    if (characterLines.length > 0) {
      rosterSections.push([`${headingPrefix} Characters`, characterLines.join('\n')].join('\n\n'))
    }
  }

  if (includeStoryContextItems && contextItems.length > 0) {
    const contextLines = contextItems.map((item) => {
      const tag = item.isGlobal ? ' (global)' : ''
      return item.description ? `- ${item.name}${tag}: ${item.description}` : `- ${item.name}${tag}`
    })

    if (contextLines.length > 0) {
      rosterSections.push([`${headingPrefix} Context Items`, contextLines.join('\n')].join('\n\n'))
    }
  }

  if (rosterSections.length > 0) {
    sections.push(rosterSections.join('\n\n'))
  }

  for (let i = 0; i < nodesToExport.length; i++) {
    const chapter = nodesToExport[i]
    if (chapter.type !== 'chapter') continue

    let sectionBody = ''
    const summary = chapter.summary?.trim()

    if (mode === 'summary') {
      if (summary) {
        sectionBody = summary
      } else {
        const messageContents = getNodeMessageContents(chapter.id)
        if (messageContents.length > 0) {
          const joined = messageContents.join('\n\n').trim()
          if (joined) {
            const paragraphs = joined
              .split(/\n{2,}/)
              .map((p) => p.trim())
              .filter((p) => p.length > 0)
              .slice(0, Math.max(1, maxParagraphsFromContent))
            sectionBody = paragraphs.join('\n\n')
          }
        }
      }
    } else {
      const messageContents = getNodeMessageContents(chapter.id)
      if (messageContents.length > 0) {
        sectionBody = messageContents.join('\n\n').trim()
      } else if (summary) {
        sectionBody = summary
      }
    }

    if (!sectionBody) {
      continue
    }

    sections.push(`${headingPrefix} ${chapter.title}\n\n${sectionBody}`)
  }

  return sections.join('\n\n')
}
