import {
  Component,
  For,
  Show,
  batch,
  createEffect,
  createSignal,
  onCleanup,
} from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { Button, Text } from '@mythweavers/ui'
import { ProviderModelSelector } from '../components/ProviderModelSelector'
import { settingsStore } from '../stores/settingsStore'
import { LLMClientFactory } from '../utils/llm/LLMClientFactory'
import { resolveModel } from '../utils/llm/resolveModel'
import type { LLMMessage } from '../types/llm'
import * as styles from './AdventurePage.css'

// --- Types ---

interface AdventureTurn {
  playerAction: string | null // null for the opening turn
  narrative: string
  worldTrajectory: string
  directorNotes?: string // hidden behind-the-scenes context from the director agent
  dead?: boolean // protagonist died this turn
}

type AdventurePhase = 'setup' | 'playing'

// --- Setting generation knobs ---

interface SettingKnob {
  id: string
  label: string
  options: string[]
}

const SETTING_KNOBS: SettingKnob[] = [
  {
    id: 'era',
    label: 'Era',
    options: ['Antiquity', 'Medieval', 'Renaissance', 'Victorian', 'Modern', 'Near Future', 'Far Future', 'Stone Age', 'Mythic'],
  },
  {
    id: 'location',
    label: 'Start',
    options: ['City', 'Village', 'Wilderness', 'Underground', 'Coastal', 'Space', 'Desert', 'Mountains', 'Island', 'Floating'],
  },
  {
    id: 'tone',
    label: 'Tone',
    options: ['Dark', 'Whimsical', 'Gritty', 'Heroic', 'Horror', 'Mystery', 'Comedic', 'Melancholic', 'Surreal'],
  },
  {
    id: 'magictech',
    label: 'Power',
    options: ['No magic', 'Low magic', 'High magic', 'Steampunk', 'Sci-fi tech', 'Post-apocalyptic', 'Biopunk', 'Divine'],
  },
  {
    id: 'scale',
    label: 'Scale',
    options: ['Intimate', 'Local', 'Regional', 'Epic', 'Cosmic'],
  },
]

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const SETTING_GEN_PROMPT = `You are a world-builder creating a setting for an interactive adventure. Given the following parameters, craft a vivid, specific setting description in 2-4 sentences. Describe the world and the immediate situation — do NOT describe or mention the protagonist. Focus on atmosphere, sensory details, and an interesting situation that invites exploration.

The "Location" parameter describes the STARTING LOCATION where the adventure begins, not a constraint on the entire world. A cosmic-scale adventure can absolutely start in a village — the village just happens to be where the protagonist is when things kick off.

Be creative and specific — don't just restate the parameters. Invent names, places, and details that make the setting feel alive.

Respond with ONLY the setting description, no other text.`

// --- Prompt construction ---

// Shared system prompt — identical first message for all calls enables provider-side caching
const BASE_SYSTEM_PROMPT = `You are a collaborative storyteller running an interactive adventure. You create vivid, engaging fiction that responds to the player's choices while maintaining a living, breathing world that continues to evolve independently of the player.

The story is told in second person ("you"), present tense. The player controls only the protagonist. You control all NPCs, the environment, and world events.`

const CORE_DIRECTIVE = `The world has its own momentum — things are always happening independently of the player. NPCs have their own agendas, threats escalate on their own, and opportunities pass if not seized. Let previous world trajectories bleed into the narrative even when the player acts — the world doesn't pause just because the protagonist did something.`

// Role-specific instructions appended AFTER the shared conversation history
const NARRATIVE_INSTRUCTION = `YOUR ROLE THIS TURN: Write the story narrative.

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

PLAUSIBILITY:
- Everything that happens must be physically plausible. A person cannot outrun a vehicle. Doors don't unlock themselves. NPCs cannot teleport.
- Consider distances, speeds, physical barriers, and the laws of physics before writing any action.
- If the world momentum suggests something implausible (e.g. an NPC catching up to a speeding vehicle on foot), ignore that momentum point — it simply doesn't happen.`

const TRAJECTORY_INSTRUCTION = `YOUR ROLE THIS TURN: Determine the world's momentum in 1-3 SHORT bullet points.

Describe what NPCs are doing and how the environment is shifting. NPCs are independent agents — they have their own plans, and they ACT on those plans. The player's action only disrupts an NPC's plans if it DIRECTLY interferes with them. Otherwise, NPCs continue doing what they were already doing.

RULES:
- Each bullet: one NPC action/intent or one environmental change. Max one sentence.
- NPCs FOLLOW THROUGH on established plans unless the player specifically prevented it this turn. A player doing something unrelated does NOT cancel NPC actions.
- Frame NPC actions as things that ARE happening or WILL happen, not vague possibilities. The only caveat is direct player interference.
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

const DIRECTOR_INSTRUCTION = `YOUR ROLE THIS TURN: Provide director notes — hidden behind-the-scenes intelligence. The player never sees this.

