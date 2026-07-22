import type { ToolDefinition } from "@mythweavers/llm";
import type { LLMMessage } from "../../types/llm";
import type {
  AdventureTurn,
  AdventureCompaction,
  CharacterCard,
  PlotPoint,
  AgendaItem,
} from "../../hooks/useAdventurePersistence";
import { DISPOSITIONS } from "../../hooks/useAdventurePersistence";

// --- Name extraction ---

/**
 * Extract a short display name from a free-text character description.
 * Handles descriptions like "Kael, a brooding ranger...", "A young woman
 * named Lyra...", "The mysterious stranger...".
 * Falls back to the provided default if nothing usable is found.
 */
export function extractName(description: string | undefined, fallback: string): string {
  const trimmed = description?.trim();
  if (!trimmed) return fallback;
  const words = trimmed.split(/\s+/);
  // Skip leading articles ("A", "An", "The")
  const start = words.length > 1 && /^(a|an|the)$/i.test(words[0]) ? 1 : 0;
  // Take the first word, strip trailing punctuation (commas, etc.)
  const name = words[start]?.replace(/[,;:.]+$/, "");
  return name || fallback;
}

// --- Setting generation knobs ---

export interface SettingKnob {
  id: string;
  label: string;
  options: string[];
}

export const SETTING_KNOBS: SettingKnob[] = [
  {
    id: "era",
    label: "Era",
    options: [
      "Antiquity",
      "Medieval",
      "Renaissance",
      "Victorian",
      "Modern",
      "Near Future",
      "Far Future",
      "Stone Age",
      "Mythic",
    ],
  },
  {
    id: "location",
    label: "Start",
    options: [
      "City",
      "Village",
      "Wilderness",
      "Underground",
      "Coastal",
      "Space",
      "Desert",
      "Mountains",
      "Island",
      "Floating",
    ],
  },
  {
    id: "tone",
    label: "Tone",
    options: [
      "Dark",
      "Whimsical",
      "Gritty",
      "Heroic",
      "Horror",
      "Mystery",
      "Comedic",
      "Melancholic",
      "Surreal",
    ],
  },
  {
    id: "magictech",
    label: "Power",
    options: [
      "No magic",
      "Low magic",
      "High magic",
      "Steampunk",
      "Sci-fi tech",
      "Post-apocalyptic",
      "Biopunk",
      "Divine",
    ],
  },
  {
    id: "scale",
    label: "Scale",
    options: ["Intimate", "Local", "Regional", "Epic", "Cosmic"],
  },
];

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- Steering roll ---

export type SteeringBucket = "well" | "steady" | "worse" | "hell";

// Weights: 15% well / 50% steady / 25% worse / 10% hell.
// Biased toward "steady" so the world is mostly neutral, extremes are memorable.
const STEERING_WEIGHTS: ReadonlyArray<readonly [SteeringBucket, number]> = [
  ["well", 0.15],
  ["steady", 0.5],
  ["worse", 0.25],
  ["hell", 0.1],
];

/** Roll a hidden steering bucket for the next agent turn. */
export function rollSteering(): SteeringBucket {
  const r = Math.random();
  let acc = 0;
  for (const [bucket, weight] of STEERING_WEIGHTS) {
    acc += weight;
    if (r < acc) return bucket;
  }
  return "steady";
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
    case "well":
      return `STEERING (hidden from player): The protagonist executes their action GRACEFULLY. Whatever they were trying to do, they pull it off with more poise, precision, eloquence, or luck than they had any right to expect. A persuasion attempt finds exactly the right words. A leap lands cleanly. A lie comes out smooth and unhesitating. A fight move connects with form. Their craft, this once, is at its peak.

This is purely about the QUALITY OF THE PROTAGONIST'S EXECUTION. It is NOT about:
- The world conveniently bending in the protagonist's favor
- NPCs being unusually agreeable, cooperative, or revealing more than usual
- Helpful coincidences, lucky finds, or new useful information appearing
- Bystanders or opponents fumbling or hesitating

NPCs respond to the well-executed action exactly as their established personality dictates. A skeptical merchant hearing a brilliantly-worded pitch is still a skeptical merchant — but now they are visibly considering it instead of dismissing it. A trained guard parrying a perfectly-timed strike is still a trained guard — but now they are momentarily on the back foot. The protagonist's excellence narrows the NPC's options; it does not change who the NPC is.

If the player's action was vague, pick the most natural concrete attempt and let THAT be executed gracefully.`;
    case "steady":
      return `STEERING (hidden from player): The protagonist executes their action competently and honestly — neither lucky nor unlucky. Their performance is in their normal range. Resolve the action at face value. NPCs respond exactly as their established personalities would respond to a workmanlike attempt at this thing.`;
    case "worse":
      return `STEERING (hidden from player): The protagonist executes their action CLUMSILY. Whatever they were trying to do, their performance is awkward, halting, or partial. A persuasion attempt comes out stilted, missing the mark or hitting only part of it. A leap clears the gap but lands badly. A lie has a tell — a stutter, a glance, a detail that doesn't quite track. A fight move telegraphs. They get most of it, or some of it, but the craft is visibly off.

This is purely about the QUALITY OF THE PROTAGONIST'S EXECUTION. It is NOT about:
- The world turning against them
- NPCs being newly suspicious, hostile, or pressing agendas
- Inconvenient coincidences, bad luck with the environment, or surprise complications from outside
- Bystanders deciding to interfere

NPCs respond to the clumsy execution exactly as their established personality dictates. A friendly bartender hearing a fumbled question is still a friendly bartender — but now they're confused, asking the protagonist to repeat themselves, or politely brushing past the awkwardness. A wary captain hearing a stilted bluff is still a wary captain — but now they're notably less convinced than they otherwise would have been. The protagonist's stumble narrows their own options; it does not change who the NPC is.

The friction comes from the protagonist, not the world. No cliffhanger unless the scene already earned it.`;
    case "hell":
      return `STEERING (hidden from player): The protagonist BUNGLES their action. Whatever they were trying to do, their execution backfires on its own terms. A persuasion attempt comes out so wrongly-pitched it actively offends, embarrasses, or gives the game away. A leap falls short or trips on the takeoff. A lie contradicts itself mid-sentence or names a detail that's plainly wrong. A fight move overcommits and leaves them open. They make a fool of themselves, or a mess of the attempt, on their own merits.

This is purely about the QUALITY OF THE PROTAGONIST'S EXECUTION. It is NOT about:
- The world turning against them
- NPCs becoming newly hostile, suddenly attacking, betraying, or revealing hidden agendas
- The environment turning treacherous (the floor giving way, a storm hitting, a patrol coincidentally arriving)
- Coincidental events outside the protagonist's control

NPCs respond to the bungled execution exactly as their established personality dictates. A kindly priest hearing a deeply offensive accidental insult is still a kindly priest — but now they are hurt, withdrawn, or coolly redirecting the conversation. A hot-tempered guard hearing the same insult is still a hot-tempered guard — and may well respond in kind. The disaster IS the protagonist's bad performance; the NPC's reaction follows naturally from THEIR character meeting THAT performance.

The disaster comes from the protagonist, not the world. Stay inside the world's logic. NPC reactions must remain in character: a cautious NPC does not suddenly charge in, a friendly NPC does not suddenly betray, regardless of how badly the protagonist bungled.`;
  }
}

// --- Prompt constants ---

export const SETTING_GEN_PROMPT = `You are a world-builder creating a setting for an interactive adventure. Given the following parameters, craft a vivid, specific setting description in 2-4 sentences. Describe the world and the immediate situation — do NOT describe or mention the protagonist. Focus on atmosphere, sensory details, and an interesting situation that invites exploration.

The "Location" parameter describes the STARTING LOCATION where the adventure begins, not a constraint on the entire world. A cosmic-scale adventure can absolutely start in a village — the village just happens to be where the protagonist is when things kick off.

Be creative and specific — don't just restate the parameters. Invent names, places, and details that make the setting feel alive.

Respond with ONLY the setting description, no other text.`;

// Shared system prompt — identical first message for all calls enables provider-side caching
export const BASE_SYSTEM_PROMPT = `You are a collaborative storyteller running an interactive adventure. You create vivid, engaging fiction that responds to the player's choices. The world is alive — NPCs have their own personalities and motivations — but the story follows the player, not its own independent agenda.

The story is told in second person ("you"), present tense. The player controls only the protagonist. You control all NPCs, the environment, and world events.`;

export const CORE_DIRECTIVE = `The player's input describes their INTENT, not exact words or actions. Interpret it as the general direction or tone they want to take. Only treat text in "quotes" as literal dialogue or exact phrasing. Everything else is shorthand for what the protagonist is trying to do — translate it into natural, in-character behavior.

The player's action is the starting point of each turn. Resolve it first and honestly, then let the world react to it in the same narrative — do not wait for another turn to show consequences.`;

// --- Adaptive response length ---

/** A paragraph range, e.g. { min: 2, max: 4 }. */
export interface ParagraphRange {
  min: number;
  max: number;
}

const DEFAULT_PARAGRAPH_RANGE: ParagraphRange = { min: 2, max: 4 };

/**
 * Rough sentence count of a player action. Splits on sentence terminators
 * and newlines; quoted dialogue counts too (each quoted line is its own
 * beat the writer has to render). Deliberately approximate — it only
 * steers the response-length guidance, so overcounting an abbreviation
 * just nudges the range up slightly.
 */
function countSentences(text: string): number {
  const count = text
    .split(/[.!?…]+(?=[\s"“”'’)\]]|$)|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.replace(/["'“”‘’)\]]/g, "").length > 0).length;
  return Math.max(count, 1);
}

/**
 * Pick the paragraph range for a turn's narrative from the length of the
 * player action driving it. A terse one-line action ("I open the door.")
 * fits the default 2-4 paragraphs; a multi-sentence instruction packs
 * several beats, and squeezing those into 2-4 paragraphs makes the model
 * compress a full scene into a cramped summary — so the budget grows with
 * the action (~1 extra sentence ≈ 1 extra paragraph, capped at 8-10).
 */
export function paragraphRangeForAction(
  playerAction: string | null | undefined,
): ParagraphRange {
  if (!playerAction) return DEFAULT_PARAGRAPH_RANGE;
  const sentences = countSentences(playerAction);
  if (sentences <= 3) return DEFAULT_PARAGRAPH_RANGE;
  const min = Math.min(sentences - 1, 8);
  return { min, max: min + 2 };
}

/** The most recent real player action in the turn history, if any. */
function lastPlayerAction(turns: AdventureTurn[]): string | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].playerAction) return turns[i].playerAction;
  }
  return null;
}

/**
 * Role-specific instruction for pass 1 (resolution).
 *
 * Narrates the direct consequences of the player's action. NPCs react
 * reactively but do NOT pursue their own agenda here — that's pass 2's job.
 * Ends in a beat where the world waits, so the player can optionally stop
 * the scene there (when auto-advance is off).
 *
 * The paragraph budget scales with the player action's length — see
 * `paragraphRangeForAction`.
 */
export const RESOLUTION_INSTRUCTION = (
  paragraphs: ParagraphRange = DEFAULT_PARAGRAPH_RANGE,
) => `YOUR ROLE THIS TURN: Resolve the player's action.

Write ONLY the story narrative — no metadata, no headings, no XML tags.

SCOPE OF THIS TURN:
- Advance the story based on what the protagonist just did.

RULES:
- POINT OF VIEW: Write in **second person, present tense** addressing the protagonist as "you".
- Show, don't tell. Vivid sensory details, dialogue, action.
- ${paragraphs.min}-${paragraphs.max} paragraphs.
- Only include world events the protagonist could plausibly observe. No unexplained knowledge of distant events.
- Everything must be physically plausible within the established world.
- NPCs react consistently with their established personalities and current motivations.`;

/**
 * Instruction for the deuteragonist action LLM call.
 *
 * Runs before the resolution pass when a partner character is configured.
 * Queries the LLM to determine what the partner wants to do, given the
 * story state, their personality, and what the protagonist just did.
 * The output is a short action description that will be passed alongside
 * the player's action into the resolution prompt.
 */
export const PARTNER_ACTION_INSTRUCTION = `You are determining what a deuteragonist (partner character accompanying the protagonist) intends to do this turn.

Given the story so far, the deuteragonist's personality, and what the protagonist just did, write ONE SHORT SENTENCE describing the deuteragonist's intended action — what they want to accomplish, say, or signal this turn. This is NOT prose. It is a beat summary that a writer model will later render as narrative alongside the protagonist's action.

Rules:
- ONE sentence only, at most a sentence and a half. Do NOT write dialogue, sensory detail, or narrative prose.
- State the GOAL or ACTION, not the execution: "She intends to confront him about the missing money" NOT "She spins around, her eyes blazing as she grabs his collar and shouts..."
- Write in third person using the deuteragonist's name or pronoun.
- The protagonist is addressed as "the protagonist" or "him/her/them" — never "you".

Output ONLY the sentence. No labels, no formatting, no meta-commentary.`;

/**
 * Role-specific instruction for pass 2 (world step).
 *
 * Fires after the resolution turn is finalized. The shared history ends with
 * the freshly-written resolution narrative as an assistant message. Now NPCs
 * and the environment move on their own agenda and the scene is set up for
 * the next player input.
 */
