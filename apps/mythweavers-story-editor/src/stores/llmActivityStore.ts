import { createSignal } from 'solid-js';
import type { LLMMessage, LLMGenerateResponse } from '../types/llm';
import type { TokenUsage } from '../types/core';

export interface LlmActivityEntry {
  id: string;
  timestamp: number;
  type: string;
  model?: string;
  provider?: string;
  durationMs?: number;
  requestMessages: LLMMessage[];
  response: string;
  usage?: TokenUsage;
  rawUsage?: LLMGenerateResponse['usage'];
  error?: string;
}

const MAX_ENTRIES = 200;

const [entries, setEntries] = createSignal<LlmActivityEntry[]>([]);
const [isOpen, setIsOpen] = createSignal(false);

export const llmActivityStore = {
  get entries() {
    return entries();
  },

  get isOpen() {
    return isOpen();
  },

  show() {
    setIsOpen(true);
  },

  hide() {
    setIsOpen(false);
  },

  toggle() {
    setIsOpen((prev) => !prev);
  },

  clear() {
    setEntries([]);
  },

  log(entry: LlmActivityEntry) {
    setEntries((prev) => {
      const next = [...prev, entry];
      if (next.length > MAX_ENTRIES) {
        next.splice(0, next.length - MAX_ENTRIES);
      }
      return next;
    });
  },
};
