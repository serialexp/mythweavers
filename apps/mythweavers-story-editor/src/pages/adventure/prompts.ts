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

// --- Steering roll ---

export type SteeringBucket = 'well' | 'steady' | 'worse' | 'hell'

// Weights: 15% well / 50% steady / 25% worse / 10% hell.
// Biased toward "steady" so the world is mostly neutral, extremes are memorable.
const STEERING_WEIGHTS: ReadonlyArray<readonly [SteeringBucket, number]> = [
  ['well', 0.15],
  ['steady', 0.50],
  ['worse', 0.25],
  ['hell', 0.10],
]

/** Roll a hidden steering bucket for the next agent turn. */
export function rollSteering(): SteeringBucket {
  const r = Math.random()
  let acc = 0
  for (const [bucket, weight] of STEERING_WEIGHTS) {
    acc += weight
    if (r < acc) return bucket
  }
  return 'steady'
}

/**
 * Prose guidance for the narrative call, given a steering bucket.
 * Inlined into the narrative system message. Hidden from the player.
 *
 * IMPORTANT: Steering describes how WELL the protagonist EXECUTED their own
 * action this turn — nothing more. It is purely about the quality of the
 * protagonist's own performance: their poise, their timing, their wording,
 * their craft, their luck with the dice of their own attempt.
 *
 * Steering does NOT describe:
 *   - What NPCs decide to do (they always act in character)
 *   - Whether the world turns for or against the protagonist (it doesn't)
 *   - Whether convenient or inconvenient events occur (they don't)
 *   - Whether bystanders are friendly or hostile (independent of steering)
 *
 * NPCs respond to the executed action HOWEVER their established personality
 * would respond — a friendly bartender who hears a botched persuasion remains
 * a friendly bartender (just unconvinced); a hostile guard who hears a
 * smooth-talking lie remains a hostile guard (just thrown off-balance for a
 * moment). Their reaction is shaped by HOW the action was executed, never by
 * the steering directly.
 */
export function steeringGuidance(b: SteeringBucket): string {
  switch (b) {
    case 'well':
      return `STEERING (hidden from player): The protagonist executes their action GRACEFULLY. Whatever they were trying to do, they pull it off with more poise, precision, eloquence, or luck than they had any right to expect. A persuasion attempt finds exactly the right words. A leap lands cleanly. A lie comes out smooth and unhesitating. A fight move connects with form. Their craft, this once, is at its peak.

This is purely about the QUALITY OF THE PROTAGONIST'S EXECUTION. It is NOT about:
- The world conveniently bending in the protagonist's favor
- NPCs being unusually agreeable, cooperative, or revealing more than usual
- Helpful coincidences, lucky finds, or new useful information appearing
- Bystanders or opponents fumbling or hesitating

NPCs respond to the well-executed action exactly as their established personality dictates. A skeptical merchant hearing a brilliantly-worded pitch is still a skeptical merchant — but now they are visibly considering it instead of dismissing it. A trained guard parrying a perfectly-timed strike is still a trained guard — but now they are momentarily on the back foot. The protagonist's excellence narrows the NPC's options; it does not change who the NPC is.

If the player's action was vague, pick the most natural concrete attempt and let THAT be executed gracefully.`
    case 'steady':
      return `STEERING (hidden from player): The protagonist executes their action competently and honestly — neither lucky nor unlucky. Their performance is in their normal range. Resolve the action at face value. NPCs respond exactly as their established personalities would respond to a workmanlike attempt at this thing.`
    case 'worse':
      return `STEERING (hidden from player): The protagonist executes their action CLUMSILY. Whatever they were trying to do, their performance is awkward, halting, or partial. A persuasion attempt comes out stilted, missing the mark or hitting only part of it. A leap clears the gap but lands badly. A lie has a tell — a stutter, a glance, a detail that doesn't quite track. A fight move telegraphs. They get most of it, or some of it, but the craft is visibly off.

This is purely about the QUALITY OF THE PROTAGONIST'S EXECUTION. It is NOT about:
- The world turning against them
- NPCs being newly suspicious, hostile, or pressing agendas
- Inconvenient coincidences, bad luck with the environment, or surprise complications from outside
- Bystanders deciding to interfere

NPCs respond to the clumsy execution exactly as their established personality dictates. A friendly bartender hearing a fumbled question is still a friendly bartender — but now they're confused, asking the protagonist to repeat themselves, or politely brushing past the awkwardness. A wary captain hearing a stilted bluff is still a wary captain — but now they're notably less convinced than they otherwise would have been. The protagonist's stumble narrows their own options; it does not change who the NPC is.

The friction comes from the protagonist, not the world. No cliffhanger unless the scene already earned it.`
    case 'hell':
      return `STEERING (hidden from player): The protagonist BUNGLES their action. Whatever they were trying to do, their execution backfires on its own terms. A persuasion attempt comes out so wrongly-pitched it actively offends, embarrasses, or gives the game away. A leap falls short or trips on the takeoff. A lie contradicts itself mid-sentence or names a detail that's plainly wrong. A fight move overcommits and leaves them open. They make a fool of themselves, or a mess of the attempt, on their own merits.

This is purely about the QUALITY OF THE PROTAGONIST'S EXECUTION. It is NOT about:
- The world turning against them
- NPCs becoming newly hostile, suddenly attacking, betraying, or revealing hidden agendas
- The environment turning treacherous (the floor giving way, a storm hitting, a patrol coincidentally arriving)
- Coincidental events outside the protagonist's control

NPCs respond to the bungled execution exactly as their established personality dictates. A kindly priest hearing a deeply offensive accidental insult is still a kindly priest — but now they are hurt, withdrawn, or coolly redirecting the conversation. A hot-tempered guard hearing the same insult is still a hot-tempered guard — and may well respond in kind. The disaster IS the protagonist's bad performance; the NPC's reaction follows naturally from THEIR character meeting THAT performance.

The disaster comes from the protagonist, not the world. Stay inside the world's logic. NPC reactions must remain in character: a cautious NPC does not suddenly charge in, a friendly NPC does not suddenly betray, regardless of how badly the protagonist bungled.`
  }
}