export const WORLD_STEP_INSTRUCTION = (
  paragraphs: ParagraphRange = DEFAULT_PARAGRAPH_RANGE,
) => `YOUR ROLE THIS TURN: Let the world move.

Write ONLY the story narrative — no metadata, no headings, no XML tags.

SCOPE OF THIS TURN:
- NPCs present in the scene act in character (drawing on their established personalities from the World Bible, the live character roster, and prior turns). They pursue their own goals, not just react to the protagonist.
- Continue directly from where the resolution narrative left off. Do not recap or restate events that were just narrated.

RULES:
- POINT OF VIEW: Write in **second person, present tense** addressing the protagonist as "you".
- Show, don't tell. Vivid sensory details, dialogue, action.
- ${paragraphs.min}-${paragraphs.max} paragraphs.
- Only include world events the protagonist could plausibly observe. No unexplained knowledge of distant events.
- Everything must be physically plausible within the established world.
- NPCs must act consistently with their established personalities, goals, and current motivations.`;

/**
 * Role-specific instruction for the autonomous "continue story" pass.
 *
 * Like the world step, there is no player action — but instead of holding the
 * protagonist still while only the world reacts, the WHOLE scene advances on
 * its own momentum: the protagonist, NPCs, and environment all move forward
 * along their established trajectory. Used by the manual "Continue story"
 * button when the story is already on track and the author wants to push it
 * forward without typing an action.
 */
export const CONTINUE_STORY_INSTRUCTION = (
  paragraphs: ParagraphRange = DEFAULT_PARAGRAPH_RANGE,
) => `YOUR ROLE THIS TURN: Continue the story.

Write ONLY the story narrative — no metadata, no headings, no XML tags.

SCOPE OF THIS TURN:
- The whole scene advances on its own momentum. The protagonist, the NPCs present, and the environment all move forward according to their established trajectory, goals, and current situation.
- Do NOT wait for or prompt the protagonist. Let them act on their own initiative, consistent with what they have been doing and what they want.
- Continue directly from where the last turn left off. Do not recap or restate events that were just narrated.

RULES:
- POINT OF VIEW: Write in **second person, present tense** addressing the protagonist as "you".
- Show, don't tell. Vivid sensory details, dialogue, action.
- ${paragraphs.min}-${paragraphs.max} paragraphs.
- Only include events the protagonist could plausibly observe. No unexplained knowledge of distant events.
- Everything must be physically plausible within the established world.
- Every character — the protagonist included — must act consistently with their established personality, goals, and current motivations.`;

/**
 * Role-specific instruction for the optional director pass.
 *
 * The director runs BEFORE the writer (resolution or world-step) when the
 * `directorEnabled` toggle is on. It produces a short, structured plan
 * that the writer is then told to render faithfully. The point is to keep
 * a strong-prose / weak-plot model from drifting: the grounded analysis
 * model decides what happens, the prose model just writes it.
 *
 * Output is markdown text — NOT prose. The writer's prompt requires it
 * to follow these beats exactly.
 */
/**
 * Shared rules for all director passes. The beat budget scales with the
 * player action's length (see `paragraphRangeForAction`) so the plan stays
 * in sync with the paragraph budget the writer is given — a long action
 * planned as 2–4 beats but written as 4–6 paragraphs would force the
 * writer to pad, and the reverse would compress the scene.
 */
const DIRECTOR_COMMON_RULES = (
  beats: ParagraphRange = DEFAULT_PARAGRAPH_RANGE,
) => `OUTPUT FORMAT — you MUST follow this exactly:
BEATS:
1. <beat>
2. <beat>
3. <beat>
4. <beat>

HARD RULES:
- Output ONLY the numbered BEATS list
- Plan SUBSTANCE, not staging. Each beat names an actor and what they do or communicate at the level of INTENT — what changes, what's revealed, what's demanded. The writer invents the actual words, gestures, movement, and sensory detail that render it.
  GOOD: "He tells her she remembers nothing." / "He makes clear she's safe but not free to leave yet." / "He refuses to say who tied her up."
  BAD:  "He rubs his eyes with thumb and forefinger, pulls a dented flask from his coat, and mutters 'You don't remember a damn thing, do you?'"
- Do NOT script the prose: no quoted or paraphrased dialogue lines, no specific gestures (rubbing eyes, scraping a chair, shoving hands in pockets), no choreographed movement or distances, no sensory description. If you catch yourself writing the sentence the character would say or the move they'd make, stop — state what it ACCOMPLISHES instead.
- ${beats.min}–${beats.max} beats. Each beat is one short sentence: an actor and the gist of their action or message.
- When an on-screen NPC acts or reacts, that IS a beat — name the NPC and the gist of what they do, grounded in their established disposition + motive. Do not break reactions out into a separate list.
- The beats are the whole plan: the writer renders them faithfully and will not invent new beats or fix wonky ones. Make them coherent, in-character, and self-sufficient.`;

export const DIRECTOR_RESOLUTION_INSTRUCTION = (
  beats: ParagraphRange = DEFAULT_PARAGRAPH_RANGE,
) => `YOUR ROLE THIS TURN: Direct the resolution of the player's action.

A separate "writer" model will render your plan as prose. Your job is to decide WHAT HAPPENS — concretely, grounded in the established world, characters, and storyline — so the writer can focus entirely on HOW to write it.

SCOPE OF THIS TURN (resolution):
- Plan the direct, immediate consequences of the player action.

${DIRECTOR_COMMON_RULES(beats)}`;

export const DIRECTOR_WORLD_STEP_INSTRUCTION = (
  beats: ParagraphRange = DEFAULT_PARAGRAPH_RANGE,
) => `YOUR ROLE THIS TURN: Direct the world step.

A separate "writer" model will render your plan as prose. The player's most recent action has already been resolved (see the narrative above). The scene is on a held beat. NOW NPCs and the environment move on their own.

SCOPE OF THIS TURN (world-step):
- Plan how on-screen NPCs act IN CHARACTER — pursuing their own goals, not just reacting.
- MOVE THE SITUATION FORWARD. Each world-step should leave the protagonist's circumstances actually changed — a step closer to a consequence, a decision forced, a fact revealed, a stakes shift — not just re-dressed with fresh atmosphere. Lean slightly toward progress over ambiance, but don't lurch: one real development per turn is plenty.
- Do NOT loop or stall. If a kind of beat has already played in this scene (another stranger looms in to threaten, the same menace gets restated), do something DIFFERENT with it — escalate, resolve, or move past it. Repeating the same beat with new faces is treading water, not pacing.

${DIRECTOR_COMMON_RULES(beats)}`;

export const DIRECTOR_CONTINUE_INSTRUCTION = (
  beats: ParagraphRange = DEFAULT_PARAGRAPH_RANGE,
) => `YOUR ROLE THIS TURN: Direct the next beat of the story.

A separate "writer" model will render your plan as prose. The player has not given an action. NOW the whole scene advances on its own momentum — the protagonist, NPCs, and environment all move forward along their established trajectory.

SCOPE OF THIS TURN (continue):
- Plan how the SCENE advances: the protagonist acts on their own initiative (consistent with their established goals), on-screen NPCs act IN CHARACTER pursuing their own goals, and the situation progresses.
- MOVE THE SITUATION FORWARD. Each beat should leave the protagonist's circumstances actually changed — a step closer to a consequence, a decision forced, a fact revealed, a stakes shift — not just re-dressed with fresh atmosphere. Lean slightly toward progress over ambiance, but don't lurch: one real development per turn is plenty.
- Do NOT loop or stall. If a kind of beat has already played in this scene (another stranger looms in to threaten, the same menace gets restated), do something DIFFERENT with it — escalate, resolve, or move past it. Repeating the same beat with new faces is treading water, not pacing.

${DIRECTOR_COMMON_RULES(beats)}`;

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
Maximum 5 items.`;

// --- Compaction ---

export const COMPACTION_CHUNK_SIZE = 10;
export const VERBATIM_TURN_COUNT = 30;

export const COMPACTION_SYSTEM_INSTRUCTION = `You are summarizing sections of an interactive adventure story. You produce concise, thorough narrative summaries in second person present tense.`;

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

Write 2-4 paragraphs as a flowing narrative summary in present tense.`;

export interface CompactionRange {
  start: number;
  end: number;
  key: string;
}

/**
 * Calculate which turn ranges are eligible for compaction.
 * Turns beyond the last VERBATIM_TURN_COUNT are divided into chunks of COMPACTION_CHUNK_SIZE.
 * Only full chunks (exactly COMPACTION_CHUNK_SIZE turns) are returned.
 */
export function getCompactionRanges(turnCount: number): CompactionRange[] {
  const ranges: CompactionRange[] = [];
  const compactableCount = Math.max(0, turnCount - VERBATIM_TURN_COUNT);
  for (let i = 0; i < compactableCount; i += COMPACTION_CHUNK_SIZE) {
    const end = Math.min(i + COMPACTION_CHUNK_SIZE - 1, compactableCount - 1);
    // Only create a range if we have a full chunk
    if (end - i >= COMPACTION_CHUNK_SIZE - 1) {
      ranges.push({ start: i, end, key: `${i}-${end}` });
    }
  }
  return ranges;
}

/** Build the messages for a compaction LLM call. */
export function buildCompactionMessages(
  turns: AdventureTurn[],
  range: CompactionRange,
): LLMMessage[] {
  const rangeTurns = turns.slice(range.start, range.end + 1);

  const messages: LLMMessage[] = [
    { role: "system", content: COMPACTION_SYSTEM_INSTRUCTION },
  ];

  for (const turn of rangeTurns) {
    if (turn.playerAction) {
      messages.push({ role: "user", content: turn.playerAction });
    }
    messages.push({ role: "assistant", content: turn.narrative });
  }

  messages.push({
    role: "user",
    content: `${COMPACTION_INSTRUCTION}\n\nThe preceding section contains ${rangeTurns.length} turns (turns ${range.start + 1}–${range.end + 1}).`,
  });

  return messages;
}

// --- Live world state ---

export interface LiveWorldState {
  characters?: Record<string, CharacterCard>;
  plotPoints?: Record<string, PlotPoint>;
  agenda?: AgendaItem[];
}

export interface FormatLiveWorldStateOptions {
  /**
   * If true, prefix each entry with its `[id: <id>]` so a tool-calling
   * model can copy the id verbatim into patch_/archive_/remove_ calls.
   * The narrative passes don't need this — they don't call tools — and
   * leaving ids out keeps their prompts a little leaner.
   */
  includeIds?: boolean;
}

/**
 * Format the living world state — characters, plot points, agenda — as a
 * single text block to inject into the narrative prompt. Returns null if
 * there's nothing to show. Archived characters and resolved/abandoned plot
 * points are excluded from the active sections so we don't bloat tokens
 * (they remain in storage for continuity and possible later return).
 */
export function formatLiveWorldState(
  state: LiveWorldState,
  options: FormatLiveWorldStateOptions = {},
): string | null {
  const { includeIds = false } = options;
  const idPrefix = (id: string) => (includeIds ? `[id: ${id}] ` : "");

  const activeChars = Object.values(state.characters ?? {}).filter(
    (c) => !c.archived,
  );
  const activePoints = Object.values(state.plotPoints ?? {}).filter(
    (p) =>
      p.status === "seeded" ||
      p.status === "active" ||
      p.status === "resolving",
  );
  const agenda = state.agenda ?? [];

  if (
    activeChars.length === 0 &&
    activePoints.length === 0 &&
    agenda.length === 0
  ) {
    return null;
  }

  const parts: string[] = [];

  if (activeChars.length > 0) {
    const lines = activeChars.map((c) => {
      const motive = c.motive?.trim() || "—";
      const disposition = c.disposition ?? "indifference";
      const desc = c.description?.trim() || "—";
      return `- ${idPrefix(c.id)}${c.name} (motive: ${motive}; disposition: ${disposition}): ${desc}`;
    });
    parts.push(
      `[CHARACTER ROSTER — currently in or near the story. Disposition is on a 7-step scale toward the protagonist: hatred → hostility → distrust → indifference → warmth → devotion → love.]\n${lines.join("\n")}`,
    );
  }

  if (activePoints.length > 0) {
    // Sort by status order: resolving > active > seeded
    const order = { resolving: 0, active: 1, seeded: 2 } as const;
    const sorted = [...activePoints].sort(
      (a, b) =>
        (order[a.status as keyof typeof order] ?? 99) -
        (order[b.status as keyof typeof order] ?? 99),
    );
    const lines = sorted.map((p) => {
      const desc = p.description?.trim() || "—";
      return `- ${idPrefix(p.id)}(${p.status}) ${p.title}: ${desc}`;
    });
    parts.push(`[ACTIVE PLOT POINTS]\n${lines.join("\n")}`);
  }

  if (agenda.length > 0) {
    const lines = agenda.map((a) => {
      const when = a.when?.trim() || "soon";
      const desc = a.description?.trim() || "—";
      return `- ${idPrefix(a.id)}(${when}) ${desc}`;
    });
    parts.push(
      `[WORLD AGENDA — what's already in motion]\n${lines.join("\n")}`,
    );
  }

  parts.push(
    "The narrative must respect this state. NPC dispositions, motives, and the world agenda do not flex to the protagonist's preferences. Carry items forward; do not invent contradictions. Agenda items WILL happen on the timing shown unless the protagonist directly intervenes.",
  );

  return parts.join("\n\n");
}

/** Append a system message with the live world state, if any. */
function appendLiveWorldState(
  messages: LLMMessage[],
  state: LiveWorldState | undefined,
): void {
  if (!state) return;
  const block = formatLiveWorldState(state);
  if (!block) return;
  messages.push({
    role: "system",
    content: `[LIVE WORLD STATE — current as of this turn]\n\n${block}`,
  });
}

