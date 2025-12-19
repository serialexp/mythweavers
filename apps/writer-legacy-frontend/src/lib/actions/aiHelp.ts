import axios from 'axios'
import type { HelpKind } from '../ai-instructions'
import { store } from '../store'

export async function aiHelp(kind: HelpKind, text: string, addInstructions = true) {
  const aiBackend = store.getState().base.aiBackend
  const aiInstructions = store.getState().story.settings?.aiInstructions
  return axios.post('/api/help', {
    kind: kind,
    method: aiBackend,
    timeout: 60000,
    text: (addInstructions ? `${aiInstructions}\n\n` : '') + text,
  })
}
