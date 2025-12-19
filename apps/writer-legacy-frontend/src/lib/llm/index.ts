import { Anthropic } from './anthropic'
import { Cerebras } from './cerebras'
import { Gemini } from './gemini'
import { Groq } from './groq'
import type { LlmInterface } from './llm-interface'
import { Ollama } from './ollama'
import { OpenAI } from './openai'

export const availableLLMs = ['groq', 'openai', 'anthropic', 'ollama', 'cerebras', 'gemini'] as const
export type LLMName = (typeof availableLLMs)[number]

export const llms: Record<LLMName, LlmInterface> = {
  groq: new Groq(),
  openai: new OpenAI(),
  anthropic: new Anthropic(),
  ollama: new Ollama(),
  cerebras: new Cerebras(),
  gemini: new Gemini(),
}