/**
 * Append a system message with the synthesized global storyline, if any.
 *
 * NOTE: Currently NOT called by the resolution / world-step / revision
 * builders. Earlier iterations fed the synthesized story arc directly
 * into story generation, but the model could not reliably keep the arc's
 * hidden information off the page — named factions, financiers, and
 * off-screen figures kept leaking into dialogue and narration regardless
 * of how strictly the wrapper framed it. The synthesis pass still runs
 * and the storyline is still surfaced in the UI; it just no longer
 * travels into the narrative passes directly.
 *
 * Kept here as the canonical "treat this as author-side bible" wrapper
 * for a future secondary pass — e.g. an agenda-scheduling step that gets
 * the storyline + the story so far and proposes world-agenda items
 * without ever being asked to produce on-page prose. That kind of pass
 * can safely consume the arc; story generation can't.
 */
export function appendStoryline(
  messages: LLMMessage[],
  storyline?: string,
): void {
  const trimmed = storyline?.trim();
  if (!trimmed) return;
  messages.push({
    role: "system",
    content: `[STORY ARC — the hidden architecture of what is actually going on across this story: who runs the antagonist machinery, why this matters to them, how it operates, what the protagonist has actually walked into. The plot points above show only the visible fragments; this section is the worldbuilding scaffolding underneath them.

The arc itself is wrapped in <story-arc>...</story-arc> tags below. Read the contents as authoritative author-side knowledge that INFORMS your narration but is NOT itself something the protagonist or any on-screen character knows. Treat it the way a novelist treats their own series bible: it shapes every scene, but it never appears as exposition the characters can recite.

HARD RULES for the contents of <story-arc>:
- DO NOT have any character — protagonist, NPC, narrator-aside — state, think, suspect, deduce, or otherwise reveal information from the arc that they have no in-story basis to know. The protagonist's interior monologue is bound by what she has actually witnessed, been told, or could plausibly infer; not by what the arc tells YOU.
- DO NOT name factions, organizations, hierarchies, financiers, or off-screen figures from the arc until the narrative has earned that reveal through someone the protagonist could believably have heard it from.
- DO NOT let the narrator (third-person voice) narrate from the arc's omniscient vantage. The narrator stays close to the protagonist's perceptual range unless an explicit POV shift is in motion.
- DO NOT echo arc phrasing into the prose — even paraphrased. If the arc says "the Veiled Hand operates out of the dock wards under magistrate Verro," that name and that structure stay off-page until the story surfaces them organically.

DO use the arc to:
- Make NPCs act with the awareness of their actual position in this structure (a corrupt magistrate's bagman behaves like a corrupt magistrate's bagman even before the protagonist learns the magistrate exists; a fixer takes the calls a fixer would take).
- Pick consistent off-screen consequences, timing, and reactions — when the antagonist machinery would mobilise, who would notice what, where pressure comes from next.
- Choose scene details, ambient cues, overheard fragments, and small props that are quietly consistent with the arc, so the world feels coherent even before any of it is named.
- Avoid contradicting established arc facts. If the arc says X is true, do not write a scene where X is false.

Reveal pieces of this on screen ONLY as the scene naturally allows — through evidence, dialogue with someone who'd actually know, the protagonist piecing things together from real clues. Slow burn over info-dump, every time. Do not contradict the arc without a clear in-narrative reason.]

<story-arc>
${trimmed}
</story-arc>`,
  });
}

/**
 * Append a per-turn FILTERED storyline brief, if any. Produced by the
 * storyline-gate pass — a triage step that takes the full storyline and
 * returns only the slice that is actually visible or in-play for the next
 * narrative beat. By construction the brief should already be safe to
 * surface (anything the gate considers off-limits has been omitted), so
 * the wrapper rules are lighter than `appendStoryline`'s.
 *
 * Empty brief = nothing relevant from the arc this turn = no message.
 * The gate is allowed (and encouraged) to return nothing.
 */
function appendStorylineBrief(messages: LLMMessage[], brief?: string): void {
  const trimmed = brief?.trim();
  if (!trimmed) return;
  // Guard against the gate echoing "NONE" or similar in-band sentinels —
  // we expect the engine to have stripped these, but defend anyway.
  if (/^(none|n\/a|nothing)\.?$/i.test(trimmed)) return;
  messages.push({
    role: "system",
    content: `[BACKGROUND INFORMATION — context an upstream pass has judged relevant or visible to the next beat, drawn from the story so far. The full author-side arc is NOT in this prompt; only what's listed here is safe to factor into your narration. Treat the items below as either (a) facts the protagonist or current scene has earned and may surface, or (b) off-screen pressures that may shape NPC behaviour and ambient detail without being named on-page. Use this, but do not invent additional detail beyond it — anything not listed here stays off the page this turn. If it's empty/short, that means little or nothing applies right now; narrate accordingly.]

<background-information>
${trimmed}
</background-information>`,
  });
}

/**
 * Append a director brief as a system message that the writer pass MUST
 * follow. Lives outside the cached prefix (every turn produces a fresh
 * brief) and BELOW the role instruction in the message list so it lands
 * close to the final user message — i.e. the model reads it last before
 * generating prose.
 */
function appendDirectorBrief(messages: LLMMessage[], brief?: string): void {
  const trimmed = brief?.trim();
  if (!trimmed) return;
  messages.push({
    role: "system",
    content: `[DIRECTOR BRIEF — a separate, more grounded model has planned the beats of this turn for you. Render this plan as prose. Follow the BEATS in the order listed. Do NOT invent new beats not listed here, do NOT skip beats listed here, do NOT have NPCs do things the brief did not authorize. The listed beats decide what happens and roughly where the scene lands; everything else — voice, sensory detail, dialogue rhythm, paragraph shape, and how the scene comes to rest beyond the final beat — is yours. If the director brief and the background information disagree on a detail, prefer the director brief — it was written with both in view.]

<director-brief>
${trimmed}
</director-brief>`,
  });
}

// --- Prompt construction helpers ---

/**
 * Append the author directive as a system message near the end of the
 * prompt, so it keeps recency over the cached history but doesn't sit in
 * the user-role slot. (Earlier versions injected this as a user message;
 * instruction-tuned models read that as a turn they were expected to
 * respond to, and we'd see acknowledgements like "[Acknowledged —
 * following directive for this turn]" leak into the narrative.)
 *
 * The wrapper text is deliberately terse and contains no language the
 * model could mistake for content it should comply-with-and-confirm.
 */
function appendDirective(messages: LLMMessage[], directive?: string): void {
  const trimmed = directive?.trim();
  if (!trimmed) return;
  messages.push({
    role: "system",
    content: `Standing author directive — apply these constraints silently to the narrative you are about to produce. Do not acknowledge, restate, summarize, or reply to this message; output prose only.

${trimmed}`,
  });
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
  /** When true, prefer the deuteragonist's narrative for split turns. */
  forDeuteragonist?: boolean,
): LLMMessage[] {
  const messages: LLMMessage[] = [];

  // Shared system prompt — cache breakpoint: static across all calls and turns
  // If there's a world bible, combine it with the base prompt under the same
  // cache breakpoint so the entire static prefix is cached together.
  const worldBibleTrimmed = worldBible?.trim();
  messages.push({
    role: "system",
    content: worldBibleTrimmed
      ? `${BASE_SYSTEM_PROMPT}\n\n[WORLD BIBLE — persistent reference for the world, characters, and lore]\n${worldBibleTrimmed}`
      : BASE_SYSTEM_PROMPT,
    cache_control: { type: "ephemeral", ttl: "1h" },
  });

  const ranges = getCompactionRanges(turns.length);
  const recentStart = Math.max(0, turns.length - VERBATIM_TURN_COUNT);

  // Older turns: use compaction summaries where available, otherwise verbatim
  for (const range of ranges) {
    const comp = compactions?.[range.key];
    if (comp?.summary) {
      // Compacted: insert summary as a user/assistant pair
      messages.push({
        role: "user",
        content: `[Previous events summary]: ${comp.summary}`,
      });
      messages.push({
        role: "assistant",
        content: "[Acknowledged — continuing story]",
      });
    } else {
      // Not yet compacted: include original turns
      for (let i = range.start; i <= range.end; i++) {
        addTurnToMessages(messages, turns, i, false, settingDescription);
      }
    }
  }

  // Gap turns: between the last compaction range and the verbatim window
  // (partial chunk not yet eligible for compaction)
  const compactedEnd =
    ranges.length > 0 ? ranges[ranges.length - 1].end + 1 : 0;
  for (let i = compactedEnd; i < recentStart; i++) {
    addTurnToMessages(messages, turns, i, false, settingDescription, forDeuteragonist);
  }

  // Recent turns: always verbatim
  for (let i = recentStart; i < turns.length; i++) {
    const isLastTurn = i === turns.length - 1;
    addTurnToMessages(messages, turns, i, isLastTurn, settingDescription, forDeuteragonist);
  }

  return messages;
}

/** Helper: append a single turn's messages to the array.
 *
 * @param forDeuteragonist - When true, for split turns the deuteragonist's
 *   narrative is used as the primary assistant message instead of the
 *   protagonist's, and the protagonist's narrative is omitted (the
 *   deuteragonist wouldn't know what happened to the protagonist while
 *   they were apart). The `[Meanwhile, with the deuteragonist:]` message
 *   is also skipped since the deuteragonist's story IS the main story here.
 */
function addTurnToMessages(
  messages: LLMMessage[],
  turns: AdventureTurn[],
  i: number,
  addCacheBreakpoint: boolean,
  settingDescription?: string,
  forDeuteragonist?: boolean,
): void {
  const turn = turns[i];

  // When building context for the deuteragonist, use their narrative for
  // split turns — they wouldn't know what the protagonist did while apart.
  const useDeuteragonistView = forDeuteragonist && turn.deuteragonistNarrative;

  if (turn.playerAction && !useDeuteragonistView) {
    messages.push({ role: "user", content: turn.playerAction });
  } else if (i === 0) {
    // Include the setting description in the opening turn so all consumers
    // see the world context.
    const openingContent = settingDescription
      ? `Begin the adventure.\n\n${settingDescription}`
      : "Begin the adventure.";
    messages.push({
      role: "user",
      content: openingContent,
    });
  } else if (useDeuteragonistView) {
    // For the deuteragonist's view of a split turn: nudge that time passed
    // while they were apart, rather than showing the protagonist's action.
    messages.push({
      role: "user",
      content: "[The deuteragonist acts independently while separated from the protagonist.]",
    });
  }

  messages.push({
    role: "assistant",
    content: useDeuteragonistView ? turn.deuteragonistNarrative! : turn.narrative,
    ...(addCacheBreakpoint
      ? { cache_control: { type: "ephemeral" as const, ttl: "1h" as const } }
      : {}),
  });

  // Append the opposite narrative as context only when NOT in deuteragonist
  // view — the protagonist's future turns benefit from knowing what happened
  // with the deuteragonist. But when building the deuteragonist's own
  // history, skip the protagonist's narrative (they don't know it).
  if (turn.deuteragonistNarrative && !forDeuteragonist) {
    messages.push({
      role: "assistant",
      content: `[Meanwhile, elsewhere:]\n${turn.deuteragonistNarrative}`,
    });
  } else if (useDeuteragonistView) {
    // In deuteragonist view, the protagonist's narrative is the "other side"
    // — omit it since the deuteragonist wouldn't know it.
  }
}

/**
 * Build messages for the deuteragonist action LLM call.
 *
 * This call asks the LLM what the partner character wants to do, given
 * the story history, their personality, the player's current action,
 * and the current world state. The result is fed into the resolution
 * pass alongside the player's action so both play out in the same scene.
 */
