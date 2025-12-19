import { Request, Response } from 'express'
import { prisma } from '../../lib/prisma'

export async function getNodes(req: Request, res: Response) {
  try {
    const { storyId } = req.params

    // Get all nodes for the story
    const nodes = await prisma.node.findMany({
      where: { storyId },
      orderBy: [{ parentId: 'asc' }, { order: 'asc' }],
    })

    // Calculate word counts for chapters
    const chapterNodes = nodes.filter((n) => n.type === 'chapter')
    const wordCounts: Record<string, number> = {}

    for (const chapter of chapterNodes) {
      const messages = await prisma.message.findMany({
        where: {
          storyId,
          nodeId: chapter.id,
          deleted: false,
          type: null, // Exclude chapter markers
        },
        select: { content: true },
      })

      const totalWords = messages.reduce((sum, msg) => {
        const words = msg.content.split(/\s+/).length
        return sum + words
      }, 0)

      wordCounts[chapter.id] = totalWords
    }

    // Add word counts to nodes
    const nodesWithCounts = nodes.map((node) => ({
      ...node,
      wordCount: wordCounts[node.id] || 0,
    }))

    res.json({ nodes: nodesWithCounts })
  } catch (error) {
    console.error('Error fetching nodes:', error)
    res.status(500).json({ error: 'Failed to fetch nodes' })
  }
}
