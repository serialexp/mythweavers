/**
 * AI rewrite presets for selection-based rewrites in the inline editor menu.
 *
 * Each preset operates on a substring within a single paragraph. The selected
 * text is the unit being rewritten; the containing paragraph (and optionally
 * surrounding paragraphs) is provided as context.
 *
 * The model is instructed to return ONLY the rewritten substring — no
 * surrounding context, no explanation, no quotes — so the result can be
 * dropped directly into the editor via `tr.replaceWith()`.
 */

export type RewritePresetId =
  | 'grammar'
  | 'show-dont-tell'
  | 'sensory'
  | 'style-polish'
  | 'perspective:first'
  | 'perspective:second'
  | 'perspective:third'

export interface RewritePreset {
  id: RewritePresetId
  /** Short label shown in the menu */
  label: string
  /** Tooltip / longer description */
  description: string
  /** System prompt — defines the LLM's role and constraints */
  system: string
}

/**
 * Common output contract appended to every system prompt — keeps the model
 * focused on returning ONLY the rewritten selection.
 */
const OUTPUT_CONTRACT = `
Output rules:
- Return ONLY the rewritten version of the text inside <selection>...</selection>.
- Do NOT include the surrounding <paragraph> context in your response.
- Do NOT add quotes, explanations, prefaces, or commentary.
- Preserve the original tense, point-of-view, and capitalization unless the preset explicitly tells you to change them.
- Preserve leading/trailing whitespace exactly as present in the selection.
- If the selection ends mid-sentence, the rewrite should also end mid-sentence — do not add punctuation that wasn't there.`

const PRESETS: Record<RewritePresetId, RewritePreset> = {
  grammar: {
    id: 'grammar',
    label: 'Grammar',
    description: 'Fix spelling and grammar without changing wording or meaning',
    system: `You are a copy editor. Correct spelling and grammar in the selected text only. Do not change word choice, sentence structure, tone, or meaning beyond what is required to fix errors. Do not "improve" prose — only fix mistakes. Do not change profanity.${OUTPUT_CONTRACT}`,
  },
  'show-dont-tell': {
    id: 'show-dont-tell',
    label: "Show, don't tell",
    description: 'Convert telling into showing — replace stated emotions and descriptions with sensory action',
    system: `You are a writing assistant. Rewrite the selected text to "show, don't tell": replace direct statements of emotions, traits, or descriptions with concrete actions, body language, dialogue, or sensory details that imply the same thing. Do not invent new events. Keep the length roughly the same. Preserve meaning, tense, and tone.${OUTPUT_CONTRACT}`,
  },
  sensory: {
    id: 'sensory',
    label: 'Sensory details',
    description: 'Add sight, sound, smell, taste, and touch to existing actions',
    system: `You are a writing assistant. Enhance the selected text by adding vivid sensory details (sight, sound, smell, taste, touch) to events and actions that are already present. Do NOT fabricate new events, actions, or characters. Keep additions concise and grounded — avoid purple prose. Preserve the original meaning, tense, and tone.${OUTPUT_CONTRACT}`,
  },
  'style-polish': {
    id: 'style-polish',
    label: 'Style polish',
    description: 'Restate more smoothly without changing meaning or tone',
    system: `You are a writing assistant. Restate the selected text more smoothly. Do NOT add new information, do NOT change the tense, and especially do NOT change the tone. The result should mean the same thing as the original — just better-flowing.${OUTPUT_CONTRACT}`,
  },
  'perspective:first': {
    id: 'perspective:first',
    label: '1st person',
    description: 'Convert to first-person perspective (I / me / my)',
    system: `You are a writing assistant. Convert the selected text to FIRST-PERSON perspective. Use "I", "me", "my", "we", "us", "our" for the viewpoint character. Convert reported thoughts and observations to be experienced directly by the narrator. Preserve tense, tone, and meaning. If the selection contains dialogue, leave the dialogue unchanged — only the surrounding narration changes perspective.${OUTPUT_CONTRACT}`,
  },
  'perspective:second': {
    id: 'perspective:second',
    label: '2nd person',
    description: 'Convert to second-person perspective (you / your)',
    system: `You are a writing assistant. Convert the selected text to SECOND-PERSON perspective. Address the viewpoint character as "you" / "your". Convert reported thoughts and observations to be experienced directly by "you". Preserve tense, tone, and meaning. If the selection contains dialogue, leave the dialogue unchanged — only the surrounding narration changes perspective.${OUTPUT_CONTRACT}`,
  },
  'perspective:third': {
    id: 'perspective:third',
    label: '3rd person',
    description: 'Convert to third-person perspective (he / she / they)',
    system: `You are a writing assistant. Convert the selected text to THIRD-PERSON perspective. Use "he", "she", "they", or the character's name for the viewpoint character. Convert any first-person or second-person narration into third-person observation. Preserve tense, tone, and meaning. If the selection contains dialogue, leave the dialogue unchanged — only the surrounding narration changes perspective.${OUTPUT_CONTRACT}`,
  },
}

/**
 * Look up a preset by ID. Accepts arbitrary strings so callers receiving
 * IDs from generic UI layers (where the preset list is opaque) can validate
 * at the boundary instead of casting.
 */
export function getRewritePreset(id: string): RewritePreset | undefined {
  return PRESETS[id as RewritePresetId]
}

export function listRewritePresets(): RewritePreset[] {
  return Object.values(PRESETS)
}

/**
 * Build the user message for an LLM call.
 *
 * The selected text is wrapped in <selection> and the containing paragraph
 * is wrapped in <paragraph> so the model can see local context (the words
 * before and after the selection within the same paragraph) without being
 * tempted to rewrite anything outside the selection.
 */
export function buildRewriteUserPrompt(selectedText: string, containingParagraph: string): string {
  // Trim only for the marker; pass the full original text inside the tags so the
  // model sees exact whitespace and can preserve it.
  return `Here is a paragraph from a story. Rewrite ONLY the portion inside <selection>...</selection>. The rest is provided as context.

<paragraph>
${containingParagraph}
</paragraph>

<selection>${selectedText}</selection>

Return only the rewritten selection.`
}