export function buildPartnerActionMessages(
  turns: AdventureTurn[],
  settingDescription: string,
  playerAction: string,
  deuteragonistInput: string,
  compactions?: Record<string, AdventureCompaction>,
  worldBible?: string,
  liveWorldState?: LiveWorldState,
  conditions?: string,
): LLMMessage[] {
  const deutName = extractName(deuteragonistInput, "the deuteragonist");
  const messages = buildSharedHistory(turns, compactions, settingDescription, worldBible);

  appendLiveWorldState(messages, liveWorldState);
  appendConditions(messages, conditions);

  // Show what the protagonist just did — the partner responds to this
  messages.push({ role: "user", content: `Protagonist action this turn: ${playerAction}` });

  // Provide the deuteragonist personality for context
  messages.push({
    role: "system",
    content: `${deutName} (deuteragonist): ${deuteragonistInput}`,
  });

  // Instruction message (as a user message for recency)
  messages.push({ role: "user", content: PARTNER_ACTION_INSTRUCTION });

  return messages;
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
  liveWorldState?: LiveWorldState,
  conditions?: string,
  storylineBrief?: string,
  directorBrief?: string,
  /** The deuteragonist's intended action for this turn, if one is configured. */
  partnerAction?: string,
  /** Live protagonist description from the store (always injected). */
  protagonistInput?: string,
  /** Live deuteragonist description from the store (always injected). */
  deuteragonistInput?: string,
  /** When true, the party is split — the deuteragonist is NOT present in this scene. */
  partySplit?: boolean,
): LLMMessage[] {
  const messages = buildSharedHistory(
    turns,
    compactions,
    settingDescription,
    worldBible,
  );

  const isOpeningTurn = turns.length === 0 && playerAction === null;

  // Live protagonist & deuteragonist descriptions — always injected, even
  // without the living-world toggle. Edits from the Story panel reach
  // every turn because we read the store's current values, not the frozen
  // setting description. Uses extracted names as labels so the model
  // consistently refers to characters by name.
  {
    const parts: string[] = [];
    if (protagonistInput?.trim()) {
      const protagName = extractName(protagonistInput, "the protagonist");
      parts.push(`${protagName.toUpperCase()} (protagonist): ${protagonistInput.trim()}`);
    }
    if (deuteragonistInput?.trim()) {
      const deutName = extractName(deuteragonistInput, "the deuteragonist");
      parts.push(`${deutName.toUpperCase()} (deuteragonist): ${deuteragonistInput.trim()}`);
    }
    if (parts.length > 0) {
      messages.push({
        role: "system",
        content: `[CHARACTER PROFILES — live descriptions; prefer these over any stale version in the opening turn]\n\n${parts.join('\n\n')}`,
      });
    }
  }

  // Live world state goes BEFORE the role-specific system message so the
  // model sees current characters, plot points, and agenda right next to
  // its instructions for the turn. Lives outside the cache breakpoint
  // because it changes turn-to-turn.
  appendLiveWorldState(messages, liveWorldState);
  appendConditions(messages, conditions);
  appendStorylineBrief(messages, storylineBrief);

  // Role instruction + core directive + steering guidance (if any) + party-split
  // context (if applicable) in one system message that lives AFTER the cacheable
  // history — the steering text changes every turn, so it must not be inside the
  // cached prefix.
  const steeringBlock = steering ? `\n\n${steeringGuidance(steering)}` : "";
  const paragraphRange = paragraphRangeForAction(playerAction);
  const protagName = extractName(protagonistInput, "the protagonist");
  const deutName = extractName(deuteragonistInput, "the deuteragonist");
  const partySplitBlock = partySplit
    ? `\n\nPARTY STATE: The party is split — ${protagName} and ${deutName} are in different locations, each experiencing their own scene simultaneously.

Generate BOTH scenes in a single response. Wrap each in its own XML tag:

<protagonist>
[Narrative of what ${protagName} experiences — second person, present tense, addressing ${protagName} as "you". ${paragraphRange.min}-${paragraphRange.max} paragraphs.]
</protagonist>

<deuteragonist>
[Narrative of what ${deutName} experiences simultaneously — third person, present tense, using ${deutName}'s name. 1-3 paragraphs.]
</deuteragonist>

Each section must be a complete, self-contained narrative. Do NOT add any text outside the tags. Do NOT nest the tags.`
    : "";
  messages.push({
    role: "system",
    content: `${RESOLUTION_INSTRUCTION(paragraphRange)}\n\n${CORE_DIRECTIVE}${steeringBlock}${partySplitBlock}`,
  });

  // Director brief (if the two-model flow is enabled) lands AFTER the role
  // instruction and BEFORE the user message, so the model reads its
  // explicit plan last before generating prose.
  appendDirectorBrief(messages, directorBrief);

  // Author directive first, so the player action remains the message the
  // model is actually replying to.
  appendDirective(messages, turnDirective);

  // Deuteragonist action (if any) — tells the model what the partner
  // intends to do. When the party is together, weave both actions into
  // the same scene. When split, the deuteragonist's action drives the
  // <deuteragonist> section.
  if (partnerAction) {
    if (partySplit) {
      messages.push({
        role: "system",
        content: `[${deutName} intends: ${partnerAction}]\n\nUse this as ${deutName}'s driving action for the <deuteragonist> section.`,
      });
    } else {
      messages.push({
        role: "system",
        content: `[${deutName} intends: ${partnerAction}]\n\nWeave this into the narrative alongside ${protagName}'s action. Both characters' actions play out simultaneously — they may cooperate, conflict, talk to each other, pursue separate goals, or react to each other's words and deeds. Write naturally in second person for ${protagName}, and refer to ${deutName} by their name or description.`,
      });
    }
  }

  // Final user message
  if (playerAction !== null) {
    const splitHint = partySplit
      ? `\n\nThe protagonist and deuteragonist are now splitting up. Render both scenes as described above.`
      : "";
    messages.push({ role: "user", content: `Protagonist action: ${playerAction}${splitHint}` });
  } else if (isOpeningTurn) {
    messages.push({
      role: "user",
      content: `Begin the adventure. Here is the setting — use it as a springboard, expand on it with your own details, and establish the protagonist in the world.

The opening should introduce the protagonist through action and detail — show what they look like, how they carry themselves, and hint at their personality through their behavior or inner thoughts. Don't state traits outright; reveal them through the scene.

${settingDescription}`,
    });
  }

  return messages;
}

/**
 * Build messages for the optional director pass.
 *
 * Same context as the writer (`buildResolutionMessages` or
 * `buildWorldStepMessages` — shared history, live world state, storyline
 * brief, author directive), but the system instruction asks for a
 * structured plan instead of prose. The writer call on the same turn then
 * re-uses the shared history's cached prefix.
 *
 * For `'resolution'` the player action lands as the final user message.
 * For `'world-step'` we end with a terse user nudge mirroring
 * `buildWorldStepMessages` — the director sees the freshly-finalized
 * resolution narrative as the last assistant message in the shared
 * history and plans the world's response to it.
 *
 * The director receives the steering bucket so it can frame BEATS to
 * reflect the protagonist's execution quality, but it must NOT use
 * steering to change NPC dispositions or world neutrality (the
 * `DIRECTOR_RESOLUTION_INSTRUCTION` enforces this).
 */
export function buildDirectorMessages(
  turns: AdventureTurn[],
  settingDescription: string,
  playerAction: string | null,
  steering: SteeringBucket | undefined,
  kind: "resolution" | "world-step" | "continue",
  turnDirective?: string,
  compactions?: Record<string, AdventureCompaction>,
  worldBible?: string,
  liveWorldState?: LiveWorldState,
  conditions?: string,
  storylineBrief?: string,
): LLMMessage[] {
  const messages = buildSharedHistory(
    turns,
    compactions,
    settingDescription,
    worldBible,
  );

  appendLiveWorldState(messages, liveWorldState);
  appendConditions(messages, conditions);
  appendStorylineBrief(messages, storylineBrief);

  // Beat budget mirrors the writer's paragraph budget: the current action
  // for a resolution, the most recent real action otherwise.
  const beatRange = paragraphRangeForAction(
    kind === "resolution" ? playerAction : lastPlayerAction(turns),
  );
  const instruction =
    kind === "world-step"
      ? DIRECTOR_WORLD_STEP_INSTRUCTION(beatRange)
      : kind === "continue"
        ? DIRECTOR_CONTINUE_INSTRUCTION(beatRange)
        : DIRECTOR_RESOLUTION_INSTRUCTION(beatRange);
  // Steering only frames the protagonist's execution quality on the
  // resolution pass — world-step is neutral and gets no steering block.
  const steeringBlock =
    kind === "resolution" && steering
      ? `\n\n${steeringGuidance(steering)}`
      : "";

  // Standing author directive first — it constrains the plan but doesn't drive
  // the turn.
  appendDirective(messages, turnDirective);

  // Then the player action (or a terse nudge naming the beat to plan when there
  // is no action).
  if (kind === "resolution" && playerAction !== null) {
    messages.push({ role: "user", content: playerAction });
  } else {
    messages.push({
      role: "user",
      content:
        kind === "world-step"
          ? "Plan the world step. The scene above just ended on a held beat. What concretely happens next, in plan form?"
          : kind === "continue"
            ? "Plan the next beat. The scene above is on a held beat and no player action is coming — let the protagonist, NPCs, and world all advance along their established trajectory. What concretely happens next, in plan form?"
            : "Plan the opening turn. Establish the protagonist in the scene; produce the plan in the requested format.",
    });
  }

  // Director role instruction LAST, as a USER message rather than a system
  // message at the end of the prompt. As a trailing system message the director
  // loses track of it and just continues the story; as the final user turn it
  // sits right behind the action and the standing directive, where the model
  // reliably treats it as the task for this turn.
  messages.push({
    role: "user",
    content: `${instruction}${steeringBlock}`,
  });

  return messages;
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
  liveWorldState?: LiveWorldState,
  conditions?: string,
  storylineBrief?: string,
  directorBrief?: string,
  /** Live protagonist description from the store (always injected). */
  protagonistInput?: string,
  /** Live deuteragonist description from the store (always injected). */
  deuteragonistInput?: string,
  /**
   * Which autonomous pass this is. 'world-step' (default) holds the
   * protagonist still and lets only the world/NPCs react; 'continue' advances
   * the whole scene — protagonist included — on its own momentum. Picks the
   * role instruction and closing user nudge.
   */
  mode: "world-step" | "continue" = "world-step",
): LLMMessage[] {
  const messages = buildSharedHistory(
    turns,
    compactions,
    settingDescription,
    worldBible,
  );

  // Live protagonist & deuteragonist descriptions — always injected.
  {
    const parts: string[] = [];
    if (protagonistInput?.trim()) {
      const protagName = extractName(protagonistInput, "the protagonist");
      parts.push(`${protagName.toUpperCase()} (protagonist): ${protagonistInput.trim()}`);
    }
    if (deuteragonistInput?.trim()) {
      const deutName = extractName(deuteragonistInput, "the deuteragonist");
      parts.push(`${deutName.toUpperCase()} (deuteragonist): ${deuteragonistInput.trim()}`);
    }
    if (parts.length > 0) {
      messages.push({
        role: "system",
        content: `[CHARACTER PROFILES — live descriptions; prefer these over any stale version in the opening turn]\n\n${parts.join('\n\n')}`,
      });
    }
  }

  appendLiveWorldState(messages, liveWorldState);
  appendConditions(messages, conditions);
  appendStorylineBrief(messages, storylineBrief);

  // No fresh player action in this pass — scale the narrative budget off
  // the most recent real action, since the world is responding to it.
  const paragraphRange = paragraphRangeForAction(lastPlayerAction(turns));
  messages.push({
    role: "system",
    content: mode === "continue" ? CONTINUE_STORY_INSTRUCTION(paragraphRange) : WORLD_STEP_INSTRUCTION(paragraphRange),
  });

  // Director brief (if the two-model flow is enabled) lands AFTER the role
  // instruction and BEFORE the user nudge, so the writer reads the plan
  // last before producing prose.
  appendDirectorBrief(messages, directorBrief);

  // Author directive first, so the world-step nudge remains the message the
  // model is actually replying to.
  appendDirective(messages, turnDirective);

  // Terse user nudge — keeps the assistant/user alternation legal and
  // signals the phase change explicitly to the model.
  messages.push({
    role: "user",
    content:
      mode === "continue"
        ? 'Now continue the story. Let the scene advance on its own momentum — the protagonist, the NPCs, and the world all move forward along their established trajectory. Do not wait for the protagonist to be prompted. Continue in second person, present tense — the protagonist remains "you".'
        : 'Now let the world respond. NPCs act in character; the environment shifts only where it would naturally. Continue in second person, present tense — the protagonist remains "you", just as in the resolution narrative above.',
  });

  return messages;
}

export function buildNonsenseCheckMessages(
  latestNarrative: string,
  settingDescription?: string,
  directive?: string,
): LLMMessage[] {
  const messages: LLMMessage[] = [];

  // Provide world context so the checker knows what's possible in this story
  const worldContext = [settingDescription, directive]
    .filter(Boolean)
    .join("\n\n");
  if (worldContext) {
    messages.push({
      role: "system",
      content: `This is the world context for the story being checked. Use it to understand what is possible in this setting — magic, technology, supernatural abilities, etc. Only flag things that don't make sense even within these rules.\n\n${worldContext}`,
    });
  }

  messages.push({ role: "assistant", content: latestNarrative });
  messages.push({ role: "user", content: NONSENSE_CHECK_INSTRUCTION });

  return messages;
}

export function buildRevisionMessages(
  turns: AdventureTurn[],
  settingDescription: string,
  playerAction: string | null,
  originalNarrative: string,
  inconsistencies: string,
  steering: SteeringBucket | undefined,
  kind: "resolution" | "world-step" | "continue",
  turnDirective?: string,
  compactions?: Record<string, AdventureCompaction>,
  worldBible?: string,
  liveWorldState?: LiveWorldState,
  conditions?: string,
): LLMMessage[] {
  const messages = buildSharedHistory(
    turns,
    compactions,
    settingDescription,
    worldBible,
  );

  appendLiveWorldState(messages, liveWorldState);
  appendConditions(messages, conditions);

  // Steering only applies to resolution passes — it describes the quality
  // of the protagonist's execution, which world-step passes don't generate.
  const steeringBlock =
    kind === "resolution" && steering
      ? `\n\n${steeringGuidance(steering)}`
      : "";
  const paragraphRange = paragraphRangeForAction(
    kind === "resolution" ? playerAction : lastPlayerAction(turns),
  );
  const roleInstruction =
    kind === "world-step"
      ? WORLD_STEP_INSTRUCTION(paragraphRange)
      : kind === "continue"
        ? CONTINUE_STORY_INSTRUCTION(paragraphRange)
        : RESOLUTION_INSTRUCTION(paragraphRange);
  messages.push({
    role: "system",
    content: `${roleInstruction}\n\n${CORE_DIRECTIVE}${steeringBlock}`,
  });

  const isOpeningTurn = turns.length === 0 && playerAction === null;

  // Author directive first, so the player action remains the message the
  // model originally responded to (matches the live build order).
  appendDirective(messages, turnDirective);

  if (playerAction !== null) {
    messages.push({ role: "user", content: playerAction });
  } else if (isOpeningTurn) {
    messages.push({
      role: "user",
      content: `Begin the adventure. Here is the setting — use it as a springboard, expand on it with your own details, and establish the protagonist in the world.

The opening should introduce the protagonist through action and detail — show what they look like, how they carry themselves, and hint at their personality through their behavior or inner thoughts. Don't state traits outright; reveal them through the scene.

${settingDescription}`,
    });
  }

  // Place the original narrative as an assistant message, then ask for revision
  messages.push({
    role: "assistant",
    content: originalNarrative,
  });

  messages.push({
    role: "user",
    content: `REVISION REQUIRED — the narrative above contains factual inconsistencies with the established story:

${inconsistencies}

Please rewrite the narrative, fixing ONLY the listed inconsistencies. Keep the same overall scene, pacing, and events — just correct the contradictions. Write the complete revised narrative.`,
  });

  return messages;
}

