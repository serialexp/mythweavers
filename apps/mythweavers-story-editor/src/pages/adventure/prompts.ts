import type { LLMMessage } from '../../types/llm'
import type { AdventureTurn } from '../../hooks/useAdventurePersistence'
import { formatWithLineNumbers } from '@mythweavers/shared'

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

export const CORE_DIRECTIVE = `The world has its own momentum — things are always happening independently of the player. NPCs have their own agendas, threats escalate on their own, and opportunities pass if not seized. Let previous world trajectories bleed into the narrative even when the player acts — the world doesn't pause just because the protagonist did something.`

// Role-specific instructions appended AFTER the shared conversation history
export const NARRATIVE_INSTRUCTION = `YOUR ROLE THIS TURN: Write the story narrative.

Write ONLY the story narrative — no metadata, no trajectory, no XML tags. Just the story.

WRITING GUIDELINES:
- Show, don't tell — use vivid sensory details, dialogue, and action
- Player input describes intent, not literal dialogue (unless in "quotes")
- Not every turn needs a cliffhanger — allow natural story rhythms
- Keep narrative sections to 3-6 paragraphs
- End with an open-ended prompt asking what the protagonist does next. Do NOT provide numbered options.

WORLD MOMENTUM:
- You may receive "world momentum" hints about things happening independently in the world (NPC actions, environmental changes).
- Weave relevant momentum into the narrative naturally — but only what the protagonist could plausibly observe or encounter from their current situation.
- The protagonist should never have unexplained knowledge of distant events.
</output>

PLAUSIBILITY:
- Everything that happens must be physically plausible. A person cannot outrun a vehicle. Doors don't unlock themselves. NPCs cannot teleport.
- Consider distances, speeds, physical barriers, and the laws of physics before writing any action.
- If the world momentum suggests something implausible (e.g. an NPC catching up to a speeding vehicle on foot), ignore that momentum point — it simply doesn't happen.`

export const TRAJECTORY_INSTRUCTION = `YOUR ROLE THIS TURN: Determine the world's momentum in 1-3 SHORT bullet points.

Describe what NPCs are doing and how the environment is shifting. NPCs are independent agents — they have their own plans, and they ACT on those plans. The player's action only disrupts an NPC's plans if it DIRECTLY interferes with them. Otherwise, NPCs continue doing what they were already doing.

RULES:
- Each bullet: one NPC action/intent or one environmental change. Max one sentence.
- NPCs FOLLOW THROUGH on established plans unless the player specifically prevented it this turn. A player doing something unrelated does NOT cancel NPC actions.
- Frame NPC actions as things that ARE happening or WILL happen, not vague possibilities. The only caveat is direct player interference.
- At least one bullet should describe something the protagonist could plausibly notice, encounter, or react to from their current situation. Give the player something to work with.
- NO references to the protagonist, "you", "the player", or how events affect them
- NO dramatic framing — just state what's happening, plainly
- Only mention NPCs and elements already established in the story

PLAUSIBILITY CHECK — before writing each bullet, ask yourself:
- Is this physically possible given the current situation? (A person cannot catch a vehicle going 70 km/h on foot.)
- Does the NPC have the means, position, and opportunity to do this right now?
- Would this actually happen, or is it just dramatic? Prefer boring-but-realistic over exciting-but-impossible.
- Did the player's action DIRECTLY interfere with this? If not, the NPC continues unimpeded.

GOOD examples:
- "The guards are changing shift at the east corridor."
- "Storm clouds are gathering — rain looks imminent."
- "Maren has finished the transmitter repair and is testing the signal."
- "The contractor is reloading and scanning the room for movement."

BAD examples:
- "The contractor shoots you twice in the chest" (references protagonist)
- "The guards discover your hiding spot" (references protagonist)
- "A strange energy builds, threatening to consume everything" (dramatic, vague)
- "The guards might continue their patrol" (too tentative — if the player didn't stop them, they ARE patrolling)

DEATH DETECTION:
Add [DEAD] on a separate line at the end ONLY if the protagonist is ALREADY DEAD in the narrative text — as in, the narrative explicitly states or unambiguously shows they have died. Their heart has stopped, they have been killed, they are a corpse.

Do NOT mark [DEAD] if:
- The protagonist is in danger but still alive
- Someone is about to kill them
- They are injured, unconscious, captured, or dying
- The situation looks hopeless
- You think they WILL die next turn

The ONLY question is: does the narrative text describe them as already dead RIGHT NOW? If there is any doubt, do NOT add [DEAD].

Respond with the bullet points, and optionally [DEAD] at the end. No other text.`

