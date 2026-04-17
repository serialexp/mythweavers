import type { LLMMessage } from '../../types/llm'
import type { AdventureTurn, AdventureCompaction } from '../../hooks/useAdventurePersistence'

// --- Setting generation knobs ---

export interface SettingKnob {
  id: string
  label: string
  options: string[]
}

export const SETTING_KNOBS: SettingKnob[] = [
  {
    id: 'era',
    label: 'Era',
    options: [
      'Antiquity', 'Medieval', 'Renaissance', 'Victorian', 'Modern',
      'Near Future', 'Far Future', 'Stone Age', 'Mythic',
    ],
  },
  {
    id: 'location',
    label: 'Start',
    options: [
      'City', 'Village', 'Wilderness', 'Underground', 'Coastal',
      'Space', 'Desert', 'Mountains', 'Island', 'Floating',
    ],
  },
  {
    id: 'tone',
    label: 'Tone',
    options: [
      'Dark', 'Whimsical', 'Gritty', 'Heroic', 'Horror',
      'Mystery', 'Comedic', 'Melancholic', 'Surreal',
    ],
  },
  {
    id: 'magictech',
    label: 'Power',
    options: [
      'No magic', 'Low magic', 'High magic', 'Steampunk',
      'Sci-fi tech', 'Post-apocalyptic', 'Biopunk', 'Divine',
    ],
  },
  {
    id: 'scale',
    label: 'Scale',
    options: ['Intimate', 'Local', 'Regional', 'Epic', 'Cosmic'],
  },
]

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// --- Prompt constants ---

export const SETTING_GEN_PROMPT = `You are a world-builder creating a setting for an interactive adventure. Given the following parameters, craft a vivid, specific setting description in 2-4 sentences. Describe the world and the immediate situation — do NOT describe or mention the protagonist. Focus on atmosphere, sensory details, and an interesting situation that invites exploration.

The "Location" parameter describes the STARTING LOCATION where the adventure begins, not a constraint on the entire world. A cosmic-scale adventure can absolutely start in a village — the village just happens to be where the protagonist is when things kick off.

Be creative and specific — don't just restate the parameters. Invent names, places, and details that make the setting feel alive.

Respond with ONLY the setting description, no other text.`

// Shared system prompt — identical first message for all calls enables provider-side caching
export const BASE_SYSTEM_PROMPT = `You are a collaborative storyteller running an interactive adventure. You create vivid, engaging fiction that responds to the player's choices while maintaining a living, breathing world that continues to evolve independently of the player.

The story is told in second person ("you"), present tense. The player controls only the protagonist. You control all NPCs, the environment, and world events.`

export const CORE_DIRECTIVE = `The player's input describes their INTENT, not exact words or actions. Interpret it as the general direction or tone they want to take. Only treat text in "quotes" as literal dialogue or exact phrasing. Everything else is shorthand for what the protagonist is trying to do — translate it into natural, in-character behavior.

The player's action is always the starting point of each turn — resolve it first and honestly. After that, the world continues: NPCs follow their own agendas, situations develop on their own timelines, and opportunities pass if not seized. World momentum that conflicts with or was pre-empted by the player's action simply doesn't happen this turn.`

// Role-specific instructions appended AFTER the shared conversation history
export const NARRATIVE_INSTRUCTION = `YOUR ROLE THIS TURN: Write the story narrative.

Write ONLY the story narrative — no metadata, no trajectory, no XML tags.

- Resolve the player's action FIRST. What they did happens. Then layer in world momentum only where it still makes sense — drop any momentum the player's action pre-empted or made irrelevant.
- Show, don't tell. Vivid sensory details, dialogue, action.
- Player input is intent, not literal text. Translate it into natural in-character actions and dialogue. Only text in "quotes" should be used verbatim.
- 3-6 paragraphs. Not every turn needs a cliffhanger.
- End with an open prompt for the protagonist's next action. No numbered options.
- Only include world events the protagonist could plausibly observe. No unexplained knowledge of distant events.
- Everything must be physically plausible. Ignore any momentum that isn't (e.g. NPC on foot catching a vehicle).`