// --- Parse helpers ---

/**
 * Parse a split-party response into protagonist and deuteragonist narratives.
 * Expects `<protagonist>...</protagonist>` and `<deuteragonist>...</deuteragonist>`
 * tags. Falls back to treating the whole text as protagonist narrative if tags
 * are missing or malformed.
 */
export function parseSplitNarrative(
  raw: string,
): { protagonist: string; deuteragonist: string | undefined } {
  const protagMatch = raw.match(/<protagonist>([\s\S]*?)<\/protagonist>/i);
  const deutMatch = raw.match(/<deuteragonist>([\s\S]*?)<\/deuteragonist>/i);

  const stripThink = (s: string) => s.replace(/<think>[\s\S]*?<\/think>/g, "");

  const protagonist = protagMatch
    ? stripThink(protagMatch[1]).trim()
    : // No tags found — treat the whole thing as protagonist narrative
      raw
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .replace(/<\/?(?:protagonist|deuteragonist|narrative)>/g, "")
        .trim();

  const deuteragonist = deutMatch
    ? stripThink(deutMatch[1]).trim() || undefined
    : undefined;

  return { protagonist, deuteragonist };
}

export function cleanNarrative(raw: string): string {
  // Strip any XML tags the model might still produce out of habit
  return raw
    .replace(/<\/?narrative>/g, "")
    .replace(/<\/?protagonist>/g, "")
    .replace(/<\/?deuteragonist>/g, "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .trim();
}

// --- Analysis pass (Phase 2) ---

/**
 * System prompt for the analysis pass. The cheap model reads recent
 * narrative + the current world state, and emits zero or more tool calls
 * to update characters / plot points / agenda. Biased HARD toward inaction
 * — the world state is the user's authoring artifact, and a noisy analysis
 * pass that hallucinates updates is far worse than a quiet one.
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are the world-state curator for an interactive adventure. Your job is to keep a small structured record (characters, plot points, agenda items) in sync with the story — and, when a new character or hook appears, to FLESH IT OUT into a coherent world-state entry.

You are NOT writing prose. You are reading the recent narrative against the world so far and emitting precise tool calls.

There are two distinct modes you operate in, and they have OPPOSITE biases:

**ADDS — fill in the gaps the narrative didn't.** The narrative shows fragments: a name, a profession, an action, a line of dialogue. Your job for \`add_character\` and \`add_plot_point\` is to turn those fragments into a complete, plausible entry — INCLUDING parts the narrative never spelled out. Description, motive, personality, skills, backstory hooks: invent what's missing, grounded in the setting and the world bible. A bartender who handed the protagonist a drink should NOT be added with description = "handed the protagonist a drink"; they should be added with a paragraph that fits the setting (a weary widower running his late wife's tavern, etc.) and a one-sentence motive that explains what drives them. Be a *novelist* here, not a summarizer.

**WHAT BELONGS IN A "DESCRIPTION" FIELD — read this carefully.** Descriptions describe WHO a character (or protagonist) IS, not what they have DONE. Identity, not event log. The right content is: physical appearance, age range, build, voice, mannerisms, dress; personality traits; relevant skills, training, profession; defining background, origin, formative relationships; the kind of person they are when nothing is happening to them. The WRONG content is: a recap of what they did this scene, what they're currently carrying, who they just killed, where they just walked, what mood they're in right now. Recent events live in the prose; the description is the page in the cast bible that stays true across many scenes. If you find yourself writing "after killing X, she now..." — stop, you are summarizing the situation, not describing the person. Ask instead: who IS she, of which "killed X" is one expression?

**PATCHES — stay quiet unless the story actually shifted things.** For \`patch_character\` / \`patch_plot_point\` / \`patch_agenda_item\`, the bias flips: most turns produce zero patch calls. Only patch when the narrative MAKES the change explicit AND that change is lasting (a standing relational shift, a plot status advance, an agenda time-shift). Momentary reactions belong in the prose, not in patches.

PRINCIPLES (read carefully — these are the rules of your job):

1. **Inaction is the default for PATCHES; invention is the default for ADDS.** If a turn introduced a meaningful new named character or hook that isn't already on the roster, you SHOULD add them — and you should fill out their card properly, not parrot the narrative. If a turn merely showed existing characters reacting to events without any standing change, emit nothing. Silence on patches is correct; silence on a clear new introduction is failure.

2. **Patches only when the narrative is explicit and the change is standing.** "The bartender frowns" is not a motive change. A character whose disposition was \`warmth\` and who now actively pursues the protagonist's harm has shifted to \`hostility\` or below — patch that. A character whose disposition was \`indifference\` and who now fumbles a polite greeting has not shifted at all. Disposition is a STANDING stance, not a momentary reaction.

3. **Keep patch updates minimal — but DO patch when state has actually moved.** Use \`patch_character\` / \`patch_plot_point\` / \`patch_agenda_item\` to change ONLY the fields that actually need to change. Empty/unspecified fields are left untouched. Don't rewrite a description for style or to summarize the same situation in different words. **However: "the status didn't change" is NOT the same as "nothing to patch."** A plot point's description can go stale while its status holds — a tracker destroyed, a hostage moved, a face put on a previously-faceless threat, evidence gained, a deadline tightened. When the *situation inside* the plot point has materially shifted such that the existing description is now lying about where things stand, you patch the description even though status stays the same. Same logic for \`patch_character\` (a character has gained or lost a defining capability, an established relationship has shifted permanently) and \`patch_agenda_item\` (the timing has shifted, the trigger condition has changed). The bias against patching is against *cosmetic* patches and *transient mood* patches, not against keeping the world state factually current.

   **One exception that IS active patch work, not "stay quiet" work: identity catch-up.** If a character is on the roster under a placeholder name like "the girl with zip ties", "the bartender", "the masked rider", "Stranger" — and the narrative has now revealed their actual name, profession, role, or other defining identity detail — patch_character it IMMEDIATELY. The placeholder existed only because we didn't know yet; the moment we know, the roster should reflect it. Update \`name\` to the real name, and tighten \`description\` if the new identity meaningfully reframes who this person is. Same for plot points titled with placeholders. This is not invention; it is bookkeeping the analysis pass exists to do.

4. **For adds: extrapolate, don't transcribe.** Only \`add_character\` for a named character who has spoken or taken meaningful action AND isn't already on the roster (check the roster carefully — slight name variations are usually the same person). When you DO add: invent a description that fits the world (one paragraph: appearance, personality, voice, relevant skills), give them a motive that makes sense for who they appear to be, and pick a disposition consistent with how they treated the protagonist. If the story has only shown a fragment, invent the rest — coherently with the setting, the world bible, and the protagonist. The same applies to \`add_plot_point\`: spell out the hook, who it touches, what it points toward — beyond what the narrative literally said. Only \`add_agenda_item\` for a concrete, scheduled event the world is already in motion on.

5. **Advance plot points by status — AND keep their descriptions current.** Two independent reasons to \`patch_plot_point\`; either one alone is sufficient.

   **(a) Status advance.** When the plot point's lifecycle stage has shifted:
   - \`seeded\` → \`active\`: it's now in motion
   - \`active\` → \`resolving\`: paying off this scene
   - any → \`resolved\`: it's finished

   **(b) Description refresh.** The status doesn't have to change for the description to need updating. When the *situation inside* the plot point has materially shifted — a key fact about it has been added, removed, or reframed by the narrative — patch the description. Examples that warrant a description patch with NO status change: a tracker the antagonist was using has been destroyed (the chase continues, but the *means* are different), a hostage has been moved, a deadline has tightened, a name or face has been added to a previously-anonymous threat, an ally has been lost or gained, the protagonist now holds evidence they didn't before. The plot point still describes the same hook, but the description from two turns ago is now factually stale. Update it. The hook is what consumers of this state read to know where things actually stand — leaving it stale defeats the purpose of having it.

   The two cases are independent. Status-only patches, description-only patches, and both-at-once are all valid and common. The mistake to avoid is concluding "status didn't change, therefore no patch" when the description is now lying about the current situation.

   When a plot point has been explicitly dropped or made impossible by the narrative, call \`remove_plot_point\` instead of patching status. There is no "abandoned" status — abandonment IS removal.

6. **Remove agenda items that have happened or been pre-empted.** If "the watch will arrive" actually happened in the narrative, call \`remove_agenda_item\` for it. If the protagonist's action made the agenda item impossible, also remove it.

7. **Archive characters who leave the story.** If a character explicitly departs, dies, or is otherwise off-screen for the foreseeable future, call \`archive_character\` (don't \`remove\` them — keep them on file for continuity).

8. **Use existing IDs.** When patching/archiving/advancing, you MUST use the exact ID shown in the world-state input. Do not invent IDs for patches.

9. **Multiple tool calls are fine** when the narrative warrants it. But err on the side of fewer.

10. **Patch the protagonist in three cases — and only these three.** The protagonist description is the page in the cast bible for who the protagonist IS. Identity, not situation. Use \`patch_protagonist\` when ONE of:
    - **(a) Identity catch-up.** The narrative has now anchored WHO the protagonist is in ways the existing description doesn't capture: appearance, age, build, voice, mannerisms, profession, training, defining background, formative relationships, signature traits. Fold those in. A stub like "A young woman" SHOULD be expanded once the story has shown her in action enough to know who she is. An empty description is the strongest case of this.
    - **(b) Identity correction.** The current description has drifted into situation-summary ("a paramedic who is now hunted by traffickers", "a woman fleeing the warehouse") instead of identity. That is a malformed description. Rewrite it to describe the PERSON — what's durable about her — and let the situation live in the prose, plot points, and storyline where it belongs. Strip out event-log content; replace with character.
    - **(c) Fundamental identity change.** A permanent injury, a profession change, a major identity shift, a transformation, the gain or loss of a defining capability. The kind of thing that would re-cast her in any future scene, not just this one.

    **WHAT TO WRITE INTO THE DESCRIPTION.** Identity content: appearance, voice, mannerisms, dress, personality, skills, training, profession, defining background and relationships, the kind of person she is when nothing is happening to her. **WHAT NOT TO WRITE.** Situation content: who she just killed, what she just stole, who is currently chasing her, where she just was, what mood she is in this scene, what she is currently carrying. Those things change scene to scene; the description does not. If the only "change" you would make is to summarize what just happened in the last few turns, that is precisely the case where you should NOT patch — the situation belongs in plot points and the storyline, not in who-she-is. Conversely, if the existing description ALREADY contains situation-summary, that IS a reason to patch (case b) — to clean it back into identity.

    Do NOT patch for transient mood shifts, momentary fatigue, the outcome of a single conversation, what she's wearing right now, what she's carrying, or anything that could plausibly reset by the next scene. Do NOT rewrite the description for style — only patch when the new wording carries new substance about WHO she is.

    The tool edits in place; there is no add/remove variant. Always write the COMPLETE replacement description, not a diff.

If you have nothing to change, respond with NO tool calls. A turn-summary text response is allowed but optional and ignored.`;

export interface BuildAnalysisOptions {
  /** Adventure setting / world block — primary grounding for invention. */
  settingDescription?: string;
  /** Optional persistent world bible if the user has authored one. */
  worldBible?: string;
}

export function buildAnalysisUserMessage(
  recentNarrative: string,
  liveWorldState: LiveWorldState,
  protagonist?: string,
  options: BuildAnalysisOptions = {},
): string {
  const stateBlock =
    formatLiveWorldState(liveWorldState, { includeIds: true }) ??
    "(empty — no characters, plot points, or agenda items yet)";

  const sections: string[] = [];

  // World grounding first so the model has the setting in mind when it
  // decides what to invent for new characters/plot points.
  const settingTrimmed = options.settingDescription?.trim();
  if (settingTrimmed) {
    sections.push(
      `[SETTING — the world this story takes place in]\n${settingTrimmed}`,
    );
  }
  const worldBibleTrimmed = options.worldBible?.trim();
  if (worldBibleTrimmed) {
    sections.push(
      `[WORLD BIBLE — persistent reference for the world, characters, and lore]\n${worldBibleTrimmed}`,
    );
  }

  // Protagonist block is shown verbatim. When the description is missing or
  // a thin stub, the analysis pass is the natural place to fold in concrete
  // details the narrative has now established (principle 10, case a).
  const protagonistTrimmed = protagonist?.trim();
  sections.push(
    protagonistTrimmed
      ? `[PROTAGONIST DESCRIPTION — currently set]\n${protagonistTrimmed}`
      : "[PROTAGONIST DESCRIPTION — not set]\n(no description on file. If the narrative has now established who the protagonist is in concrete terms, this is exactly the case where patch_protagonist should fill it in.)",
  );

  sections.push(`CURRENT WORLD STATE:\n\n${stateBlock}`);

  sections.push(
    `MOST RECENT NARRATIVE (the latest few turns of the story):\n\n${recentNarrative.trim()}`,
  );

  sections.push(
    `Read the narrative against the world above. Two distinct jobs:

(a) ADDS — if a meaningful new named character has appeared, or a clear new hook has been introduced, add them with a FULL entry. Invent the parts the narrative didn't spell out — backstory, personality, motive, disposition — grounded in the setting and the world bible. Be a novelist filling out a character sheet, not a stenographer.

(b) PATCHES — stay quiet unless something STANDING actually changed (a lasting relational shift, a plot-status advance, an agenda time-shift, a plot-point situation that has materially moved). Momentary reactions belong in the prose, not in patches. **Plot-point description refresh is part of this job, not separate from it:** if a tracker is destroyed, a hostage moved, a deadline tightened, an anonymous threat now has a name, evidence gained or lost — patch_plot_point the description even when the status holds. "Status didn't change" is not a reason to skip the patch when the description is now factually stale. **Identity catch-up — also mandatory:** if an existing roster entry uses a placeholder name ("the girl with zip ties", "the bartender", "Stranger") and the narrative has now revealed the real name or a defining identity detail, patch_character it immediately — update \`name\` and tighten \`description\` if the new identity reframes them. Same for placeholder-titled plot points.

When you patch, archive, or remove an entry, copy its id verbatim from the \`[id: ...]\` prefix in the world-state block above. Ids are opaque tokens — never invent one from a name, title, or description. If you cannot find a matching \`[id: ...]\` for the entry you want to change, treat it as not on file (use add_ instead) rather than guessing.`,
  );

  return sections.join("\n\n---\n\n");
}