// --- Prompt constants ---

export const SETTING_GEN_PROMPT = `You are a world-builder creating a setting for an interactive adventure. Given the following parameters, craft a vivid, specific setting description in 2-4 sentences. Describe the world and the immediate situation — do NOT describe or mention the protagonist. Focus on atmosphere, sensory details, and an interesting situation that invites exploration.

The "Location" parameter describes the STARTING LOCATION where the adventure begins, not a constraint on the entire world. A cosmic-scale adventure can absolutely start in a village — the village just happens to be where the protagonist is when things kick off.

Be creative and specific — don't just restate the parameters. Invent names, places, and details that make the setting feel alive.

Respond with ONLY the setting description, no other text.`

// Shared system prompt — identical first message for all calls enables provider-side caching
export const BASE_SYSTEM_PROMPT = `You are a collaborative storyteller running an interactive adventure. You create vivid, engaging fiction that responds to the player's choices. The world is alive — NPCs have their own personalities and motivations — but the story follows the player, not its own independent agenda.

The story is told in second person ("you"), present tense. The player controls only the protagonist. You control all NPCs, the environment, and world events.`

export const CORE_DIRECTIVE = `The player's input describes their INTENT, not exact words or actions. Interpret it as the general direction or tone they want to take. Only treat text in "quotes" as literal dialogue or exact phrasing. Everything else is shorthand for what the protagonist is trying to do — translate it into natural, in-character behavior.

The player's action is the starting point of each turn. Resolve it first and honestly, then let the world react to it in the same narrative — do not wait for another turn to show consequences.`

/**
 * Role-specific instruction for pass 1 (resolution).
 *
 * Narrates the direct consequences of the player's action. NPCs react
 * reactively but do NOT pursue their own agenda here — that's pass 2's job.
 * Ends in a beat where the world waits, so the player can optionally stop
 * the scene there (when auto-advance is off).
 */
export const RESOLUTION_INSTRUCTION = `YOUR ROLE THIS TURN: Resolve the player's action.

Write ONLY the story narrative — no metadata, no headings, no XML tags.

SCOPE OF THIS TURN:
- Narrate the immediate, direct consequences of what the protagonist just did. That's it.
- NPCs present in the scene may REACT to the action (flinch, reply, look up) but do NOT pursue their own plans or agendas — that's a later beat, not this one.
- The environment responds only insofar as it was touched by the action (the door the protagonist pushed, the glass they knocked over).
- End the turn on a beat where the world WAITS — a reply half-finished, a held breath, a pause — so the scene can either be moved forward deliberately or left for the next player input.

RULES:
- Show, don't tell. Vivid sensory details, dialogue, action.
- Player input is intent, not literal text. Translate it into natural in-character actions and dialogue. Only text in "quotes" should be used verbatim.
- 2-4 paragraphs.
- Do NOT end with an open prompt for the next action — the scene ends mid-beat, waiting.
- Only include world events the protagonist could plausibly observe. No unexplained knowledge of distant events.
- Everything must be physically plausible within the established world.
- NPCs must react consistently with their established personalities and current motivations. A cautious NPC does not suddenly charge in; a friendly one does not suddenly turn hostile without a clear in-world cause. If an NPC's personality has not yet been established, make a reasonable choice and let that become their personality going forward.
- The steering guidance below describes ONLY the QUALITY of the protagonist's own execution this turn — how gracefully or clumsily they pulled off their attempt. It does NOT describe the world's mood toward the protagonist, NPC dispositions, or whether convenient/inconvenient events occur. The world is what it is; only the protagonist's craft varies.`