export const DIRECTOR_INSTRUCTION = `YOUR ROLE THIS TURN: Provide director notes — hidden behind-the-scenes intelligence. The player never sees this.

You are the world's hidden engine. Your job is to make the world feel ALIVE — things happen whether or not the player is involved. If the player is busy with one plotline, the rest of the world doesn't freeze. However, you should not pile on escalation or complexity for its own sake. New elements should emerge naturally from what already exists.

GUIDELINES:
- Prefer deepening EXISTING elements over inventing wholly new ones. Give established characters arcs, let existing tensions evolve.
- New mysteries or events should grow organically from the setting and established facts — not appear from nowhere.
- If the story started grounded, keep it grounded. Match the tone and scope of the setting.
- Your previous notes are a STARTING POINT. Advance things that should advance, hold things that are waiting, resolve things that have concluded.
- Not every NPC needs a hidden agenda, but the world should feel like it has momentum beyond the player's immediate view.
- You are FREE to rewrite, replace, or discard any mystery or upcoming event if a better direction emerges from the story. These notes serve the narrative — they are not commitments. If the player's actions or the story's natural flow suggest something more interesting, follow that instead.
- However, do NOT complicate things that are already complex. If a mystery or event is already layered and interesting, let it play out rather than piling more on top.

Structure your notes using these NUMBERED sections. Maintain the numbering so you can track what's active:

## PROTAGONIST
A brief description of the protagonist as established so far — appearance, personality traits, skills, relationships, and any important facts about them. This is NOT a recap of the current situation (the narrative already covers that). This is a reference sheet so the narrative agent maintains consistency about WHO the protagonist is across turns. Only update when new traits or facts about the protagonist are revealed.

## MYSTERIES (up to 3)
Significant unanswered questions, hidden truths, or things the player doesn't yet know. Number them 1-3. Each mystery should have a one-line summary and a brief note on the underlying truth or direction.
- These should be LONG-TERM threads — things that take multiple turns to uncover, not something the player can resolve next turn.
- When a mystery is RESOLVED (player discovered the truth, or it became irrelevant), remove it.
- When a slot is empty and the world naturally produces a new question, fill it — but only if it emerges from existing elements, not invented from thin air.
- It's fine to have 1 or 2 mysteries. Don't force all 3 slots full.

## UPCOMING EVENTS (up to 2)
Things that are going to happen in the MEDIUM TO LONG TERM, independent of the player. Number them 1-2. Each should describe what will happen, roughly when, and what might trigger or prevent it.
- Think in terms of days, weeks, or story arcs — not the next few minutes. Immediate consequences have their own section below.
- These give the world long-range momentum. They might be NPC plans that take time to execute, environmental shifts that build gradually, approaching deadlines, or slow-burn consequences of past actions.
- When an event FIRES (it happened) or is PREVENTED, remove it and optionally replace it.
- At least one slot should usually be filled. If both are empty, think about what's brewing.

## IMMEDIATE CONSEQUENCES
What will the player's most recent action cause in the near term? Brief notes only. This is the ONLY section for what happens next — mysteries and upcoming events should look further ahead.

Aim for 150-300 words total. Respond with ONLY your director notes, no other text.`

export const DIRECTOR_DIFF_INSTRUCTION = `YOUR ROLE THIS TURN: Update your director notes using a unified diff.

You are the world's hidden engine. Below are your CURRENT director notes with line numbers. Based on what just happened in the story, output a unified diff to update them.

REMINDERS:
- MYSTERIES should be LONG-TERM threads (multiple turns to uncover). Don't resolve or replace them hastily.
- UPCOMING EVENTS should be MEDIUM TO LONG TERM (days, weeks, story arcs). Immediate effects go in IMMEDIATE CONSEQUENCES only.
- You are FREE to rewrite, replace, or discard any mystery or event if the story naturally goes in a better direction — but don't complicate things that are already complex.
- Prefer deepening existing elements over inventing new ones.

DIFF FORMAT:
@@ -<old_line>,<old_count> +<new_line>,<new_count> @@
 context line (prefix with space)
-line to remove (prefix with minus)
+line to add (prefix with plus)

Rules:
- Line numbers are 1-indexed
- Include 1-2 context lines before/after changes
- You can have multiple @@ hunks for different sections
- If nothing needs to change this turn, output exactly: NO_CHANGES

CRITICAL: Return ONLY the unified diff (or NO_CHANGES). No preamble, no explanation, no markdown code blocks.`

