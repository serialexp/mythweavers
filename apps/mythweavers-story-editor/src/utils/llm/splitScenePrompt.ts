export interface AggregatedMessageContent {
  messageId: string
  messageNumber: number // 1-indexed for prompt
  content: string
  order: number
  wordCount: number
  paragraphs: string[] // Split by \n\n for mid-message splits
}

export interface NodeContext {
  nodeId: string
  title: string
  parentId: string | null
  type: string
}

export interface MessageAssignment {
  mn: number | string // messageNumber (1-indexed) or range "1-5"
  sb: 'full' | 'splitBefore' | 'splitAfter' // splitBehavior
  p?: number // splitAtParagraph, 0-indexed (only for splits, not ranges)
}

export interface ProposedScene {
  title: string
  messageAssignments: MessageAssignment[]
}

/**
 * Parse a message number or range into an array of message numbers
 * "5" -> [5], 5 -> [5], "3-7" -> [3,4,5,6,7]
 */
export function parseMessageRange(mn: number | string): number[] {
  if (typeof mn === 'number') {
    return [mn]
  }

  const rangeMatch = mn.match(/^(\d+)-(\d+)$/)
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10)
    const end = parseInt(rangeMatch[2], 10)
    const result: number[] = []
    for (let i = start; i <= end; i++) {
      result.push(i)
    }
    return result
  }

  // Single number as string
  const num = parseInt(mn, 10)
  if (!isNaN(num)) {
    return [num]
  }

  return []
}

export interface ProposedChapter {
  type: 'chapter'
  title: string
  scenes: ProposedScene[]
}

export interface ProposedStructure {
  structure: ProposedChapter[]
}

export function createSplitScenePrompt(
  aggregatedContent: AggregatedMessageContent[],
  nodeContext: NodeContext,
): string {
  const totalWords = aggregatedContent.reduce((sum, m) => sum + m.wordCount, 0)

  const contentSection = aggregatedContent
    .map(
      (msg) =>
        `<message id="${msg.messageId}" number="${msg.messageNumber}" words="${msg.wordCount}">
${msg.content}
</message>`,
    )
    .join('\n\n')

  return `You are a story structure assistant analyzing content that needs to be split into a better chapter/scene structure.

<scene_info>
  <title>${nodeContext.title}</title>
  <message_count>${aggregatedContent.length}</message_count>
  <total_words>${totalWords}</total_words>
</scene_info>

<content>
${contentSection}
</content>

<instructions>
Your task is to analyze this content and propose a logical split into chapters and scenes.

ANALYSIS GUIDELINES:
1. Look for natural break points (setting changes, time jumps, POV shifts, narrative beats)
2. Each scene should be a cohesive unit (single setting, continuous time, focused action)
3. Chapters can contain multiple scenes but should represent major story divisions
4. Minimum scene length: ~500 words (unless natural break point requires shorter)
5. If a message needs to be split mid-content, identify the exact paragraph boundary
6. Preserve chronological order - messages should flow naturally across scenes

OUTPUT FORMAT (JSON):
{"structure":[{"type":"chapter","title":"Chapter title","scenes":[{"title":"Scene title","messageAssignments":[{"mn":"1-5","sb":"full"},{"mn":6,"sb":"splitAfter","p":3}]}]}]}

Field abbreviations:
- mn: message number (1-indexed) or range "1-5" for consecutive messages with same sb
- sb: split behavior - "full" (entire message), "splitAfter" (up to paragraph p), "splitBefore" (from paragraph p onward)
- p: paragraph index (0-indexed), required for splitAfter/splitBefore

MESSAGE ASSIGNMENT RULES:
Each message must be assigned in exactly ONE of these ways:
1. As "full" - the entire message goes to one scene (can use ranges like "1-5")
2. As a SPLIT PAIR - the message appears TWICE:
   - First half: {"mn":X,"sb":"splitAfter","p":N} in scene A (paragraphs 0 to N)
   - Second half: {"mn":X,"sb":"splitBefore","p":N+1} in the NEXT scene B (paragraphs N+1 onward)

A message CANNOT be both "full" AND split. Choose one or the other.

CRITICAL RULES:
- Output ONLY valid JSON, no markdown, no explanations
- Use ranges like "1-5" for consecutive messages with sb:"full" to reduce output size
- splitAfter/splitBefore cannot use ranges (must specify individual message number)
- Every message assigned exactly once (either as "full" OR as a split pair, never both)
- Order must be preserved - messages flow naturally across scenes
- Minimum 1 scene per chapter, at least one chapter
</instructions>`
}