/**
 * Role-specific instruction for pass 2 (world step).
 *
 * Fires after the resolution turn is finalized. The shared history ends with
 * the freshly-written resolution narrative as an assistant message. Now NPCs
 * and the environment move on their own agenda and the scene is set up for
 * the next player input.
 */
export const WORLD_STEP_INSTRUCTION = `YOUR ROLE THIS TURN: Let the world move.

The player's most recent action has already been resolved (see the preceding narrative). The scene is currently on a held beat. Now NPCs and the environment move on their own agenda.

Write ONLY the story narrative — no metadata, no headings, no XML tags.

SCOPE OF THIS TURN:
- NPCs present in the scene act in character (drawing on their established personalities from the World Bible and prior turns). They pursue their own goals, not just react to the protagonist.
- The environment shifts where it would naturally — a guard turns a corner, the tide comes in, a door opens elsewhere.
- Continue directly from where the resolution narrative left off. Do not recap or restate events that were just narrated.
- End with an open prompt for the protagonist's next action. No numbered options.

RULES:
- Show, don't tell. Vivid sensory details, dialogue, action.
- 2-4 paragraphs.
- Only include world events the protagonist could plausibly observe. No unexplained knowledge of distant events.
- Everything must be physically plausible within the established world.
- NPCs must act consistently with their established personalities, goals, and current motivations. A cautious NPC does not suddenly charge in; a greedy one does not suddenly share; a friendly one does not suddenly turn hostile without a clear in-world cause. If an NPC's personality has not been established, make a reasonable choice and let that become their personality going forward.
- The world is neither for nor against the protagonist this turn. NPCs and the environment behave the way they would have anyway, given their established nature and what just happened in the resolution. Do NOT manufacture coincidences, surprise complications, lucky breaks, or hostile turns of fate to make the world feel dramatic — let the established characters and situation drive what happens next.`

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
 * Build the shared conversation history prefix — identical for all calls
 * that need the story-so-far, to maximise provider-side caching.
 *
 * Older turns beyond VERBATIM_TURN_COUNT are replaced by compaction summaries
 * when available, dramatically reducing context size for long adventures.
 *
 * @param settingDescription - The adventure's world/setting prompt. Included in
 *   the opening turn so downstream consumers see it.
 */
