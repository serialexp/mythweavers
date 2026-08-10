/**
 * Text renderings of service results for MCP tool output.
 *
 * Tool results are read by a model, not parsed by a program, so these favour
 * compactness and scannability over structure. The one hard requirement is
 * that every addressable thing carries its id inline in a consistent
 * `[kind:id]` form — that is what lets a caller read a scene and then edit a
 * specific paragraph without a second lookup.
 */

import type { StoryContent } from '../services/story/content.js'
import type { FlatOutlineNode, StoryOutline } from '../services/story/outline.js'
import type { SearchResult } from '../services/story/search.js'

export function formatOutline(outline: StoryOutline, nodes: FlatOutlineNode[]): string {
  const header = `${outline.storyName} [story:${outline.storyId}] · ${outline.totalWords.toLocaleString()} words · ${describeCounts(outline)}${outline.root.kind === 'story' ? '' : `\nSubtree of ${outline.root.kind} "${outline.root.name}"`}`

  if (nodes.length === 0) {
    return `${header}\n\n(no ${outline.depth}s yet)`
  }

  const lines = nodes.map((node) => {
    const indent = '  '.repeat(node.depth)
    const facts: string[] = []
    if (node.status) facts.push(node.status)
    if (node.wordCount !== undefined && node.wordCount > 0) facts.push(`${node.wordCount.toLocaleString()}w`)
    if (node.perspective) {
      facts.push(
        node.viewpointCharacterId ? `POV ${node.viewpointCharacterId} (${node.perspective})` : node.perspective,
      )
    }
    if (node.includeInFull === 0) facts.push('excluded from context')
    if (node.includeInFull === 1) facts.push('summary only')
    if (node.publishedAt) facts.push(`published ${node.publishedAt.slice(0, 10)}`)

    const suffix = facts.length ? ` — ${facts.join(', ')}` : ''
    const summary = node.sentenceSummary || node.summary
    const summaryLine = summary ? `\n${indent}    ${truncate(summary, 160)}` : ''

    return `${indent}[${node.kind}:${node.id}] ${node.name || '(untitled)'}${suffix}${summaryLine}`
  })

  return `${header}\n\n${lines.join('\n')}`
}

function describeCounts(outline: StoryOutline): string {
  return (['book', 'arc', 'chapter', 'scene'] as const)
    .filter((kind) => outline.counts[kind] > 0)
    .map((kind) => `${outline.counts[kind]} ${kind}${outline.counts[kind] === 1 ? '' : 's'}`)
    .join(', ')
}

export function formatContent(content: StoryContent): string {
  const parts: string[] = [
    `${content.root.name} [${content.root.kind}:${content.root.id}] — ${content.words.toLocaleString()} words`,
  ]

  for (const chapter of content.chapters) {
    // Don't repeat the chapter heading when the chapter *is* the root.
    if (!(content.root.kind === 'chapter' && content.root.id === chapter.id)) {
      parts.push(`\n# ${chapter.name} [chapter:${chapter.id}]`)
    }

    for (const scene of chapter.scenes) {
      const facts: string[] = []
      if (scene.viewpointCharacterName) {
        facts.push(`POV ${scene.viewpointCharacterName}${scene.perspective ? ` (${scene.perspective})` : ''}`)
      } else if (scene.perspective) {
        facts.push(scene.perspective)
      }
      if (scene.status) facts.push(scene.status)
      if (scene.goal) facts.push(`goal: ${scene.goal}`)

      parts.push(`\n## ${scene.name || '(untitled scene)'} [scene:${scene.id}]`)
      if (facts.length) parts.push(facts.join(' · '))
      parts.push('')

      if (scene.messages.length === 0) {
        parts.push('(empty)')
        continue
      }

      for (const message of scene.messages) {
        // Structural messages change how the scene reads, so they're called
        // out; ordinary prose messages are just generation units and would
        // only add noise.
        if (message.type) {
          parts.push(`«${message.type} message [message:${message.id}]»`)
        }
        for (const paragraph of message.paragraphs) {
          parts.push(`[p:${paragraph.id}] ${paragraph.body}`)
        }
      }
    }
  }

  return parts.join('\n')
}

export function formatSearch(result: SearchResult): string {
  if (result.hits.length === 0) {
    return `No matches for "${result.query}" in ${result.scope === 'all' ? 'this story' : result.scope}.`
  }

  const header = `${result.hits.length} match${result.hits.length === 1 ? '' : 'es'} for "${result.query}"${result.truncated ? ' (truncated — narrow the query or raise limit)' : ''}`

  const lines = result.hits.map((hit) => {
    switch (hit.kind) {
      case 'prose':
        return (
          `prose [p:${hit.paragraphId}] — ${hit.chapterName} › ${hit.sceneName} [scene:${hit.sceneId}]\n` +
          `  ${hit.snippet}`
        )
      case 'character':
        return `character [character:${hit.id}] ${hit.name} (${hit.field})\n  ${hit.snippet}`
      case 'contextItem':
        return `${hit.type} [contextItem:${hit.id}] ${hit.name} (${hit.field})\n  ${hit.snippet}`
      case 'summary':
        return `${hit.nodeKind} summary [${hit.nodeKind}:${hit.id}] ${hit.name} (${hit.field})\n  ${hit.snippet}`
    }
  })

  return `${header}\n\n${lines.join('\n')}`
}

export function formatStoryList(
  stories: Array<{ id: string; name: string; summary: string | null; status: string; updatedAt: string }>,
): string {
  if (stories.length === 0) {
    return 'You have no stories yet.'
  }
  return stories
    .map(
      (story) =>
        `[story:${story.id}] ${story.name} — ${story.status.toLowerCase()}, updated ${story.updatedAt.slice(0, 10)}${story.summary ? `\n  ${truncate(story.summary, 160)}` : ''}`,
    )
    .join('\n')
}

export function formatEntities(entities: {
  characters: Array<Record<string, unknown>>
  contextItems: Array<Record<string, unknown>>
}): string {
  const parts: string[] = []

  if (entities.characters.length > 0) {
    parts.push('Characters:')
    for (const character of entities.characters) {
      const name = [character.firstName, character.lastName].filter(Boolean).join(' ')
      const facts = [
        character.isMainCharacter ? 'main' : null,
        character.age ? `age ${character.age}` : null,
        character.gender ?? null,
      ].filter(Boolean)
      parts.push(
        `  [character:${character.id}] ${name}${facts.length ? ` — ${facts.join(', ')}` : ''}${character.description ? `\n    ${truncate(String(character.description), 200)}` : ''}`,
      )
    }
  }

  if (entities.contextItems.length > 0) {
    if (parts.length) parts.push('')
    parts.push('Context items:')
    for (const item of entities.contextItems) {
      parts.push(
        `  [contextItem:${item.id}] ${item.name} (${item.type}${item.isGlobal ? ', global' : ''})${item.description ? `\n    ${truncate(String(item.description), 200)}` : ''}`,
      )
    }
  }

  return parts.length ? parts.join('\n') : 'No characters or context items yet.'
}

function truncate(value: string, length: number): string {
  const collapsed = value.replace(/\s+/g, ' ').trim()
  return collapsed.length > length ? `${collapsed.slice(0, length)}…` : collapsed
}