You are the world's hidden engine. Your job is to make the world feel ALIVE — things happen whether or not the player is involved. If the player is busy with one plotline, the rest of the world doesn't freeze. However, you should not pile on escalation or complexity for its own sake. New elements should emerge naturally from what already exists.

GUIDELINES:
- Prefer deepening EXISTING elements over inventing wholly new ones. Give established characters arcs, let existing tensions evolve.
- New mysteries or events should grow organically from the setting and established facts — not appear from nowhere.
- If the story started grounded, keep it grounded. Match the tone and scope of the setting.
- Your previous notes are a STARTING POINT. Advance things that should advance, hold things that are waiting, resolve things that have concluded.
- Not every NPC needs a hidden agenda, but the world should feel like it has momentum beyond the player's immediate view.

Structure your notes using these NUMBERED sections. Maintain the numbering so you can track what's active:

## BACKGROUND
A short paragraph describing the current state of the world/setting around the protagonist. What does daily life look like here? What's the general atmosphere? What tensions or dynamics exist in this place? Update this each turn to reflect changes. This grounds the narrative agent in a living world.

## MYSTERIES (up to 3)
Significant unanswered questions, hidden truths, or things the player doesn't yet know. Number them 1-3. Each mystery should have a one-line summary and a brief note on the underlying truth or direction.
- When a mystery is RESOLVED (player discovered the truth, or it became irrelevant), remove it.
- When a slot is empty and the world naturally produces a new question, fill it — but only if it emerges from existing elements, not invented from thin air.
- It's fine to have 1 or 2 mysteries. Don't force all 3 slots full.

## UPCOMING EVENTS (up to 2)
Things that are going to happen in the near future, independent of the player. Number them 1-2. Each should describe what will happen, roughly when, and what might trigger or prevent it.
- These give the world momentum. They might be NPC plans, environmental changes, approaching deadlines, or consequences of past actions.
- When an event FIRES (it happened) or is PREVENTED, remove it and optionally replace it.
- At least one slot should usually be filled. If both are empty, think about what's brewing.

## IMMEDIATE CONSEQUENCES
What will the player's most recent action cause in the near term? Brief notes only.