export function buildAnalysisMessages(
  recentNarrative: string,
  liveWorldState: LiveWorldState,
  protagonist?: string,
  options: BuildAnalysisOptions = {},
): LLMMessage[] {
  return [
    { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
    {
      role: "user",
      content: buildAnalysisUserMessage(
        recentNarrative,
        liveWorldState,
        protagonist,
        options,
      ),
    },
  ];
}

// --- Conditions pass (physical-state ledger) ---

/**
 * System prompt for the conditions pass. A cheap, focused curator that
 * maintains a short ledger of the PHYSICAL state of the protagonist and the
 * named characters in the scene — the bodily facts that persist across turns
 * and that the narrative is liable to forget over a long adventure (a broken
 * wrist, a lost weapon, exhaustion, soaked clothes). Runs after each turn and
 * its output is injected into every narrative pass as a reminder.
 *
 * Deliberately narrow: injuries, stamina, intoxication, exposure, restraint,
 * senses, and gating gear ONLY. Everything else (relationships, motive, plot,
 * mood, recaps) is either another subsystem's job or belongs in the prose.
 */
export const CONDITIONS_SYSTEM_PROMPT = `You are the physical-state curator for an interactive adventure. You maintain a short ledger of the PHYSICAL condition of the protagonist and the named characters currently in the scene — the bodily facts that persist across turns and change what a character can actually DO, and that the prose is liable to forget over many turns.

You read the most recent narrative against the existing ledger and output the UPDATED ledger. Nothing else.

═══════════════════════════════════════════════════════════════════════════
WHAT BELONGS HERE — physical facts that persist across turns and gate action
═══════════════════════════════════════════════════════════════════════════
- Injuries and wounds: a broken wrist, a gash above the eye, a sprained ankle, a missing finger, cracked ribs, a limp.
- Exhaustion / stamina: bone-tired, winded, on the edge of collapse.
- Intoxication, poison, disease, mind-altering states: drunk, dosed, feverish, paralysed, hallucinating.
- Exposure: soaked to the bone, freezing, hypothermic, badly sunburnt.
- Restraint / position: bound, chained, prone, pinned, hidden, blindfolded.
- Senses: blinded, deafened.
- Gear that physically gates what they can do: unarmed, down to a knife, armoured, holding a torch, carrying the wounded child, encumbered.

═══════════════════════════════════════════════════════════════════════════
WHAT DOES NOT BELONG HERE — other subsystems track these, or they are ephemeral
═══════════════════════════════════════════════════════════════════════════
- Relationships, personality, motive, disposition, who trusts whom — that is the character roster's job, not yours.
- Plot, goals, plans, what is about to happen — plot points and agenda.
- Mood or emotion, UNLESS it has a physical component. ("afraid" alone is not here; "shaking so hard she cannot keep her grip" is.)
- Transient state that resets within a beat — a brief stumble, a passing remark, a momentary flinch.
- Recap of what a character just did — the prose already said it; do not parrot it here.

═══════════════════════════════════════════════════════════════════════════
FORMAT — a plain markdown list, one line per character, PROTAGONIST FIRST
═══════════════════════════════════════════════════════════════════════════
Each line:
- Name: the physical facts, separated by semicolons, terse and concrete.
Keep it to ONE line per character. No prose paragraphs, no headers, no preamble, no explanation.

Example:
- Maren (protagonist): left wrist broken & splinted; soaked through; exhausted; unarmed.
- Captain Voss: bleeding from a gash above the right eye; winded; cutlass drawn.
- The hound: limping on its right foreleg.

═══════════════════════════════════════════════════════════════════════════
UPDATING RULES
═══════════════════════════════════════════════════════════════════════════
- Read the recent narrative against the current ledger. ADD any new physical fact the narrative established. REMOVE any condition the narrative has now resolved or healed (a wound tended, exhaustion slept off, restraints cut, a weapon recovered). CARRY FORWARD everything in between UNCHANGED — that carry-forward is the entire reason this ledger exists.
- If a named character has left the scene, drop their line. If a new named character has entered the scene WITH a notable physical condition, add them.
- The protagonist is ALWAYS present — keep their line even when the rest of the cast is empty.
- Stay grounded in what the narrative actually showed. Do not invent injuries, and do not invent healing. When genuinely uncertain whether something resolved, KEEP it (a wrongly-dropped injury is worse than a wrongly-carried one).
- If a previously-listed condition has improved but not vanished, update it (e.g. "exhausted" → "winded; recovering"), do not simply drop it.

Output ONLY the updated ledger. No commentary, no wrapping prose. If there are genuinely no notable physical conditions for anyone, output a single line: "- (protagonist name): no notable conditions."`;

export interface BuildConditionsOptions {
  /** Adventure setting / world block — light grounding for genre/tone. */
  settingDescription?: string;
  /** Optional persistent world bible. */
  worldBible?: string;
}

/**
 * Build messages for the conditions pass. Modelled on the analysis pass: a
 * tight system prompt + a user message assembled from the protagonist, the
 * on-file named characters (if the living-world roster is available), the
 * current ledger, and the most recent narrative. Returns the updated ledger
 * text. Does NOT use the full shared history — physical state is grounded in
 * recent events, so we keep the prompt small and cheap.
 */
export function buildConditionsMessages(
  recentNarrative: string,
  currentConditions: string,
  protagonist?: string,
  liveWorldState?: LiveWorldState,
  options: BuildConditionsOptions = {},
): LLMMessage[] {
  const sections: string[] = [];

  // Light setting grounding — genre/tone helps the model judge what counts
  // as a physically-significant condition (a torch matters differently in a
  // cave than on a city street). Trimmed; conditions are grounded in the
  // recent narrative, not the setting bible.
  const settingTrimmed = options.settingDescription?.trim();
  if (settingTrimmed) {
    sections.push(`[SETTING — for context only]\n${settingTrimmed}`);
  }

  const protagonistTrimmed = protagonist?.trim();
  sections.push(
    protagonistTrimmed
      ? `[PROTAGONIST — who "the protagonist" refers to]\n${protagonistTrimmed}`
      : '[PROTAGONIST — who "the protagonist" refers to]\n(no description on file — refer to them as "the protagonist")',
  );

  // Named characters on file, when the living-world roster is available. Gives
  // the model the cast to track without it having to guess names.
  const activeChars = Object.values(liveWorldState?.characters ?? {}).filter(
    (c) => !c.archived,
  );
  if (activeChars.length > 0) {
    const lines = activeChars.map(
      (c) => `- ${c.name}: ${c.description?.trim() || "—"}`,
    );
    sections.push(
      `[NAMED CHARACTERS CURRENTLY ON FILE — track any of these who are in the scene]\n${lines.join("\n")}`,
    );
  }

  const prevTrimmed = currentConditions?.trim();
  sections.push(
    prevTrimmed
      ? `[CURRENT LEDGER — update this]\n${prevTrimmed}`
      : "[CURRENT LEDGER — none on file yet; start one.]",
  );

  sections.push(`[MOST RECENT NARRATIVE]\n${recentNarrative.trim()}`);

  sections.push(
    "Output the updated physical-state ledger now, following the format and rules in the system message. Protagonist first. Output ONLY the ledger — no preamble, no explanation.",
  );

  return [
    { role: "system", content: CONDITIONS_SYSTEM_PROMPT },
    { role: "user", content: sections.join("\n\n---\n\n") },
  ];
}

/**
 * Append a system message with the current physical-state ledger, if any.
 * Injected into the narrative passes alongside the live world state so the
 * model cannot quietly drop a character's injury, missing weapon, or
 * exhaustion across turns.
 */
function appendConditions(
  messages: LLMMessage[],
  conditions: string | undefined,
): void {
  const trimmed = conditions?.trim();
  if (!trimmed) return;
  messages.push({
    role: "system",
    content: `[CHARACTER CONDITIONS — physical state as of this turn. This is AUTHORITATIVE and the narrative MUST respect it: a character cannot use a limb that is broken or missing, cannot produce an item they do not have, cannot run or fight if they are exhausted or their leg is injured, cannot see if they are blinded. Carry every entry forward unless the narrative explicitly shows it resolved.]\n\n${trimmed}`,
  });
}

// --- Synthesis pass ---

/**
 * System prompt for the synthesis pass. Runs AFTER the analysis pass each
 * turn — analysis updates fragments (characters, plot points, agenda),
 * synthesis ties them together into a coherent narrative arc.
 *
 * The model sees the same shared history as the story generator (full
 * narrative including compactions, plus the world bible), and is then
 * asked to write a few paragraphs describing what is *actually* happening
 * across the whole story given the seeded plot points and the events so
 * far. The output is fed back into the narrative prompt as additional
 * context so the generator has a coherent throughline rather than just
 * disconnected plot-point fragments.
 */
export const SYNTHESIS_SYSTEM_PROMPT = `You are the story's behind-the-scenes architect. The narrative passes show what happens on screen; the analysis pass tracks visible characters and hooks; YOUR job is the hidden layer underneath — the WHO, WHY, and HOW that the story has been gesturing at without spelling out.

You see the full narrative so far (with older sections compacted), the world bible, the currently-tracked characters and plot points (the *visible fragments*), and — once one exists — the PREVIOUS storyline you produced. Your job is to keep that storyline current, not to rewrite it.

═══════════════════════════════════════════════════════════════════════════
LOCKED CANON — the most important rule on this page. Read it twice.
═══════════════════════════════════════════════════════════════════════════

Every concrete specific you have committed to in a previous storyline IS LOCKED CANON. It does not get re-rolled. It does not get replaced with a "better" version. It does not get superseded by a more dramatic alternative just because you thought of one. Once written, it is the truth of this world.

Specifics that are LOCKED once introduced:
- Named people (NPCs, factions members, off-screen figures, anyone with a proper name in the previous storyline)
- Named factions, organisations, guilds, agencies, networks, crews
- Roles and ranks ("the Accountant", "the magistrate", "the cleaner") — even when only the title was committed, that ROLE exists and is filled by the same person across passes
- Attributed motives — once you said "Verro is protecting silk-route money", Verro is protecting silk-route money in every subsequent pass
- Established relationships, chains of command, financial flows, methods of operation
- Geography, infrastructure, locations you've named

What this means in practice:
- If the previous storyline says "the sedan outside belongs to Ofori's field team — a driver named Kyle and an enforcer named Reese", then Kyle and Reese are who is in the sedan. They are NOT a different pair of people on the next pass. They are NOT replaced by Elara and Cobb because you decided Elara is more interesting. Kyle and Reese stay Kyle and Reese unless the on-screen narrative has explicitly shown them being killed, replaced, or otherwise written out.
- If you previously named the faction "the Veiled Hand", it does not become "the Pipeline" or "the Network" on this pass. It stays the Veiled Hand.
- If you previously said motive X drives faction Y, motive X still drives faction Y. You can ADD nuance ("…and increasingly, Z"), you cannot replace it.

The ONLY licenses to change a previously-committed specific:
1. The on-screen narrative has explicitly contradicted it (e.g. a named character died on-page, a faction was revealed to be a front for a different one in actual story prose). In this case, briefly acknowledge the change — "what we previously framed as X has been revealed to be Y" — rather than silently rewriting.
2. The previous storyline contained an internal contradiction that the new turns make untenable. Same rule: acknowledge the correction, don't ghost-edit.

Style drift / "I thought of a cooler name" / "more thematically interesting" are NOT valid reasons. If you find yourself replacing a previously-named NPC, faction, or motive without one of the two licenses above, STOP and keep the old version. This is the difference between accreting canon and reshuffling a deck.

═══════════════════════════════════════════════════════════════════════════

Be a worldbuilder, not a summarizer. The narrative shows that the protagonist has cracked open a human trafficking ring and is being hunted; that's the surface. The synthesis is the answer to: who runs the ring, why does it exist in this world, how does it operate, who profits, who is the hunt being coordinated by, what other threads of the world is it tangled with, what does success look like for the antagonists, what does it look like for the protagonist? It is the bible-of-the-current-arc. If a faction is implied, name it and describe how it works. If a power structure is implied, describe it. If motives are implied, attribute them to specific people or groups and explain what's driving them. If the world bible already tells you how something works, INTEGRATE that — don't ignore it; build on it.

EXTRAPOLATE FREELY, but COHERENTLY — and ONLY in the spaces canon hasn't filled yet. You are explicitly licensed to invent the unseen scaffolding — organizations, hierarchies, economics, history, motives, methods — as long as it fits the genre, the tone, the world bible, and what has actually been shown, AND it does not overwrite a previously-committed specific. New invention goes into UNFILLED gaps; it does not replace existing fill. A trafficking ring needs a structure, financiers, suppliers, fixers, corrupt officials, a market, a way of moving people, a way of silencing witnesses — but if a previous pass has already named the financier, that financier stays named and you build OUT from there into the parts that are still blank.

What to commit to invent (when relevant):
- **The antagonist machinery**: who runs it, the chain of command, the named figures (give them names if the story hasn't), the rank-and-file, the muscle, the money behind it, who they answer to.
- **The why**: not just "they hunt the protagonist" but WHY this matters to them — what they stand to lose, what political/economic/religious/personal stake makes this important enough to spend resources on.
- **The how**: methods, tradecraft, infrastructure. Where do they meet, how do they communicate, how do they enforce, where are the chokepoints.
- **The world it sits in**: who else knows, who tolerates it, who would oppose it if they knew, what laws or customs make it possible or invisible. What other factions and forces brush up against this situation.
- **The protagonist's position**: what they've actually exposed themselves to, what their realistic odds are, what allies and openings exist (named, even if not yet on screen).
- **The trajectory**: what would have to happen for this to escalate, resolve, or transform — and which way the wind is currently blowing.

RULES:
- Write in third person, present tense (this is META-text about the story, not the story itself).
- Three to five paragraphs of dense prose. This is allowed to be longer than a back-of-book blurb because it carries more freight — but tight, no padding.
- Stay consistent with: established narrative events, the world bible, the tracked characters' established personalities. Within those constraints, invent freely and concretely. Vague gestures ("a sinister organization") are a failure; specifics ("the Veiled Hand, a fixers' guild operating out of the dock wards under the patronage of magistrate Verro, financed by silk-route money laundered through the Sawn Coin") are the goal.
- If you've already committed to specifics in the previous storyline, KEEP them VERBATIM. Names stay names. Factions stay factions. Motives stay motives. Roles stay filled by the same person. Adjust by ADDING nuance and EXTENDING into blank space; never by replacing what was there. The picture must accrete, not flicker. (See LOCKED CANON above — this is the same rule, restated because models forget it.)
- If the latest turns have actually contradicted earlier assumptions or revealed new information, update accordingly — explicitly. "What looked like X is actually Y" is fair game.
- **NO-OP SHORTCUT**: If a previous storyline exists and nothing meaningful has changed since it was written — no new factions implied, no new motives revealed, no contradiction of prior assumptions, no new named figures with stakes, just a continuation of beats already covered — output the single token SAME (uppercase, on its own, nothing else). The previous storyline will be reused verbatim. Only rewrite when there is actually new architecture to commit to or revise. When in doubt, prefer SAME over a near-identical rewrite. SAME is forbidden when there is no previous storyline — write the first one in full.
- Output ONLY the storyline text (or SAME). No headers, no preamble, no "here is the synthesis", no XML tags.

If the story is too early for this kind of architecture (only an opening turn, nothing meaningful established yet), write one paragraph naming the immediate situation and the most plausible underlying shape of it — and stop there. Subsequent passes will fill it in as the story gives you more to anchor on.`;

export interface BuildSynthesisOptions {
  settingDescription?: string;
  worldBible?: string;
  /** The current storyline, if any — for incremental evolution. */
  previousStoryline?: string;
}

/**
 * Build the user message for a synthesis call. Lists the full live world
 * state (with ids omitted — synthesis is read-only) and the previous
 * storyline if any, then asks the model to produce the new storyline.
 *
 * The shared history (full narrative + world bible) is built separately
 * by `buildSynthesisMessages` so it can sit inside the cache prefix.
 */
export function buildSynthesisUserMessage(
  liveWorldState: LiveWorldState,
  options: BuildSynthesisOptions = {},
): string {
  const stateBlock =
    formatLiveWorldState(liveWorldState) ??
    "(no characters or plot points are tracked yet — work from the narrative alone)";

  const sections: string[] = [];

  sections.push(`CURRENT TRACKED STATE:\n\n${stateBlock}`);

  const prevTrimmed = options.previousStoryline?.trim();
  if (prevTrimmed) {
    sections.push(
      `[PREVIOUS STORYLINE — LOCKED CANON. Every named person, faction, role, and attributed motive in here is the truth of the world. You may ADD to it and EXTEND into spaces it left blank. You may NOT rename, replace, or substitute its specifics for "better" alternatives — that is a failure mode, not an improvement. If nothing meaningful has changed, output SAME.]\n\n${prevTrimmed}`,
    );
  } else {
    sections.push(
      "[PREVIOUS STORYLINE — none on file yet. Write the first one. SAME is not a valid response on the first pass.]",
    );
  }

  if (prevTrimmed) {
    sections.push(
      "Update the storyline now. STARTING POINT: the previous storyline above. Your output must preserve every named person, faction, role, and attributed motive from it verbatim — the same Kyle is still in the sedan, the same financier is still financing, the same magistrate is still on the take. You are extending the canon into blank space, not reshuffling it. If the latest turns have NOT meaningfully changed the hidden architecture, output the single token SAME on its own and nothing else — the previous storyline will be reused verbatim. Otherwise output the new storyline: three to five paragraphs of dense prose, third person present tense, covering the hidden architecture — who, why, how. New invention goes into gaps the previous storyline left open OR into parts where the new turns have actually shifted things. Stay consistent with the world bible and tracked characters. If you are about to rename or replace a previously-named NPC/faction/motive without an explicit on-screen contradiction, STOP — keep the old version. Output ONLY the storyline (or SAME) — no headers, no preamble.",
    );
  } else {
    sections.push(
      "Write the storyline now. Three to five paragraphs of dense prose, third person present tense. Cover the hidden architecture — who, why, how — not just what is visible on screen. Commit to specific names, factions, structures, and motives where the story implies them but has not yet shown them. Be deliberate: every name and faction you commit to here becomes LOCKED CANON for every subsequent pass, so pick names and motives you want to live with. Stay consistent with the world bible and tracked characters. Output ONLY the storyline — no headers, no preamble.",
    );
  }

  return sections.join("\n\n---\n\n");
}

/**
 * Build messages for a synthesis call. Uses the same shared history as the
 * story generator so the cache prefix is shared (the user is paying for it
 * either way). The synthesis system prompt and user message are appended
 * outside the cache breakpoint.
 */
export function buildSynthesisMessages(
  turns: AdventureTurn[],
  liveWorldState: LiveWorldState,
  settingDescription: string,
  compactions?: Record<string, AdventureCompaction>,
  options: BuildSynthesisOptions = {},
): LLMMessage[] {
  const messages = buildSharedHistory(
    turns,
    compactions,
    settingDescription,
    options.worldBible,
  );

  // The synthesis system message lives AFTER the cached prefix because the
  // shared history's first system message (BASE_SYSTEM_PROMPT + worldBible)
  // is the cache breakpoint we want to share with the story generator.
  messages.push({
    role: "system",
    content: SYNTHESIS_SYSTEM_PROMPT,
  });

  messages.push({
    role: "user",
    content: buildSynthesisUserMessage(liveWorldState, options),
  });

  return messages;
}

// --- Storyline gate pass ---

/**
 * System prompt for the storyline-gate pass. Runs BEFORE each narrative
 * pass. Takes the full author-side storyline plus the story so far, the
 * current world state, and (for resolution turns) the player's intended
 * action, and returns a turn-scoped BRIEF — only the slice of the arc
 * that is actually visible to the protagonist or genuinely needed to
 * shape the next beat. The narrative passes never see the full arc; they
 * only see this filtered brief, so the output of this pass is the *only*
 * channel through which arc information reaches story generation.
 *
 * The bias is hard toward saying nothing. An empty brief is a perfectly
 * good answer when no arc fact applies to this beat — the narrative pass
 * is fully capable of writing without help, and silence here costs us
 * nothing.
 */
export const STORYLINE_GATE_SYSTEM_PROMPT = `You are the gatekeeper between the author-side STORY ARC and the next narrative beat. The arc is hidden architecture — factions, hierarchies, motives, off-screen figures, methods. The narrator does not see the arc directly; the narrator only sees what you decide to forward. Your job is to decide what slice of the arc, if any, is RELEVANT or VISIBLE to the next beat, and emit just that slice as a tight brief.

Two categories of arc fact may make it into the brief:

(1) VISIBLE — Something the protagonist is about to perceive on-camera in the next beat, or has already learned and will be acting on. The protagonist has, or is about to have, a real in-story basis to know this. Items here are SAFE for the narrator to surface in description, dialogue, or interior monologue. Forward these AGGRESSIVELY: if the player's intended action will bring them face-to-face with something the arc describes, the arc's description of that thing IS visible context for this beat.

(2) INFORMING — Something off-camera that shapes the next beat without being named on-page: who is reacting behind the scenes, what pressures are converging, which NPCs would receive what calls, how the antagonist machinery would mobilise. The narrator must NOT name these things in prose, but knowing them lets NPC behaviour, ambient detail, and timing land coherently.

Tag each item with [VISIBLE] or [INFORMING] so the narrator knows which is which.

═══════════════════════════════════════════════════════════════════════════
WHEN TO FORWARD A FACT — read this carefully, the bias is wrong by default.
═══════════════════════════════════════════════════════════════════════════

Forward a fact as [VISIBLE] when ANY of the following is true:
- The player's action targets an entity the arc describes (a person, vehicle, location, object). The arc's description of that entity belongs in the brief — the protagonist is literally about to encounter it.
- The recent narrative has put the protagonist in a place, situation, or interaction the arc has details about. Those details are now in scene.
- The arc names a person, faction, or motive that is about to act in this beat in a way the protagonist will witness.
- An NPC the protagonist is talking to (or about to talk to) has a role/affiliation/motive in the arc — the arc's specifics about them are in scene.

Forward a fact as [INFORMING] when:
- An off-screen faction or figure in the arc would plausibly be reacting to recent events in a way that affects THIS beat's pressure / pacing / ambient detail. The reaction has to actually land on this beat — not "exists somewhere in the world right now."
- The arc establishes consequences that haven't reached the protagonist yet but ARE in motion toward this beat specifically.

═══════════════════════════════════════════════════════════════════════════
SCOPE — the brief is for THIS beat, not the whole arc.
═══════════════════════════════════════════════════════════════════════════

The brief is a turn-scoped slice. If the player is talking to two specific NPCs in a specific location, the brief is about THOSE NPCs, THAT location, and the pressures CONVERGING ON THAT EXCHANGE — not every other arc thread that happens to share a faction or financier.

A fact is OUT OF SCOPE for this beat (do NOT forward) when:
- It describes a different location's activity that isn't reaching this scene (a cleanup crew two blocks away, a sweep happening in different alleys).
- It describes a different character's parallel arc (someone else fled, someone else is being pursued) that isn't intersecting the protagonist's current interaction.
- It describes wider faction architecture (financial structure, monitoring channels, contract pre-sales, replacement fees) that doesn't directly shape what these specific NPCs in this specific scene will do or say.
- It's "world-building colour about the antagonist organisation" rather than "pressure landing on this beat."

Rule of thumb: if the fact's relevance to this beat requires more than one logical hop ("the Accountant is monitoring → therefore these guys feel watched → therefore they act careful"), it's probably out of scope unless that hop is unusually load-bearing for THIS exchange. Most arc detail does not survive that test on any given beat.

Output NONE only when:
- The next beat is genuinely disconnected from the arc — protagonist is alone, no arc-described entities are present or about to be present, no arc faction is acting on this beat.
- A quiet domestic / introspective beat with no antagonist pressure imminent.

In short: the question is "does the arc actually have anything to say about what is about to happen *in this specific exchange*?" If yes — forward only that slice. If no — NONE. Do NOT default to NONE when the arc clearly describes the thing the player is about to interact with; equally, do NOT dump the entire antagonist machinery just because one piece of it is in scene.

═══════════════════════════════════════════════════════════════════════════
WORKED EXAMPLES
═══════════════════════════════════════════════════════════════════════════

Scenario A: Arc says "the sedan outside belongs to Ofori's field team — driver Kyle, enforcer Reese, both former military contractors." Player intends "approach the sedan to see who's inside."
→ Correct output:
  [VISIBLE] The sedan holds Kyle (driver, ex-military) and Reese (enforcer, ex-military) — Ofori's field team.
  [INFORMING] They will not exit the sedan unless ordered; the transit center has cameras Ofori prefers to leave clean.
→ Wrong output: NONE. (The protagonist is walking up to the exact thing the arc describes; this is the canonical [VISIBLE] case.)

Scenario B: Arc establishes the trafficking ring's financier as "magistrate Verro, laundering silk-route money." Player intends "make breakfast in the safehouse." No arc-described entity is in or near the scene.
→ Correct output: NONE.
→ Wrong output: forwarding Verro's role anyway. (Nothing about breakfast pings the arc; silence is correct.)

Scenario C: Arc says "Ofori's network mobilises through three cell phones routed via burner exchanges in the dock ward." Player intends "ask the bartender if she's seen anyone making suspicious calls." The bartender is not in the arc, but the arc's communication method is the implicit answer to the protagonist's question.
→ Correct output:
  [INFORMING] Ofori's network communicates via burner-exchange cell phones routed through the dock ward — the kind of pattern a sharp bartender might have noticed.
→ The bartender's answer in the resolution can naturally lean on this without naming Ofori or the dock ward.

Scenario D: Arc names "Reese, an enforcer." Recent narrative shows the protagonist watching Reese exit a sedan. Player intends "follow Reese on foot at a distance."
→ Correct output:
  [VISIBLE] Reese is the enforcer the arc describes — ex-military contractor working under Ofori's field team.
  [INFORMING] If Reese is acting alone, Kyle stayed with the sedan per Ofori's "leave no digital trace" doctrine.

Scenario E (over-forwarding — the most common failure mode): The arc covers a wide trafficking ring — Ofori's field team (Kyle and Reese in the sedan), a separate retrieval crew chasing an escaped victim Leona several blocks south, a cleanup crew watching police rotations near a third location to recover a laptop, the Accountant's three monitoring channels, and the Memphis buyer's pre-sold contract. Player intends "approach the sedan and talk to Kyle and Reese."
→ Correct output:
  [VISIBLE] Kyle (driver) and Reese (enforcer) are Ofori's field team, both ex-military contractors.
  [INFORMING] They are under orders to observe and hold, not engage, until the Accountant authorises further action.
  [INFORMING] They will not exit the vehicle absent orders — Ofori avoids leaving digital traces in cameras-on public spaces.
→ Wrong output: also forwarding Leona's pursuit, the cleanup crew at Hawthorne, the Memphis buyer's contract, the Accountant's three monitoring channels, or replacement-fee economics. NONE of those land on a conversation at this sedan in this scene. The cleanup crew two blocks away is not a pressure on this exchange. Leona's flight is not a pressure on this exchange. The Memphis contract does not change what Kyle says next. Each item that doesn't directly shape THIS conversation is noise; cut it.
→ Heuristic check: re-read each item and ask "would removing this change how this specific exchange plays out?" If no, drop it.

═══════════════════════════════════════════════════════════════════════════
HARD RULES
═══════════════════════════════════════════════════════════════════════════

- Be terse. Each item is one short sentence. No prose paragraphs, no preamble, no headers, no closing remarks.
- Forward at most 5 items total across both categories. Pick the most directly relevant ones; leave the rest.
- Do not invent new arc detail. You are FILTERING, not synthesising. If the arc doesn't establish something, don't add it. Quote/paraphrase the arc, don't extend it.
- For [INFORMING] items, prefer phrasings like "off-screen, X is doing Y" or "X would be doing Y in the background" rather than language that sounds like the protagonist senses it.
- Do NOT echo the entire arc. The brief is a SLICE, not a summary. If you find yourself reproducing whole paragraphs, you're doing the wrong job.
- NONE is correct for genuinely-disconnected beats and ONLY for those. Defaulting to NONE because "I'm not sure" is a failure — make a call.

Output format:
- Either the literal string "NONE" on its own line, or
- 1-5 lines, each starting with "[VISIBLE]" or "[INFORMING]" followed by one short sentence.

That's it. No other shape. No JSON, no XML, no headers.`;

export interface BuildStorylineGateOptions {
  settingDescription?: string;
  worldBible?: string;
}

/**
 * Build the user message for the storyline-gate pass.
 *
 * Deliberately tight: just the storyline, the next-beat intent, and the
 * emit instruction. No live world state — that's already implicit in the
 * shared narrative history above, and including it again here put the
 * storyline several screens away from the actual question, diluting the
 * signal. The gate's job is "given the most recent narrative beat and
 * the player's next intent, what slice of the arc applies?" — and the
 * recent narrative + intent are all it needs to answer.
 */
function buildStorylineGateUserMessage(
  storyline: string,
  playerAction: string | null,
): string {
  const intentBlock =
    playerAction === null
      ? "[NEXT BEAT — world-step phase. No player action this beat; the world is reacting to the most recent resolution narrative shown in the history above. Filter the arc against what would plausibly bear on the world's reaction here.]"
      : `[NEXT BEAT — resolution phase. The player intends the following action; filter the arc against what would plausibly bear on resolving this action and its immediate consequences.]\n\n${playerAction}`;

  return [
    `[FULL STORY ARC — author-side architecture. Filter THIS against the next beat below.]\n\n<story-arc>\n${storyline.trim()}\n</story-arc>`,
    intentBlock,
    'Emit the brief now. Either "NONE" on its own, or up to 5 short lines tagged [VISIBLE] or [INFORMING]. Ask, for each candidate fact: "would this fact change how THIS specific beat plays out?" If yes, forward it. If it\'s arc detail about a different location, a different character\'s parallel thread, or wider faction architecture that doesn\'t directly land on this exchange — drop it, even if it feels thematically relevant. The brief is a turn-scoped slice, not a recap of the antagonist organisation. If the arc is genuinely disconnected from this beat, output NONE; do not output NONE merely because the question feels uncertain.',
  ].join("\n\n---\n\n");
}

/**
 * Build messages for the storyline-gate pass. Reuses the shared history
 * cache prefix (turns + setting + world bible) — the synthesis and
 * narrative passes both pay for it, so the gate gets a free ride. The
 * gate-specific system prompt and user message live outside the cached
 * prefix because they change every turn.
 *
 * Caller must ensure `storyline` is non-empty before calling; the engine
 * skips the gate entirely when there is no arc to filter.
 */
export function buildStorylineGateMessages(
  turns: AdventureTurn[],
  settingDescription: string,
  storyline: string,
  playerAction: string | null,
  compactions?: Record<string, AdventureCompaction>,
  options: BuildStorylineGateOptions = {},
): LLMMessage[] {
  const messages = buildSharedHistory(
    turns,
    compactions,
    settingDescription,
    options.worldBible,
  );

  messages.push({
    role: "system",
    content: STORYLINE_GATE_SYSTEM_PROMPT,
  });

  messages.push({
    role: "user",
    content: buildStorylineGateUserMessage(storyline, playerAction),
  });

  return messages;
}

/** Tool definitions for the analysis pass (OpenAI function-tool shape). */
export const ANALYSIS_TOOLS: ToolDefinition[] = [
  {
    name: "add_character",
    description:
      "Add a brand-new named character to the roster. Only use for a character who has spoken or taken meaningful action AND is not already on the roster (re-check existing names for variants).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: {
          type: "string",
          description: "Canonical name as it should appear in prose.",
        },
        description: {
          type: "string",
          description:
            "One paragraph describing WHO this character IS — identity, not situation. Cover: appearance, age range, build, voice, mannerisms, dress; personality; relevant skills, training, profession; defining background or relationships; the kind of person they are when nothing is happening to them. DO NOT summarize what they just did in this scene, what they're carrying, or how they're reacting right now — that is event-log content and belongs in the prose, not in the description. The description should remain true across many future scenes; recent events should not appear here.",
        },
        motive: {
          type: "string",
          description: "One sentence: what this character currently wants.",
        },
        disposition: {
          type: "string",
          enum: [...DISPOSITIONS],
          description:
            "Standing stance toward the protagonist on the 7-step scale: hatred → hostility → distrust → indifference → warmth → devotion → love. Pick the value that matches what the narrative has SHOWN of this character's relational stance — not their momentary mood. Default to `indifference` for strangers with no established feeling.",
        },
      },
      required: ["name", "description", "motive", "disposition"],
    },
  },
  {
    name: "patch_character",
    description:
      "Update one or more fields on an existing character. Omit fields that didn't change — they are left as-is. Use the exact id from the [id: ...] prefix in the world-state block; never invent an id from a name. IMPORTANT — name updates: if the existing entry uses a placeholder like 'the girl with zip ties', 'the bartender', 'Stranger', etc. and the narrative has since revealed the real name (or profession / role / defining identity), patch the `name` field to the real one immediately. Do not leave placeholders on the roster once the story has named the character.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: {
          type: "string",
          description:
            "The character id, copied verbatim from the [id: ...] prefix of the matching entry in the world-state block. NOT the character name.",
        },
        name: { type: "string" },
        description: {
          type: "string",
          description:
            "Replacement description (full text, not a diff). Same rules as add_character: identity, not situation. Appearance, personality, voice, skills, background, defining relationships — the durable WHO. Do NOT patch this just to summarize recent events; if the only update would be 'after X, she now...', skip the patch. If the existing description has drifted into situation-summary, DO patch to clean it back into identity.",
        },
        motive: { type: "string" },
        disposition: {
          type: "string",
          enum: [...DISPOSITIONS],
          description:
            "New disposition on the 7-step scale (hatred → hostility → distrust → indifference → warmth → devotion → love). Only patch when the narrative has established a STANDING shift — a relational change that will persist past this scene. Do NOT patch for momentary reactions, fleeting moods, or in-scene tactical shifts.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "archive_character",
    description:
      "Move a character off-screen (kept on file but not shown to the narrative model). Use when the character explicitly departs, dies, or otherwise leaves active play.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: {
          type: "string",
          description:
            "The character id, copied verbatim from the [id: ...] prefix in the world-state block. NOT the character name.",
        },
        reason: {
          type: "string",
          description: "One sentence why (for the activity log).",
        },
      },
      required: ["id", "reason"],
    },
  },
  {
    name: "add_plot_point",
    description:
      "Seed a new plot point — a clear, named hook the story is plausibly going to return to. Avoid for vague atmosphere or one-off observations.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "Short label." },
        description: {
          type: "string",
          description: "One paragraph describing the plot point.",
        },
        status: {
          type: "string",
          enum: ["seeded", "active", "resolving"],
          description: "Lifecycle stage. New plot points are usually `seeded`.",
        },
      },
      required: ["title", "description", "status"],
    },
  },
  {
    name: "patch_plot_point",
    description:
      'Update one or more fields on an existing plot point. TWO independent reasons to call this — either alone is sufficient: (a) STATUS ADVANCE — the lifecycle stage has shifted (seeded → active → resolving → resolved). (b) DESCRIPTION REFRESH — the situation inside the plot point has materially shifted (a key fact added, removed, or reframed by the narrative: tracker destroyed, hostage moved, deadline tightened, anonymous threat now has a face, evidence gained, ally lost) such that the existing description is now factually stale, EVEN IF the status itself does not change. Description-only patches are valid and common; do not skip them just because the status held. Do NOT patch for cosmetic rewrites of the same situation. To drop a plot point that has been abandoned or made impossible, call remove_plot_point instead — there is no "abandoned" status. Use the exact id from the [id: ...] prefix in the world-state block; never invent an id from a title.',
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: {
          type: "string",
          description:
            "The plot point id, copied verbatim from the [id: ...] prefix of the matching entry in the world-state block. NOT the plot point title.",
        },
        title: { type: "string" },
        description: {
          type: "string",
          description:
            "Replacement description — full text, not a diff. Use this when the situation inside the plot point has materially shifted (key fact added, removed, or reframed) and the current description is now factually stale, even if status is unchanged. Do not use for cosmetic rewrites of the same situation.",
        },
        status: {
          type: "string",
          enum: ["seeded", "active", "resolving", "resolved"],
        },
      },
      required: ["id"],
    },
  },
  {
    name: "remove_plot_point",
    description:
      "Drop a plot point entirely — use when the narrative has made the plot point impossible, irrelevant, or explicitly walked away from it. Removed plot points are gone, not archived. Do NOT use this for plot points that paid off — those are `resolved` via patch_plot_point.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: {
          type: "string",
          description:
            "The plot point id, copied verbatim from the [id: ...] prefix of the matching entry in the world-state block. NOT the plot point title.",
        },
        reason: {
          type: "string",
          description: "One sentence why (for the activity log).",
        },
      },
      required: ["id", "reason"],
    },
  },
  {
    name: "add_agenda_item",
    description:
      "Add a concrete, scheduled event the world has in motion (e.g. 'the watch arrives at midnight'). Use sparingly — agenda items are commitments the world WILL act on.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        description: {
          type: "string",
          description: "One sentence: what's about to happen.",
        },
        when: {
          type: "string",
          description: 'Soft timing, e.g. "in 30 minutes", "at midnight".',
        },
      },
      required: ["description", "when"],
    },
  },
  {
    name: "patch_agenda_item",
    description:
      "Update an existing agenda item — e.g. push back its timing or refine its description. Use the exact id from the [id: ...] prefix in the world-state block; never invent an id from the description.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: {
          type: "string",
          description:
            "The agenda item id, copied verbatim from the [id: ...] prefix of the matching entry in the world-state block. NOT a paraphrase of the description.",
        },
        description: { type: "string" },
        when: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "remove_agenda_item",
    description:
      "Remove an agenda item — either because it has happened in the narrative, or because the protagonist pre-empted it.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: {
          type: "string",
          description:
            "The agenda item id, copied verbatim from the [id: ...] prefix of the matching entry in the world-state block. NOT a paraphrase of the description.",
        },
        reason: {
          type: "string",
          description: "One sentence why (for the activity log).",
        },
      },
      required: ["id", "reason"],
    },
  },
  {
    name: "patch_protagonist",
    description:
      "Replace the protagonist's description in place. The description describes WHO the protagonist IS (identity), not what just happened to them (situation). Use in three cases: (a) IDENTITY CATCH-UP — the narrative has anchored appearance / age / build / voice / mannerisms / profession / training / background / defining relationships in ways the existing description doesn't capture; expand a stub like 'A young woman' or fill in an empty description. (b) IDENTITY CORRECTION — the existing description has drifted into situation-summary ('a paramedic now hunted by traffickers', 'a woman fleeing the warehouse'); rewrite it to describe the person and let the situation live in plot points / storyline. (c) FUNDAMENTAL IDENTITY CHANGE — permanent injury, profession change, transformation, gain/loss of a defining capability. NEVER patch to summarize recent events, mood, what they're carrying, or who they just killed — those are situation, not identity. If the only update you'd make is an event recap, do not patch. Always write the COMPLETE replacement description, not a diff.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        description: {
          type: "string",
          description:
            "The full new protagonist description — WHO they are, not what just happened. Cover identity content: appearance, age, build, voice, mannerisms, dress, personality, skills, training, profession, defining background and relationships. Exclude situation content: recent events, current pursuers, what they're carrying, this scene's mood. Write the COMPLETE replacement, not a diff or addition.",
        },
        reason: {
          type: "string",
          description:
            "One sentence: what in the narrative warrants this change (for the activity log).",
        },
      },
      required: ["description", "reason"],
    },
  },
];