export const TRAJECTORY_INSTRUCTION = `YOUR ROLE THIS TURN: Determine the world's momentum in 1-3 bullet points.

Each bullet: one NPC intention/action or environmental change, one sentence. These are fed to the narrative agent, which will decide what actually happens based on the player's next action.

RULES:
- Include CONDITIONS when an NPC action depends on the player's response. E.g. "If the player doesn't start digging, the scarred man strikes them with the wrench." / "The guard draws his weapon; if the player surrenders, he cuffs them instead of shooting."
- Unconditional events (environmental changes, NPC-to-NPC actions) need no condition.
- At least one bullet must be something the protagonist could plausibly notice or encounter.
- No dramatic framing — plain, factual statements.
- Only mention established NPCs and elements.
- BE SPECIFIC. Name concrete objects and actions. Say "a pistol" not "a small, dark object."
- Everything must be physically plausible. If an NPC lacks the means, position, or opportunity, it doesn't happen.

DEATH DETECTION:
Add [DEAD] at the end ONLY if the protagonist is explicitly dead in the narrative — heart stopped, killed, a corpse. Not injured, dying, unconscious, or in danger. If any doubt, do NOT add [DEAD].

Respond with bullet points, optionally [DEAD]. No other text.`

export const DIRECTOR_INSTRUCTION = `YOUR ROLE: Provide director notes — hidden behind-the-scenes intelligence the player never sees.

Match the story's established tone and scope. Everything must be physically plausible within the established world. Keep it broad — don't over-plan. The story will go wherever the player takes it.

Use EXACTLY these two sections (100-200 words total):

## PROTAGONIST
Consistency reference sheet: appearance, personality, skills, relationships, key facts. NOT a situation recap. Max 2 paragraphs.

## THE WEEK AHEAD
In the broadest possible terms, what does the next week look like for the protagonist? Not a plot outline — just the general shape of things: are they settling in somewhere, on the move, under pressure, drifting, recovering? One paragraph, kept vague and open-ended.

Respond with ONLY your director notes.`

export const NONSENSE_CHECK_INSTRUCTION = `YOUR ROLE: Check ONLY the text above for things that don't make sense.

IMPORTANT: You are reviewing a SINGLE turn of narrative — the text immediately above this message. Do NOT flag anything that isn't explicitly written in that text. If the text references events you haven't seen, that's fine — those happened in earlier turns. Only flag statements that are physically or logically impossible AS WRITTEN in the text above.

CRITICAL: Consider the story's world context (setting, magic system, technology level, etc.). If the world has magic, supernatural abilities, advanced tech, or other fictional elements, things enabled by those elements are NOT nonsensical. Only flag things that don't make sense even within the story's own rules.

Flag phrases, actions, or descriptions that sound dramatic but are logically absurd. Examples: "fingerprints in the gray matter" (fingerprints aren't taken from brains), "the bullet ricocheted off the water" (bullets don't ricochet off water), "she held her breath for ten minutes" (humans can't do that without supernatural ability).

This is NOT about story continuity or style. Only flag things where the author clearly didn't think through whether the statement makes physical/logical sense within the story's world.

Err on the side of FINE. When in doubt, it is not an issue.

RESPONSE FORMAT:
If fine: CONSISTENT
If not:
INCONSISTENT
1. [One sentence explaining what's nonsensical and why]
2. ...
Maximum 5 items.`

// --- Momentum resolution ---

export const MOMENTUM_RESOLUTION_INSTRUCTION = `You are resolving world momentum against a player action. Given the pending world momentum (bullet points describing what NPCs and the environment were about to do) and the player's action, determine which momentum items still apply, which are pre-empted or invalidated, and which need adjustment.

RULES:
- If the player's action directly prevents, interrupts, or makes a momentum item impossible, DROP it entirely.
- If the player's action changes the conditions of a momentum item (e.g. a conditional "if the player doesn't X" but the player DID X), RESOLVE the condition and rewrite accordingly.
- If a momentum item is completely unrelated to the player's action, KEEP it unchanged.
- If the player's action partially affects a momentum item, ADJUST it to reflect the new situation.

RESPONSE FORMAT:
Output ONLY the surviving/adjusted bullet points, one per line. If ALL momentum is invalidated, respond with exactly: NONE

Do not explain your reasoning. Do not add new momentum items. Do not add any other text.`

/**
 * Build messages for the momentum resolution call.
 * This is a lightweight call — no shared history, just the immediate context.
 */
export function buildMomentumResolutionMessages(
  lastNarrative: string,
  rawMomentum: string,
  playerAction: string,
): LLMMessage[] {
  return [
    {
      role: 'system',
      content: MOMENTUM_RESOLUTION_INSTRUCTION,
    },
    {
      role: 'user',
      content: `LAST NARRATIVE (context for what just happened):\n${lastNarrative}\n\nPENDING WORLD MOMENTUM:\n${rawMomentum}\n\nPLAYER'S ACTION:\n${playerAction}`,
    },
  ]
}