Aim for 150-300 words total. Respond with ONLY your director notes, no other text.`

function formatMomentumContext(trajectory: string, action: string): string {
  return `[WORLD MOMENTUM — things happening independently in the world: ${trajectory}]\n\nMy action: ${action}`
}

// Shared conversation history builder — identical prefix for all three calls
function buildSharedHistory(
  turns: AdventureTurn[],
): LLMMessage[] {
  const messages: LLMMessage[] = []

  // Shared system prompt — cache breakpoint: static across all calls and turns
  messages.push({
    role: 'system',
    content: BASE_SYSTEM_PROMPT,
    cache_control: { type: 'ephemeral' },
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
      // Repeating it causes the director/trajectory to keep re-anchoring to it.
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
      ...(isLastTurn ? { cache_control: { type: 'ephemeral' as const } } : {}),
    })
  }

  return messages
}

function buildNarrativeMessages(
  turns: AdventureTurn[],
  settingDescription: string,
  playerAction: string | null,
  turnDirective?: string,
): LLMMessage[] {
  const messages = buildSharedHistory(turns)

  const isOpeningTurn = turns.length === 0 && playerAction === null

  // Role-specific instruction + core directive + user directive
  const userDirective = turnDirective?.trim()
  const directivePart = userDirective
    ? `\n\n${CORE_DIRECTIVE}\n\n${userDirective}`
    : `\n\n${CORE_DIRECTIVE}`

  messages.push({
    role: 'system',
    content: NARRATIVE_INSTRUCTION + directivePart,
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
      content: `Begin the adventure. Here is the setting — use it as a springboard, expand on it with your own details, and establish the protagonist in the world:\n\n${settingDescription}`,
    })
  }

  return messages
}

function buildTrajectoryMessages(
  turns: AdventureTurn[],
  settingDescription: string,
  latestNarrative: string,
  playerAction: string | null,
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
  } else {
    messages.push({
      role: 'user',
      content: `Begin the adventure. Here is the setting — use it as a springboard, expand on it with your own details, and establish the protagonist in the world:\n\n${settingDescription}`,
    })
  }
  messages.push({ role: 'assistant', content: latestNarrative })

  // Trajectory-specific instruction with director notes
  const latestDirectorNotes = [...turns].reverse().find((t) => t.directorNotes)?.directorNotes
  const directorSection = latestDirectorNotes
    ? `\n\n<director_notes context="use these to inform the trajectory — what's REALLY happening behind the scenes">\n${latestDirectorNotes}\n</director_notes>`
    : ''

  messages.push({
    role: 'system',
    content: TRAJECTORY_INSTRUCTION + directorSection,
  })

  messages.push({
    role: 'user',
    content: 'What happens next in the world if the player does nothing?',
  })

  return messages
}

function buildDirectorMessages(
  turns: AdventureTurn[],
): LLMMessage[] {
  const messages = buildSharedHistory(turns)

  // Director-specific instruction with previous notes
  const lastDirectorNotes = [...turns].reverse().find((t) => t.directorNotes)?.directorNotes
  const previousNotesSection = lastDirectorNotes
    ? `\n\nYOUR PREVIOUS DIRECTOR NOTES:\n${lastDirectorNotes}`
    : ''

  messages.push({
    role: 'system',
    content: DIRECTOR_INSTRUCTION + previousNotesSection,
  })

  messages.push({
    role: 'user',
    content: 'Based on the story so far, provide your updated director notes using the structured format (BACKGROUND, MYSTERIES 1-3, UPCOMING EVENTS 1-2, IMMEDIATE CONSEQUENCES). Advance, resolve, or replace items as appropriate.',
  })

  return messages
}

// --- Parse helpers ---

function cleanNarrative(raw: string): string {
  // Strip any XML tags the model might still produce out of habit
  return raw
    .replace(/<\/?narrative>/g, '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim()
}

function parseTrajectory(raw: string): { trajectory: string; dead: boolean } {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim()
  const dead = /\[DEAD\]/i.test(cleaned)
  const trajectory = cleaned
    .replace(/\[DEAD\]/gi, '')
    .trim()
  return { trajectory, dead }
}

// --- LocalStorage persistence ---

const STORAGE_KEY = 'adventure-state'

interface PersistedState {
  phase: AdventurePhase
  settingInput: string
  protagonistInput: string
  settingDescription: string
  turns: AdventureTurn[]
  directive?: string
}

function saveState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY)
}

// --- Component ---

const DEFAULT_SETTING = ''

export const AdventurePage: Component = () => {
  const navigate = useNavigate()

  // Restore persisted state
  const saved = loadState()

  // Phase
  const [phase, setPhase] = createSignal<AdventurePhase>(saved?.phase ?? 'setup')

  // Setup form
  const [settingInput, setSettingInput] = createSignal(saved?.settingInput ?? DEFAULT_SETTING)
  const [protagonistInput, setProtagonistInput] = createSignal(saved?.protagonistInput ?? '')

  // Game state
  const [turns, setTurns] = createSignal<AdventureTurn[]>(saved?.turns ?? [])
  const [isGenerating, setIsGenerating] = createSignal(false)
  const [streamingContent, setStreamingContent] = createSignal('')
  const [playerInput, setPlayerInput] = createSignal('')
  const [expandedTrajectories, setExpandedTrajectories] = createSignal<
    Set<number>
  >(new Set())
  const [settingDescription, setSettingDescription] = createSignal(saved?.settingDescription ?? '')
  const [error, setError] = createSignal<string | null>(null)
  const [pendingAction, setPendingAction] = createSignal<string | null>(null)
  // Tracks the action that failed so we can retry. undefined = no failure, null = opening turn failed, string = player action failed
  const [lastFailedAction, setLastFailedAction] = createSignal<string | null | undefined>(undefined)

  // Director agent — runs in background after each turn
  const [isDirectorRunning, setIsDirectorRunning] = createSignal(false)
  const [showDirectorNotes, setShowDirectorNotes] = createSignal(false)

  // Mobile menu
  const [showMenu, setShowMenu] = createSignal(false)

  // Directive — persistent per-turn instruction
  const [directive, setDirective] = createSignal(saved?.directive ?? '')
  const [showDirective, setShowDirective] = createSignal(false)

  // Setting generator
  const [showKnobs, setShowKnobs] = createSignal(false)
  const [isGeneratingSetting, setIsGeneratingSetting] = createSignal(false)
  const [settingGenFailed, setSettingGenFailed] = createSignal(false)
  const [knobValues, setKnobValues] = createSignal<Record<string, string>>(
    Object.fromEntries(SETTING_KNOBS.map((k) => [k.id, ''])),
  )
  const [knobLocks, setKnobLocks] = createSignal<Record<string, boolean>>(
    Object.fromEntries(SETTING_KNOBS.map((k) => [k.id, false])),
  )

  let abortController: AbortController | null = null
  let storyAreaRef: HTMLDivElement | undefined
  let inputRef: HTMLTextAreaElement | undefined

  // Persist state on meaningful changes (debounced to avoid thrashing during streaming)
  let persistTimer: ReturnType<typeof setTimeout> | undefined
  function persistSoon() {
    clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      saveState({
        phase: phase(),
        settingInput: settingInput(),
        protagonistInput: protagonistInput(),
        settingDescription: settingDescription(),
        turns: turns(),
        directive: directive(),
      })
    }, 500)
  }
  // Track each signal we care about individually so we control when persistence fires
  createEffect(() => { phase(); persistSoon() })
  createEffect(() => { turns(); persistSoon() })
  createEffect(() => { settingDescription(); persistSoon() })
  // For form inputs, persist on change but not during AI streaming
  createEffect(() => { settingInput(); if (!isGeneratingSetting()) persistSoon() })
  createEffect(() => { protagonistInput(); persistSoon() })
  createEffect(() => { directive(); persistSoon() })

  // Auto-scroll only when the user is already near the bottom.
  // Track via scroll events so we know the user's position BEFORE we programmatically scroll.
  const [scrollLocked, setScrollLocked] = createSignal(true)
  const onStoryAreaScroll = () => {
    if (!storyAreaRef) return
    const threshold = 32 // ~2 lines
    setScrollLocked(storyAreaRef.scrollHeight - storyAreaRef.scrollTop - storyAreaRef.clientHeight < threshold)
  }

  const scrollToBottom = () => {
    if (storyAreaRef) {
      storyAreaRef.scrollTop = storyAreaRef.scrollHeight
    }
    setScrollLocked(true)
  }

  createEffect(() => {
    // Track these reactively
    turns()
    streamingContent()
    requestAnimationFrame(() => {
      if (storyAreaRef && scrollLocked()) {
        storyAreaRef.scrollTop = storyAreaRef.scrollHeight
      }
    })
  })

  onCleanup(() => {
    abortController?.abort()
    clearTimeout(persistTimer)
  })

  // --- Generation ---

  async function generate(playerAction: string | null) {
    if (isGenerating()) return

    setError(null)
    setLastFailedAction(undefined)
    setIsGenerating(true)
    setStreamingContent('')
    setPendingAction(playerAction)

    abortController = new AbortController()

    try {
      // --- Step 1: Stream narrative ---
      const narrativeMessages = buildNarrativeMessages(
        turns(),
        settingDescription(),
        playerAction,
        directive(),
      )

      const narrativeResolved = resolveModel('adventure')
      const narrativeClient = LLMClientFactory.getClient(narrativeResolved.provider)

      let accumulated = ''
      const narrativeResponse = narrativeClient.generate({
        model: narrativeResolved.model,
        messages: narrativeMessages,
        max_tokens: settingsStore.maxTokens,
        thinking_budget: settingsStore.thinkingBudget
          ? Math.min(settingsStore.thinkingBudget, Math.floor(settingsStore.maxTokens / 2))
          : undefined,
        signal: abortController.signal,
        metadata: { callType: 'adventure' },
      })

      for await (const event of narrativeResponse) {
        if (event.type === 'chunk') {
          accumulated += event.text
          // Show streaming content (strip thinking tags for display)
          const displayContent = accumulated
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .replace(/<\/?narrative>/g, '')
            .trim()
          setStreamingContent(displayContent)
        }
      }

      const narrative = cleanNarrative(accumulated)

      // --- Step 2: Generate world trajectory (silent, not streamed) ---
      setStreamingContent(narrative + '\n\n⏳ Reading the world...')

      const trajectoryMessages = buildTrajectoryMessages(
        turns(),
        settingDescription(),
        narrative,
        playerAction,
      )

      const trajectoryResolved = resolveModel('adventure-trajectory')
      const trajectoryClient = LLMClientFactory.getClient(trajectoryResolved.provider)

      let trajectoryAccumulated = ''
      const trajectoryResponse = trajectoryClient.generate({
        model: trajectoryResolved.model,
        messages: trajectoryMessages,
        max_tokens: settingsStore.maxTokens,
        thinking_budget: settingsStore.thinkingBudget
          ? Math.min(settingsStore.thinkingBudget, Math.floor(settingsStore.maxTokens / 2))
          : undefined,
        signal: abortController.signal,
        metadata: { callType: 'adventure-trajectory' },
      })

      for await (const event of trajectoryResponse) {
        if (event.type === 'chunk') {
          trajectoryAccumulated += event.text
        }
      }

      const { trajectory: worldTrajectory, dead } = parseTrajectory(trajectoryAccumulated)

      // Add the turn
      const newTurn: AdventureTurn = {
        playerAction,
        narrative,
        worldTrajectory,
        ...(dead ? { dead: true } : {}),
      }

      // Batch all state updates so the streaming block and turn swap in a single render frame.
      // Without batch, clearing streaming and adding the turn happen in separate renders,
      // causing a flash where the content disappears before the turn appears.
      batch(() => {
        setStreamingContent('')
        setPendingAction(null)
        setIsGenerating(false)
        setTurns((prev) => [...prev, newTurn])
      })

      // Fire director agent in the background (skip if dead — no future turns)
      if (!dead) {
        runDirector()
      }

      // Focus input for next action
      if (!dead) {
        requestAnimationFrame(() => {
          inputRef?.focus()
        })
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User aborted — if we have partial content, save it as narrative-only
        const partial = streamingContent()
        if (partial) {
          const narrative = cleanNarrative(partial)
          batch(() => {
            setStreamingContent('')
            setPendingAction(null)
            setIsGenerating(false)
            setTurns((prev) => [
              ...prev,
              { playerAction, narrative, worldTrajectory: '(Interrupted)' },
            ])
          })
        } else {
          setStreamingContent('')
        }
      } else {
        const message =
          err instanceof Error ? err.message : 'Unknown error occurred'
        setError(message)
        setLastFailedAction(playerAction)
        console.error('Adventure generation error:', err)
      }
    } finally {
      setIsGenerating(false)
      setPendingAction(null)
      abortController = null
    }
  }

  // --- Director agent (background) ---

  async function runDirector() {
    if (isDirectorRunning()) return

    setIsDirectorRunning(true)

    try {
      const directorResolved = resolveModel('adventure-director')
      const client = LLMClientFactory.getClient(directorResolved.provider)
      const messages = buildDirectorMessages(turns())

      const options = {
        model: directorResolved.model,
        messages,
        max_tokens: settingsStore.maxTokens,
        thinking_budget: settingsStore.thinkingBudget
          ? Math.min(settingsStore.thinkingBudget, Math.floor(settingsStore.maxTokens / 2))
          : undefined,
        metadata: { callType: 'adventure-director' },
      }

      let accumulated = ''
      const response = client.generate(options)
      for await (const event of response) {
        if (event.type === 'chunk') {
          accumulated += event.text
        }
      }

      // Clean up thinking tags and attach to the latest turn
      const directorNotes = accumulated
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim()

      if (directorNotes) {
        setTurns((prev) => {
          const updated = [...prev]
          const lastIndex = updated.length - 1
          if (lastIndex >= 0) {
            updated[lastIndex] = { ...updated[lastIndex], directorNotes }
          }
          return updated
        })
      }
    } catch (err) {
      // Director failures are silent — they don't affect the player experience
      console.warn('Director agent error:', err)
    } finally {
      setIsDirectorRunning(false)
    }
  }

  // --- Handlers ---

  function handleStart() {
    if (!settingsStore.model || !settingsStore.provider) {
      setError(
        'Please configure your AI provider and model first.',
      )
      return
    }

    let description = settingInput().trim()
    if (protagonistInput().trim()) {
      description += `\n\nPROTAGONIST: ${protagonistInput().trim()}`
    }
    setSettingDescription(description)
    setPhase('playing')

    // Start the adventure
    generate(null)
  }

  function handleSubmit() {
    const action = playerInput().trim()
    if (!action || isGenerating()) return

    setPlayerInput('')
    // User just acted — they want to see what happens next
    setScrollLocked(true)
    generate(action)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleAbort() {
    abortController?.abort()
  }

  function handleRetry() {
    const action = lastFailedAction()
    if (action === undefined) return
    generate(action)
  }

  function handleRegenerate() {
    if (isGenerating()) return
    const currentTurns = turns()
    if (currentTurns.length === 0) return

    const lastTurn = currentTurns[currentTurns.length - 1]
    const action = lastTurn.playerAction

    // Remove the last turn
    setTurns((prev) => prev.slice(0, -1))

    // Re-generate with the same action
    generate(action)
  }

  function handleRewindTo(turnIndex: number) {
    if (isGenerating()) return
    // Keep turns up to and including the target index
    setTurns((prev) => prev.slice(0, turnIndex + 1))
  }

  function handleReset() {
    abortController?.abort()
    setTurns([])
    setStreamingContent('')
    setPlayerInput('')
    setError(null)
    setLastFailedAction(undefined)
    setExpandedTrajectories(new Set<number>())
    setSettingDescription('')
    setPhase('setup')
    clearState()
  }

  async function handleGenerateSetting() {
    if (!settingsStore.model || !settingsStore.provider) {
      setError('Please configure your AI provider and model first.')
      return
    }

    setIsGeneratingSetting(true)
    setError(null)
    setSettingGenFailed(false)

    // Randomize unlocked knobs, keep locked ones
    const locks = knobLocks()
    const values = { ...knobValues() }
    for (const knob of SETTING_KNOBS) {
      if (!locks[knob.id]) {
        values[knob.id] = pickRandom(knob.options)
      }
    }
    setKnobValues(values)

    // Build the prompt from resolved values
    const paramLines = SETTING_KNOBS.map(
      (knob) => `- ${knob.label}: ${values[knob.id]}`,
    ).join('\n')

    try {
      const settingResolved = resolveModel('adventure-setting')
      const client = LLMClientFactory.getClient(settingResolved.provider)
      const messages: LLMMessage[] = [
        { role: 'system', content: SETTING_GEN_PROMPT },
        { role: 'user', content: `Parameters:\n${paramLines}` },
      ]

      let accumulated = ''
      let doneThinking = false
      const response = client.generate({
        model: settingResolved.model,
        messages,
        max_tokens: settingsStore.maxTokens,
        thinking_budget: settingsStore.thinkingBudget
          ? Math.min(settingsStore.thinkingBudget, Math.floor(settingsStore.maxTokens / 2))
          : undefined,
        metadata: { callType: 'adventure-setting' },
      })

      for await (const event of response) {
        if (event.type === 'chunk') {
          accumulated += event.text

          // Track whether we've exited a <think> block
          if (accumulated.includes('</think>')) {
            doneThinking = true
          }

          // Stream into the textarea as it arrives (skip thinking content)
          if (doneThinking || !accumulated.includes('<think>')) {
            const display = accumulated
              .replace(/<think>[\s\S]*?<\/think>/g, '')
              .trim()
            if (display) {
              setSettingInput(display)
            }
          }
        }
      }

      // Final cleanup
      const cleaned = accumulated
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .trim()

      if (cleaned) {
        setSettingInput(cleaned)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate setting'
      setError(message)
      setSettingGenFailed(true)
      console.error('Setting generation error:', err)
    } finally {
      setIsGeneratingSetting(false)
      // Persist now that generation is done
      persistSoon()
    }
  }

  function toggleKnobLock(knobId: string) {
    setKnobLocks((prev) => ({ ...prev, [knobId]: !prev[knobId] }))
  }

  function setKnobValue(knobId: string, value: string) {
    setKnobValues((prev) => ({ ...prev, [knobId]: value }))
    // Lock it when manually selected
    setKnobLocks((prev) => ({ ...prev, [knobId]: true }))
  }

  function toggleTrajectory(index: number) {
    setExpandedTrajectories((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // --- Render helpers ---

  function renderNarrative(text: string, dead?: boolean) {
    const displayText = dead
      ? text.replace(/\n+\s*(?:what do you do\??|what will you do\??|what's your (?:next )?move\??|how do you (?:respond|react)\??)\.?\s*$/i, '').trim()
      : text
    const paragraphs = displayText.split('\n\n').filter((p) => p.trim())
    return (
      <div class={styles.narrative}>
        <For each={paragraphs}>
          {(paragraph) => {
            const parts = paragraph.trim().split('\n')
            return (
              <p class={styles.narrativeParagraph}>
                <For each={parts}>
                  {(part, i) => (
                    <>
                      {part}
                      <Show when={i() < parts.length - 1}>
                        <br />
                      </Show>
                    </>
                  )}
                </For>
              </p>
            )
          }}
        </For>
      </div>
    )
  }

  function renderStreamingContent() {
    const content = streamingContent()
    if (!content) {
      return (
        <div class={styles.streamingIndicator}>
          <div class={styles.streamingDot} />
          <Text as="span" color="secondary">The story unfolds...</Text>
        </div>
      )
    }

    // Clean up any stray XML tags the model might still emit
    const displayText = content
      .replace(/<\/?narrative>/g, '')
      .replace(/<[a-z_]*$/i, '') // strip trailing incomplete tag
      .trim()

    if (!displayText) {
      return (
        <div class={styles.streamingIndicator}>
          <div class={styles.streamingDot} />
          <Text as="span" color="secondary">The story unfolds...</Text>
        </div>
      )
    }

    const paragraphs = displayText.split('\n\n').filter((p) => p.trim())
    return (
      <div class={styles.streamingContent}>
        <For each={paragraphs}>
          {(paragraph) => <p class={styles.streamingParagraph}>{paragraph.trim()}</p>}
        </For>
        <div class={styles.streamingIndicator}>
          <div class={styles.streamingDot} />
        </div>
      </div>
    )
  }

  // --- Setup screen ---

  function renderSetup() {
    return (
      <div class={styles.setupContainer}>
        <div class={styles.setupCard}>
          <h1 class={styles.setupTitle}>World Pulse Adventure</h1>
          <Text color="secondary" style={{ 'margin-bottom': '1.5rem', 'line-height': '1.5' }}>
            An interactive story where the world has its own momentum. Each
            turn, the AI generates what happens based on your actions — and
            also what <em>would</em> have happened if you'd done nothing. The
            world doesn't wait for you.
          </Text>

          <Show when={error()}>
            <div class={styles.errorRow}>
              <div class={styles.errorText}>{error()}</div>
              <Show when={settingGenFailed()}>
                <Button variant="secondary" size="sm" onClick={handleGenerateSetting}>
                  Retry
                </Button>
              </Show>
            </div>
          </Show>

          <ProviderModelSelector autoFetchModels />

          <div class={styles.settingGenerator} style={{ 'margin-top': '1rem' }}>
            <label class={styles.formLabel}>Story Setting</label>
            <div class={styles.generateRow}>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGenerateSetting}
                disabled={!settingsStore.model || isGeneratingSetting()}
              >
                {isGeneratingSetting() ? 'Generating...' : 'Generate Setting'}
              </Button>
              <button
                class={styles.knobsToggle}
                onClick={() => setShowKnobs(!showKnobs())}
              >
                {showKnobs() ? '▾ Parameters' : '▸ Parameters'}
              </button>
            </div>

            <Show when={showKnobs()}>
              <div class={styles.knobsPanel}>
                <For each={SETTING_KNOBS}>
                  {(knob) => (
                    <div class={styles.knobRow}>
                      <span class={styles.knobLabel}>{knob.label}</span>
                      <select
                        class={styles.knobSelect}
                        value={knobValues()[knob.id] || ''}
                        onChange={(e) => setKnobValue(knob.id, e.target.value)}
                      >
                        <option value="">Random</option>
                        <For each={knob.options}>
                          {(opt) => <option value={opt}>{opt}</option>}
                        </For>
                      </select>
                      <button
                        class={`${styles.lockButton} ${knobLocks()[knob.id] ? styles.lockButtonLocked : ''}`}
                        onClick={() => toggleKnobLock(knob.id)}
                        title={knobLocks()[knob.id] ? 'Unlock (will randomize)' : 'Lock (keep this value)'}
                      >
                        {knobLocks()[knob.id] ? '🔒' : '🔓'}
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div class={styles.formGroup} style={{ 'margin-top': '0.75rem' }}>
            <textarea
              class={styles.formTextarea}
              value={settingInput()}
              onInput={(e) => setSettingInput(e.currentTarget.value)}
              placeholder="Describe the world and starting situation, or use Generate Setting above..."
              rows={4}
            />
          </div>

          <div class={styles.formGroup}>
            <label class={styles.formLabel}>
              Protagonist (optional)
            </label>
            <input
              class={styles.formInput}
              type="text"
              value={protagonistInput()}
              onInput={(e) =>
                setProtagonistInput(e.currentTarget.value)
              }
              placeholder="e.g., A retired soldier with a mysterious past"
            />
          </div>

          <div style={{ 'margin-top': '0.5rem' }}>
            <button
              class={styles.directiveToggle}
              onClick={() => setShowDirective(!showDirective())}
            >
              {showDirective() ? '▾ Per-Turn Directive' : '▸ Per-Turn Directive'}
            </button>
            <Show when={showDirective()}>
              <div class={styles.directivePanel}>
                <textarea
                  class={styles.directiveTextarea}
                  value={directive()}
                  onInput={(e) => setDirective(e.currentTarget.value)}
                  placeholder="Instructions repeated with every story turn..."
                  rows={4}
                />
                <div class={styles.directiveHint}>
                  This instruction is injected into the system prompt on every turn to keep the AI on track.
                </div>
              </div>
            </Show>
          </div>

          <Button
            variant="primary"
            onClick={handleStart}
            disabled={!settingInput().trim() || !settingsStore.model}
            style={{ width: '100%', 'margin-top': '0.5rem' }}
          >
            Begin Adventure
          </Button>
        </div>
      </div>
    )
  }

  // --- Playing screen ---

  function renderPlaying() {
    return (
      <>
        <div class={styles.storyArea} ref={storyAreaRef} onScroll={onStoryAreaScroll}>
          <Show
            when={turns().length > 0 || isGenerating()}
            fallback={
              <div class={styles.emptyState}>
                <div class={styles.emptyStateIcon}>⏳</div>
                <Text size="lg" color="secondary">
                  Preparing your adventure...
                </Text>
              </div>
            }
          >
            <For each={turns()}>
              {(turn, index) => (
                <div class={styles.turn}>
                  <Show when={turn.playerAction}>
                    <div class={styles.playerAction}>
                      <span class={styles.playerActionLabel}>
                        You:
                      </span>
                      {turn.playerAction}
                    </div>
                  </Show>

                  {renderNarrative(turn.narrative, turn.dead)}

                  <div class={styles.turnFooter}>
                    <Show when={turn.worldTrajectory}>
                      <div
                        class={styles.worldTrajectory}
                        onClick={() => toggleTrajectory(index())}
                      >
                        <div class={styles.worldTrajectoryLabel}>
                          {expandedTrajectories().has(index())
                            ? '▾'
                            : '▸'}{' '}
                          World Momentum
                        </div>
                        <Show
                          when={expandedTrajectories().has(index())}
                        >
                          <div class={styles.worldTrajectoryContent}>
                            {turn.worldTrajectory}
                          </div>
                        </Show>
                      </div>
                    </Show>

                    <Show when={!isGenerating() && index() < turns().length - 1}>
                      <button
                        class={styles.rewindButton}
                        onClick={() => handleRewindTo(index())}
                        title={`Rewind to this point (removes ${turns().length - 1 - index()} turn${turns().length - 1 - index() > 1 ? 's' : ''})`}
                      >
                        ↩ Rewind here
                      </button>
                    </Show>
                  </div>
                </div>
              )}
            </For>

            {/* Death screen */}
            <Show when={turns().length > 0 && turns()[turns().length - 1].dead}>
              <div class={styles.deathScreen}>
                <div class={styles.deathIcon}>💀</div>
                <Text size="lg" weight="bold">You have perished</Text>
                <Text color="secondary">
                  Your adventure ended after {turns().length} turn{turns().length !== 1 ? 's' : ''}.
                </Text>
                <div class={styles.deathActions}>
                  <Button variant="secondary" size="sm" onClick={() => handleRewindTo(Math.max(0, turns().length - 2))}>
                    ↩ Rewind one turn
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleReset}>
                    New Adventure
                  </Button>
                </div>
              </div>
            </Show>

            {/* Streaming content for current generation */}
            <Show when={isGenerating()}>
              <div class={styles.turn}>
                <Show when={pendingAction()}>
                  <div class={styles.playerAction}>
                    <span class={styles.playerActionLabel}>You:</span>
                    {pendingAction()}
                  </div>
                </Show>
                {renderStreamingContent()}
              </div>
            </Show>
          </Show>

          <Show when={error()}>
            <div class={styles.errorRow}>
              <div class={styles.errorText}>
                Error: {error()}
              </div>
              <Show when={lastFailedAction() !== undefined}>
                <Button variant="secondary" size="sm" onClick={handleRetry}>
                  Retry
                </Button>
              </Show>
            </div>
          </Show>
        </div>

        <Show when={!scrollLocked() && isGenerating()}>
          <button class={styles.scrollToBottom} onClick={scrollToBottom}>
            ↓ Scroll to latest
          </button>
        </Show>

        <Show when={!(turns().length > 0 && turns()[turns().length - 1].dead)}>
        <div class={styles.inputArea}>
          <div class={styles.inputWrapper}>
            <textarea
              ref={inputRef}
              class={styles.input}
              value={playerInput()}
              onInput={(e) => setPlayerInput(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isGenerating()
                  ? 'Waiting for the story...'
                  : 'What do you do?'
              }
              disabled={isGenerating()}
              rows={1}
            />
            <Show
              when={!isGenerating()}
              fallback={
                <Button
                  variant="danger"
                  onClick={handleAbort}
                >
                  Stop
                </Button>
              }
            >
              <Show when={turns().length > 0}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerate}
                  title="Regenerate the last turn"
                >
                  ↻
                </Button>
              </Show>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!playerInput().trim()}
              >
                Act
              </Button>
            </Show>
          </div>
        </div>
        </Show>
      </>
    )
  }

  // --- Header action buttons (shared between desktop and mobile) ---

  function renderHeaderActions() {
    const effectiveThinking = settingsStore.thinkingBudget
      ? Math.min(settingsStore.thinkingBudget, Math.floor(settingsStore.maxTokens / 2))
      : 0

    return (
      <>
        <span class={styles.modelInfo}>
          {settingsStore.provider} / {settingsStore.model}
          {' · '}{settingsStore.maxTokens} tokens
          <Show when={effectiveThinking > 0}>
            {' · '}{effectiveThinking} thinking
          </Show>
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDirectorNotes(!showDirectorNotes())}
          title="View latest director notes"
          disabled={!turns().some((t) => t.directorNotes)}
        >
          <Show when={isDirectorRunning()}>
            <span class={styles.directorIndicator}>🎬{' '}</span>
          </Show>
          {showDirectorNotes() ? 'Hide Director' : 'Director'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDirective(!showDirective())}
          title="Edit per-turn directive"
        >
          {showDirective() ? 'Hide Directive' : 'Directive'}
        </Button>
        <Button variant="secondary" size="sm" onClick={handleReset}>
          New Adventure
        </Button>
      </>
    )
  }

  // --- Main render ---

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <div class={styles.headerLeft}>
          <Button variant="ghost" size="sm" onClick={() => navigate('/stories')}>
            ← Back
          </Button>
          <h1 class={styles.title}>World Pulse</h1>
        </div>
        <Show when={phase() === 'playing'}>
          <div class={styles.headerRight}>
            {renderHeaderActions()}
          </div>
          <button
            class={styles.menuToggle}
            onClick={() => setShowMenu(!showMenu())}
          >
            {showMenu() ? '✕' : '☰'}
          </button>
        </Show>
      </div>

      <Show when={phase() === 'playing' && showMenu()}>
        <div class={styles.mobileMenu}>
          <div class={styles.mobileMenuActions}>
            {renderHeaderActions()}
          </div>
        </div>
      </Show>

      <Show when={phase() === 'playing' && showDirectorNotes()}>
        {(() => {
          const latest = [...turns()].reverse().find((t) => t.directorNotes)
          return (
            <div class={styles.headerDirectivePanel}>
              <label class={styles.formLabel}>🎬 Director Notes</label>
              <Show when={latest?.directorNotes} fallback={
                <div class={styles.directiveHint}>
                  {isDirectorRunning() ? 'Director is analyzing the story...' : 'No director notes yet.'}
                </div>
              }>
                <div class={styles.directorNotesContent}>
                  {latest!.directorNotes}
                </div>
              </Show>
            </div>
          )
        })()}
      </Show>

      <Show when={phase() === 'playing' && showDirective()}>
        <div class={styles.headerDirectivePanel}>
          <label class={styles.formLabel}>Per-Turn Directive</label>
          <textarea
            class={styles.directiveTextarea}
            value={directive()}
            onInput={(e) => setDirective(e.currentTarget.value)}
            placeholder="Instructions repeated with every story turn..."
            rows={3}
          />
          <div class={styles.directiveHint}>
            This instruction is included in the system prompt on every turn. Changes take effect on the next generation.
          </div>
        </div>
      </Show>

      <Show when={phase() === 'setup'} fallback={renderPlaying()}>
        {renderSetup()}
      </Show>
    </div>
  )
}