// --- Prompt construction helpers ---

function formatMomentumContext(trajectory: string, action: string): string {
  return `[WORLD MOMENTUM — things happening independently in the world: ${trajectory}]\n\nMy action: ${action}`
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
 */
export function buildSharedHistory(turns: AdventureTurn[]): LLMMessage[] {
  const messages: LLMMessage[] = []

  // Shared system prompt — cache breakpoint: static across all calls and turns
  messages.push({
    role: 'system',
    content: BASE_SYSTEM_PROMPT,
    cache_control: { type: 'ephemeral', ttl: '1h' },
  })

  // Conversation history
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]

    if (turn.playerAction) {
      const prevTurn = i > 0 ? turns[i - 1] : null
      const userContent = prevTurn?.worldTrajectory
        ? formatMomentumContext(prevTurn.worldTrajectory, turn.playerAction)
        : turn.playerAction
      messages.push({ role: 'user', content: userContent })
    } else if (i === 0) {
      // On the opening turn we asked for the adventure to begin.
      // Don't repeat the raw setting text — it's been absorbed into the first narrative.
      messages.push({
        role: 'user',
        content: 'Begin the adventure.',
      })
    }

    const isLastTurn = i === turns.length - 1
    messages.push({
      role: 'assistant',
      content: turn.narrative,
      // Cache breakpoint at end of shared history — all three calls diverge after this
      ...(isLastTurn
        ? { cache_control: { type: 'ephemeral' as const, ttl: '1h' as const } }
        : {}),
    })
  }

  return messages
}

export function buildNarrativeMessages(
  turns: AdventureTurn[],
  settingDescription: string,
  playerAction: string | null,
  turnDirective?: string,
): LLMMessage[] {
  const messages = buildSharedHistory(turns)

  const isOpeningTurn = turns.length === 0 && playerAction === null

  messages.push({
    role: 'system',
    content: `${NARRATIVE_INSTRUCTION}\n\n${CORE_DIRECTIVE}`,
  })

  // Final user message
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

  return messages
}

export function buildTrajectoryMessages(
  turns: AdventureTurn[],
  latestNarrative: string,
  playerAction: string | null,
  currentDirectorNotes?: string,
  options?: { rejectedTrajectory?: string; directive?: string },
): LLMMessage[] {
  // Shared history + the just-completed turn's narrative
  const messages = buildSharedHistory(turns)

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
): LLMMessage[] {
  const messages = buildSharedHistory(turns)

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

  // Director-specific instruction — use diff mode when we have previous notes
  const lastDirectorNotes = [...turns]
    .reverse()
    .find((t) => t.directorNotes)?.directorNotes

  if (lastDirectorNotes) {
    // Diff mode: send current notes with line numbers, ask for a unified diff
    const numberedNotes = formatWithLineNumbers(lastDirectorNotes)

    messages.push({
      role: 'user',
      content: `${DIRECTOR_DIFF_INSTRUCTION}\n\nCURRENT DIRECTOR NOTES:\n${numberedNotes}`,
    })
  } else {
    // First turn: generate full notes from scratch
    messages.push({
      role: 'system',
      content: DIRECTOR_INSTRUCTION,
    })

    messages.push({
      role: 'user',
      content:
        'Based on the story so far, provide your initial director notes using the structured format (PROTAGONIST, MYSTERIES 1-3, UPCOMING EVENTS 1-2, IMMEDIATE CONSEQUENCES).',
    })
  }

  appendDirective(messages, turnDirective)

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

export function parseTrajectory(raw: string): {
  trajectory: string
  dead: boolean
} {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  const dead = /\[DEAD\]/i.test(cleaned)
  const trajectory = cleaned.replace(/\[DEAD\]/gi, '').trim()
  return { trajectory, dead }
}