// --- Compaction ---

export const COMPACTION_CHUNK_SIZE = 10
export const VERBATIM_TURN_COUNT = 30

export const COMPACTION_SYSTEM_INSTRUCTION = `You are summarizing sections of an interactive adventure story. You produce concise, thorough narrative summaries in second person present tense.`

export const COMPACTION_INSTRUCTION = `Summarize ALL events in the preceding story section. This summary will replace the original turns in context, so be thorough.

CRITICAL FORMATTING RULES:
- DO NOT include ANY headers, titles, or labels
- START IMMEDIATELY with the first sentence of the narrative
- Write ONLY plain paragraph text

CONTENT RULES:
- Write in second person present tense ("you walk", "you see")
- Give equal attention to events at the start, middle, and end of the section
- Do not focus disproportionately on recent events

Include:
- All key plot events and story beats in chronological order
- Important decisions the protagonist made
- New characters introduced (with names)
- Locations visited
- Significant dialogue or revelations
- Changes in the situation or stakes

Write 2-4 paragraphs as a flowing narrative summary in present tense.`

export interface CompactionRange {
  start: number
  end: number
  key: string
}

/**
 * Calculate which turn ranges are eligible for compaction.
 * Turns beyond the last VERBATIM_TURN_COUNT are divided into chunks of COMPACTION_CHUNK_SIZE.
 * Only full chunks (exactly COMPACTION_CHUNK_SIZE turns) are returned.
 */
export function getCompactionRanges(turnCount: number): CompactionRange[] {
  const ranges: CompactionRange[] = []
  const compactableCount = Math.max(0, turnCount - VERBATIM_TURN_COUNT)
  for (let i = 0; i < compactableCount; i += COMPACTION_CHUNK_SIZE) {
    const end = Math.min(i + COMPACTION_CHUNK_SIZE - 1, compactableCount - 1)
    // Only create a range if we have a full chunk
    if (end - i >= COMPACTION_CHUNK_SIZE - 1) {
      ranges.push({ start: i, end, key: `${i}-${end}` })
    }
  }
  return ranges
}

/** Build the messages for a compaction LLM call. */
export function buildCompactionMessages(
  turns: AdventureTurn[],
  range: CompactionRange,
): LLMMessage[] {
  const rangeTurns = turns.slice(range.start, range.end + 1)

  const messages: LLMMessage[] = [
    { role: 'system', content: COMPACTION_SYSTEM_INSTRUCTION },
  ]

  for (const turn of rangeTurns) {
    if (turn.playerAction) {
      messages.push({ role: 'user', content: turn.playerAction })
    }
    messages.push({ role: 'assistant', content: turn.narrative })
  }

  messages.push({
    role: 'user',
    content: `${COMPACTION_INSTRUCTION}\n\nThe preceding section contains ${rangeTurns.length} turns (turns ${range.start + 1}–${range.end + 1}).`,
  })

  return messages
}

// --- Prompt construction helpers ---

function formatMomentumContext(trajectory: string, action: string): string {
  return `My action: ${action}\n\n[WORLD MOMENTUM — NPC intentions and environmental changes that were in motion BEFORE the player acted. Apply only what still makes sense AFTER resolving the player's action: ${trajectory}]`
}

/** Append the user directive as the final user message if present. */
function appendDirective(messages: LLMMessage[], directive?: string): void {
  const trimmed = directive?.trim()
  if (trimmed) {
    messages.push({
      role: 'user',
      content: `[AUTHOR DIRECTIVE — follow these instructions for this and all subsequent turns]\n${trimmed}`,
    })
  }
}

/**
 * Build the shared conversation history prefix — identical for all three
 * LLM calls (narrative, trajectory, director) to maximise provider-side caching.
 *
 * Older turns beyond VERBATIM_TURN_COUNT are replaced by compaction summaries
 * when available, dramatically reducing context size for long adventures.
 *
 * @param settingDescription - The adventure's world/setting prompt. Included in
 *   the opening turn so all consumers (director, trajectory, narrative) see it.
 */
