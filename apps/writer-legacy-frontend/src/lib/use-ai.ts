import { instructions as baseAiInstructions, type instructions } from './ai-instructions.ts'
import { Anthropic } from './llm/anthropic.ts'
import { Cerebras } from './llm/cerebras.ts'
import { Gemini } from './llm/gemini.ts'
import { Groq } from './llm/groq.ts'
import { Ollama } from './llm/ollama.ts'
import { OpenAI } from './llm/openai.ts'
import { settingsState } from './stores/settings.ts'
import { storyState } from './stores/story.ts'
import { addAiCallLog } from './stores/ui.ts'

export async function useAi(
  kind: keyof typeof instructions,
  text: string | { text: string; canCache: boolean }[],
  addInstructions = true,
): Promise<string> {
  const aiSource = settingsState.aiSource
  const storyInstructions = storyState.story?.settings?.aiInstructions

  let fullText = ''
  if (Array.isArray(text)) {
    fullText = text.map((t) => t.text).join('\n\n')
  } else {
    fullText = text
  }

  let result = ''

  if (aiSource === 'openai') {
    const openai = new OpenAI()
    await openai.init()
    result = await openai.chat(kind, fullText, {
      additionalInstructions: addInstructions ? storyInstructions : undefined,
    })
  } else if (aiSource === 'groq') {
    const groq = new Groq()
    await groq.init()
    result = await groq.chat(kind, fullText, {
      additionalInstructions: addInstructions ? storyInstructions : undefined,
    })
  } else if (aiSource === 'cerebras') {
    const cerebras = new Cerebras()
    await cerebras.init()
    result = await cerebras.chat(kind, fullText, {
      additionalInstructions: addInstructions ? storyInstructions : undefined,
    })
  } else if (aiSource === 'anthropic') {
    const anthropic = new Anthropic()
    await anthropic.init()
    result = await anthropic.chat(kind, text, {
      additionalInstructions: addInstructions ? storyInstructions : undefined,
    })
  } else if (aiSource === 'ollama') {
    const ollama = new Ollama()
    await ollama.init()
    result = await ollama.chat(kind, fullText, {
      additionalInstructions: addInstructions ? storyInstructions : undefined,
    })
  } else if (aiSource === 'gemini') {
    const gemini = new Gemini()
    await gemini.init()
    result = await gemini.chat(kind, fullText, {
      additionalInstructions: addInstructions ? storyInstructions : undefined,
    })
  } else {
    throw new Error('Unsupported AI source')
  }

  let systemPromptLog = baseAiInstructions[kind]
  if (addInstructions && storyInstructions) {
    systemPromptLog = `${systemPromptLog}\n\n${storyInstructions}`
  }

  addAiCallLog({
    timestamp: Date.now(),
    kind: kind,
    systemPrompt: systemPromptLog,
    inputText: fullText,
    outputText: result,
    provider: aiSource,
    model: settingsState.aiModel,
  })

  // strip all the think tags
  result = result.replaceAll(/<think>[\s\S]*?<\/think>[\s]+/g, '')

  return result
}
