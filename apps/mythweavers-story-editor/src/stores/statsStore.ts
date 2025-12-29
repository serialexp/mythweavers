import { nodeStore } from './nodeStore'

export const statsStore = {
  // Calculate word count statistics for scenes using pre-calculated wordCount values
  get wordCountStats() {
    const sceneNodes = nodeStore.nodesArray.filter((n) => n.type === 'scene')

    // Use the pre-calculated wordCount from each node (calculated locally from messages)
    const wordCounts = sceneNodes.map((node) => node.wordCount || 0).filter((count) => count > 0)

    if (wordCounts.length === 0) return { average: 0, max: 0 }

    const sum = wordCounts.reduce((a, b) => a + b, 0)
    const average = sum / wordCounts.length
    const max = Math.max(...wordCounts)

    return { average, max }
  },
}