export function buildSharedHistory(
  turns: AdventureTurn[],
  compactions?: Record<string, AdventureCompaction>,
  settingDescription?: string,
): LLMMessage[] {
  const messages: LLMMessage[] = []

  // Shared system prompt — cache breakpoint: static across all calls and turns
  messages.push({
    role: 'system',
    content: BASE_SYSTEM_PROMPT,
    cache_control: { type: 'ephemeral', ttl: '1h' },
  })

  const ranges = getCompactionRanges(turns.length)
  const recentStart = Math.max(0, turns.length - VERBATIM_TURN_COUNT)

  // Older turns: use compaction summaries where available, otherwise verbatim
  for (const range of ranges) {
    const comp = compactions?.[range.key]
    if (comp?.summary) {
      // Compacted: insert summary as a user/assistant pair
      messages.push({
        role: 'user',
        content: `[Previous events summary]: ${comp.summary}`,
      })
      messages.push({
        role: 'assistant',
        content: '[Acknowledged — continuing story]',
      })
    } else {
      // Not yet compacted: include original turns
      for (let i = range.start; i <= range.end; i++) {
        addTurnToMessages(messages, turns, i, false, settingDescription)
      }
    }
  }

  // Gap turns: between the last compaction range and the verbatim window
  // (partial chunk not yet eligible for compaction)
  const compactedEnd = ranges.length > 0 ? ranges[ranges.length - 1].end + 1 : 0
  for (let i = compactedEnd; i < recentStart; i++) {
    addTurnToMessages(messages, turns, i, false, settingDescription)
  }

  // Recent turns: always verbatim
  for (let i = recentStart; i < turns.length; i++) {
    const isLastTurn = i === turns.length - 1
    addTurnToMessages(messages, turns, i, isLastTurn, settingDescription)
  }

  return messages
}

/** Helper: append a single turn's messages to the array. */
function addTurnToMessages(
  messages: LLMMessage[],
  turns: AdventureTurn[],
  i: number,
  addCacheBreakpoint: boolean,
  settingDescription?: string,
): void {
  const turn = turns[i]

  if (turn.playerAction) {
    const prevTurn = i > 0 ? turns[i - 1] : null
    const userContent = prevTurn?.worldTrajectory
      ? formatMomentumContext(prevTurn.worldTrajectory, turn.playerAction)
      : turn.playerAction
    messages.push({ role: 'user', content: userContent })
  } else if (i === 0) {
    // Include the setting description in the opening turn so all consumers
    // (director, trajectory, narrative) see the world context.
    const openingContent = settingDescription
      ? `Begin the adventure.\n\n${settingDescription}`
      : 'Begin the adventure.'
    messages.push({
      role: 'user',
      content: openingContent,
    })
  }

  messages.push({
    role: 'assistant',
    content: turn.narrative,
    ...(addCacheBreakpoint
      ? { cache_control: { type: 'ephemeral' as const, ttl: '1h' as const } }
      : {}),
  })
}

export function buildNarrativeMessages(
  turns: AdventureTurn[],
  settingDescription: string,
  playerAction: string | null,
  turnDirective?: string,
  compactions?: Record<string, AdventureCompaction>,
  resolvedMomentum?: string | null,
): LLMMessage[] {
  const messages = buildSharedHistory(turns, compactions, settingDescription)

  const isOpeningTurn = turns.length === 0 && playerAction === null

  const protagonistInfo = getLatestProtagonistInfo(turns)
  const protagonistSection = protagonistInfo
    ? `<protagonist_reference>\n${protagonistInfo}\n</protagonist_reference>\n\n`
    : ''

  messages.push({
    role: 'system',
    content: `${protagonistSection}${NARRATIVE_INSTRUCTION}\n\n${CORE_DIRECTIVE}`,
  })

  // Final user message
  if (playerAction !== null) {
    // Use pre-resolved momentum when available (momentum resolution step ran),
    // otherwise fall back to the raw trajectory from the last turn.
    const momentum = resolvedMomentum !== undefined
      ? resolvedMomentum
      : (turns.length > 0 ? turns[turns.length - 1]?.worldTrajectory : null)
    const userContent = momentum
      ? formatMomentumContext(momentum, playerAction)
      : playerAction
    messages.push({ role: 'user', content: userContent })
  } else if (isOpeningTurn) {
    messages.push({
      role: 'user',
      content: `Begin the adventure. Here is the setting — use it as a springboard, expand on it with your own details, and establish the protagonist in the world.

The opening should introduce the protagonist through action and detail — show what they look like, how they carry themselves, and hint at their personality through their behavior or inner thoughts. Don't state traits outright; reveal them through the scene.

${settingDescription}`,
    })
  }

  appendDirective(messages, turnDirective)

  return messages
}

