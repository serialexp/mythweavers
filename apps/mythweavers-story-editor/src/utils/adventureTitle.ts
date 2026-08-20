import type { LLMMessage } from '../types/llm'

export function cleanAdventureTitle(value: string): string {
  return value
    .trim()
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim()
    .replace(/^Title:?\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim()
    .slice(0, 60)
}

export function buildAdventureTitleMessages(worldSetting: string, startPrompt: string): LLMMessage[] {
  return [
    {
      role: 'user',
      content: `Generate a short, evocative title for an interactive adventure using both its persistent world setting and its opening situation.

WORLD SETTING:
${worldSetting.trim().slice(0, 1200)}

ADVENTURE START:
${startPrompt.trim().slice(0, 800)}

The title must be 2-5 words, specific to this adventure, and not merely the name of the setting. Respond with only the title, with no quotation marks, heading, or commentary.`,
    },
  ]
}