export function buildSharedHistory(
  turns: AdventureTurn[],
  compactions?: Record<string, AdventureCompaction>,
  settingDescription?: string,
  worldBible?: string,
): LLMMessage[] {
  const messages: LLMMessage[] = []

  // Shared system prompt — cache breakpoint: static across all calls and turns
  // If there's a world bible, combine it with the base prompt under the same
  // cache breakpoint so the entire static prefix is cached together.
  const worldBibleTrimmed = worldBible?.trim()
  messages.push({
    role: 'system',
    content: worldBibleTrimmed
      ? `${BASE_SYSTEM_PROMPT}\n\n[WORLD BIBLE — persistent reference for the world, characters, and lore]\n${worldBibleTrimmed}`
      : BASE_SYSTEM_PROMPT,
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
    messages.push({ role: 'user', content: turn.playerAction })
  } else if (i === 0) {
    // Include the setting description in the opening turn so all consumers
    // see the world context.
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

/**
 * Build messages for pass 1 — the resolution narrative.
 *
 * Same shape as the old single-call builder, just uses
 * `RESOLUTION_INSTRUCTION` instead of the combined one. Also handles the
 * opening turn (no player action yet) — treated as a resolution turn.
 */
export function buildResolutionMessages(
  turns: AdventureTurn[],
  settingDescription: string,
  playerAction: string | null,
  steering: SteeringBucket | undefined,
  turnDirective?: string,
  compactions?: Record<string, AdventureCompaction>,
  worldBible?: string,
): LLMMessage[] {
  const messages = buildSharedHistory(turns, compactions, settingDescription, worldBible)

  const isOpeningTurn = turns.length === 0 && playerAction === null

  // Role instruction + core directive + steering guidance (if any) in one
  // system message that lives AFTER the cacheable history — the steering
  // text changes every turn, so it must not be inside the cached prefix.
  const steeringBlock = steering ? `\n\n${steeringGuidance(steering)}` : ''
  messages.push({
    role: 'system',
    content: `${RESOLUTION_INSTRUCTION}\n\n${CORE_DIRECTIVE}${steeringBlock}`,
  })

  // Author directive first, so the player action remains the message the
  // model is actually replying to.
  appendDirective(messages, turnDirective)

  // Final user message
  if (playerAction !== null) {
    messages.push({ role: 'user', content: playerAction })
  } else if (isOpeningTurn) {
    messages.push({
      role: 'user',
      content: `Begin the adventure. Here is the setting — use it as a springboard, expand on it with your own details, and establish the protagonist in the world.

The opening should introduce the protagonist through action and detail — show what they look like, how they carry themselves, and hint at their personality through their behavior or inner thoughts. Don't state traits outright; reveal them through the scene.

${settingDescription}`,
    })
  }

  return messages
}

/**
 * Build messages for pass 2 — the world step.
 *
 * The shared history already ends with the resolution turn's narrative as
 * the last assistant message. We add a role-specific system instruction and
 * a terse user nudge to kick off the world reaction.
 *
 * Note: Steering is intentionally NOT applied to the world step. Steering
 * scopes only to the QUALITY of the protagonist's own action; the world
 * itself is neutral and reacts in character to whatever the resolution
 * narrative just established. Pass 2 sees the resolution narrative as
 * context and responds to it, no extra fortune/friction overlay required.
 */
export function buildWorldStepMessages(
  turns: AdventureTurn[],
  settingDescription: string,
  turnDirective?: string,
  compactions?: Record<string, AdventureCompaction>,
  worldBible?: string,
): LLMMessage[] {
  const messages = buildSharedHistory(turns, compactions, settingDescription, worldBible)

  messages.push({
    role: 'system',
    content: WORLD_STEP_INSTRUCTION,
  })

  // Author directive first, so the world-step nudge remains the message the
  // model is actually replying to.
  appendDirective(messages, turnDirective)

  // Terse user nudge — keeps the assistant/user alternation legal and
  // signals the phase change explicitly to the model.
  messages.push({
    role: 'user',
    content: 'Now let the world respond. NPCs act in character; the environment shifts only where it would naturally.',
  })

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
  steering: SteeringBucket | undefined,
  kind: 'resolution' | 'world-step',
  turnDirective?: string,
  compactions?: Record<string, AdventureCompaction>,
  worldBible?: string,
): LLMMessage[] {
  const messages = buildSharedHistory(turns, compactions, settingDescription, worldBible)

  // Steering only applies to resolution passes — it describes the quality
  // of the protagonist's execution, which world-step passes don't generate.
  const steeringBlock =
    kind === 'resolution' && steering ? `\n\n${steeringGuidance(steering)}` : ''
  const roleInstruction = kind === 'world-step' ? WORLD_STEP_INSTRUCTION : RESOLUTION_INSTRUCTION
  messages.push({
    role: 'system',
    content: `${roleInstruction}\n\n${CORE_DIRECTIVE}${steeringBlock}`,
  })

  const isOpeningTurn = turns.length === 0 && playerAction === null

  // Author directive first, so the player action remains the message the
  // model originally responded to (matches the live build order).
  appendDirective(messages, turnDirective)

  if (playerAction !== null) {
    messages.push({ role: 'user', content: playerAction })
  } else if (isOpeningTurn) {
    messages.push({
      role: 'user',
      content: `Begin the adventure. Here is the setting — use it as a springboard, expand on it with your own details, and establish the protagonist in the world.

The opening should introduce the protagonist through action and detail — show what they look like, how they carry themselves, and hint at their personality through their behavior or inner thoughts. Don't state traits outright; reveal them through the scene.

${settingDescription}`,
    })
  }

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

// --- Parse helpers ---

export function cleanNarrative(raw: string): string {
  // Strip any XML tags the model might still produce out of habit
  return raw
    .replace(/<\/?narrative>/g, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim()
}