export function buildTrajectoryMessages(
  turns: AdventureTurn[],
  latestNarrative: string,
  playerAction: string | null,
  currentDirectorNotes?: string,
  options?: { rejectedTrajectory?: string; directive?: string; compactions?: Record<string, AdventureCompaction>; settingDescription?: string },
): LLMMessage[] {
  // Shared history + the just-completed turn's narrative
  const messages = buildSharedHistory(turns, options?.compactions, options?.settingDescription)

  // Append the current turn as if it already happened (so trajectory sees it)
  if (playerAction !== null) {
    const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null
    const userContent = lastTurn?.worldTrajectory
      ? formatMomentumContext(lastTurn.worldTrajectory, playerAction)
      : playerAction
    messages.push({ role: 'user', content: userContent })
  }
  messages.push({
    role: 'assistant',
    content: latestNarrative,
    cache_control: { type: 'ephemeral', ttl: '1h' },
  })

  // Use fresh director notes from this turn if available, fall back to previous turns
  const directorNotes = currentDirectorNotes
    ?? [...turns].reverse().find((t) => t.directorNotes)?.directorNotes

  const directorSection = directorNotes
    ? `\n\n<director_notes context="use these to inform the trajectory — what's REALLY happening behind the scenes">\n${directorNotes}\n</director_notes>`
    : ''

  // Show the last turn's trajectory so the model knows what already happened
  // and can advance or move on rather than repeating
  const lastTurnTrajectory = turns.length > 0
    ? turns[turns.length - 1]?.worldTrajectory
    : undefined

  const previousSection = lastTurnTrajectory
    ? `\n\nLAST TURN'S WORLD MOMENTUM (for reference — advance these, resolve them, or move on to new developments; do NOT repeat them):\n"${lastTurnTrajectory}"`
    : ''

  const rejectionSection = options?.rejectedTrajectory
    ? `\n\nYour PREVIOUS attempt at world momentum was rejected:\n"${options.rejectedTrajectory}"\n\nGenerate DIFFERENT momentum — focus on other NPCs, other events, or different aspects of the world. Do not repeat or rephrase the rejected output.`
    : ''

  messages.push({
    role: 'user',
    content: `${TRAJECTORY_INSTRUCTION}${directorSection}${previousSection}${rejectionSection}\n\nWhat happens next in the world if the player does nothing?`,
  })

  appendDirective(messages, options?.directive)

  return messages
}

export function buildDirectorMessages(
  turns: AdventureTurn[],
  currentTurn?: { playerAction: string | null; narrative: string },
  turnDirective?: string,
  compactions?: Record<string, AdventureCompaction>,
  settingDescription?: string,
): LLMMessage[] {
  const messages = buildSharedHistory(turns, compactions, settingDescription)

  // Append the current (not-yet-finalized) turn so the director sees it
  if (currentTurn) {
    if (currentTurn.playerAction !== null) {
      const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null
      const userContent = lastTurn?.worldTrajectory
        ? formatMomentumContext(lastTurn.worldTrajectory, currentTurn.playerAction)
        : currentTurn.playerAction
      messages.push({ role: 'user', content: userContent })
    }
    messages.push({ role: 'assistant', content: currentTurn.narrative })
  }

  // Always generate full notes from scratch — previous notes provided as context only
  const lastDirectorNotes = [...turns]
    .reverse()
    .find((t) => t.directorNotes)?.directorNotes

  if (lastDirectorNotes) {
    const sanitized = sanitizeDirectorNotes(lastDirectorNotes)
    messages.push({
      role: 'user',
      content: `${DIRECTOR_INSTRUCTION}\n\nHere are the previous turn's director notes for context — use them as a starting point, updating or rewriting sections as needed based on what happened this turn. Write complete, fresh notes (not a diff).\n\nPREVIOUS DIRECTOR NOTES:\n${sanitized}`,
    })
  } else {
    messages.push({
      role: 'user',
      content: `${DIRECTOR_INSTRUCTION}\n\nBased on the story so far, provide your initial director notes. Start with ## PROTAGONIST (describing the protagonist's appearance, traits, and established facts), then ## THE WEEK AHEAD. Use these exact headings.`,
    })
  }

  appendDirective(messages, turnDirective)

  return messages
}

export function buildNonsenseCheckMessages(
  latestNarrative: string,
  settingDescription?: string,
  directive?: string,
): LLMMessage[] {
  const messages: LLMMessage[] = []

  // Provide world context so the checker knows what's possible in this story
  const worldContext = [settingDescription, directive].filter(Boolean).join('\n\n')
  if (worldContext) {
    messages.push({
      role: 'system',
      content: `This is the world context for the story being checked. Use it to understand what is possible in this setting — magic, technology, supernatural abilities, etc. Only flag things that don't make sense even within these rules.\n\n${worldContext}`,
    })
  }

  messages.push({ role: 'assistant', content: latestNarrative })
  messages.push({ role: 'user', content: NONSENSE_CHECK_INSTRUCTION })

  return messages
}

export function buildRevisionMessages(
  turns: AdventureTurn[],
  settingDescription: string,
  playerAction: string | null,
  originalNarrative: string,
  inconsistencies: string,
  turnDirective?: string,
  compactions?: Record<string, AdventureCompaction>,
): LLMMessage[] {
  const messages = buildSharedHistory(turns, compactions, settingDescription)

  const revisionProtagonistInfo = getLatestProtagonistInfo(turns)
  const revisionProtagonistSection = revisionProtagonistInfo
    ? `<protagonist_reference>\n${revisionProtagonistInfo}\n</protagonist_reference>\n\n`
    : ''

  messages.push({
    role: 'system',
    content: `${revisionProtagonistSection}${NARRATIVE_INSTRUCTION}\n\n${CORE_DIRECTIVE}`,
  })

  const isOpeningTurn = turns.length === 0 && playerAction === null

  if (playerAction !== null) {
    const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null
    const userContent = lastTurn?.worldTrajectory
      ? formatMomentumContext(lastTurn.worldTrajectory, playerAction)
      : playerAction
    messages.push({ role: 'user', content: userContent })
  } else if (isOpeningTurn) {
    messages.push({
      role: 'user',
      content: `Begin the adventure. Here is the setting — use it as a springboard, expand on it with your own details, and establish the protagonist in the world.

The opening should introduce the protagonist through action and detail — show what they look like, how they carry themselves, and hint at their personality through their behavior or inner thoughts. Don't state traits outright; reveal them through the scene.

${settingDescription}`,
    })
  }

  appendDirective(messages, turnDirective)

  // Place the original narrative as an assistant message, then ask for revision
  messages.push({
    role: 'assistant',
    content: originalNarrative,
  })

  messages.push({
    role: 'user',
    content: `REVISION REQUIRED — the narrative above contains factual inconsistencies with the established story:

${inconsistencies}

Please rewrite the narrative, fixing ONLY the listed inconsistencies. Keep the same overall scene, pacing, and events — just correct the contradictions. Write the complete revised narrative.`,
  })

  return messages
}

// --- Director notes sanitisation ---

/**
 * Clean up corrupted director notes before they are used.
 *
 * Fixes two known corruption patterns:
 * 1. "| " pipe prefixes on lines (leaked from formatWithLineNumbers via bad diffs)
 * 2. Orphaned content before the first section header (## PROTAGONIST)
 */
export function sanitizeDirectorNotes(notes: string): string {
  // Strip pipe prefixes: "| some text" → "some text"
  let cleaned = notes.replace(/^\| /gm, '')

  // Remove orphaned content before the first ## heading
  const firstHeading = cleaned.indexOf('## ')
  if (firstHeading > 0) {
    cleaned = cleaned.substring(firstHeading)
  }

  // Collapse runs of 3+ blank lines into 2
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

  return cleaned.trim()
}

/** Extract the ## PROTAGONIST section from director notes. */
export function extractProtagonistInfo(directorNotes: string): string | undefined {
  const match = directorNotes.match(/##\s*PROTAGONIST\s*\n([\s\S]*?)(?=\n##\s|\n*$)/)
  return match?.[1]?.trim() || undefined
}

/**
 * Find the most recent protagonist info from director notes in the turn history.
 * Returns undefined if no director notes exist yet.
 */
export function getLatestProtagonistInfo(turns: AdventureTurn[]): string | undefined {
  for (let i = turns.length - 1; i >= 0; i--) {
    const notes = turns[i].directorNotes
    if (notes) {
      const info = extractProtagonistInfo(notes)
      if (info) return info
    }
  }
  return undefined
}

// --- Parse helpers ---

export function cleanNarrative(raw: string): string {
  // Strip any XML tags the model might still produce out of habit
  return raw
    .replace(/<\/?narrative>/g, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim()
}

export function parseTrajectory(raw: string): {
  trajectory: string
  dead: boolean
} {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  const dead = /\[DEAD\]/i.test(cleaned)
  const trajectory = cleaned.replace(/\[DEAD\]/gi, '').trim()
  return { trajectory, dead }
}
