import { prisma } from '../../lib/prisma'

export async function migrateStoryToNodes(storyId: string) {
  console.log(`Migrating story ${storyId} to node structure...`)

  try {
    // Get all existing chapters first
    const chapters = await prisma.chapter.findMany({
      where: { storyId },
      orderBy: { createdAt: 'asc' },
    })

    // If no chapters, nothing to migrate
    if (chapters.length === 0) {
      console.log('No chapters to migrate')
      return
    }

    // Get all chapter marker messages to determine order
    const chapterMarkers = await prisma.message.findMany({
      where: {
        storyId,
        type: 'chapter',
        deleted: false,
      },
      orderBy: { order: 'asc' },
    })

    // Create a map of chapter IDs to their order based on markers
    const chapterOrderMap = new Map<string, number>()
    chapterMarkers.forEach((marker, index) => {
      if (marker.chapterId) {
        chapterOrderMap.set(marker.chapterId, index)
      }
    })

    // Create or get default book
    let book = await prisma.node.findFirst({
      where: { storyId, type: 'book' },
    })

    if (!book) {
      book = await prisma.node.create({
        data: {
          storyId,
          parentId: null,
          type: 'book',
          title: 'Book 1',
          order: 0,
          expanded: true,
        },
      })
      console.log('Created book node')
    }

    // Create or get default arc
    let arc = await prisma.node.findFirst({
      where: { storyId, type: 'arc', parentId: book.id },
    })

    if (!arc) {
      arc = await prisma.node.create({
        data: {
          storyId,
          parentId: book.id,
          type: 'arc',
          title: 'Arc 1',
          order: 0,
          expanded: true,
        },
      })
      console.log('Created arc node')
    }

    // Create chapter nodes in the correct order
    const sortedChapters = chapters.sort((a, b) => {
      const orderA = chapterOrderMap.get(a.id) ?? 999
      const orderB = chapterOrderMap.get(b.id) ?? 999
      return orderA - orderB
    })

    let migratedCount = 0
    for (let i = 0; i < sortedChapters.length; i++) {
      const chapter = sortedChapters[i]

      // Check if node already exists for this chapter
      let chapterNode = await prisma.node.findUnique({
        where: { id: chapter.id },
      })

      if (!chapterNode) {
        // Create chapter node
        chapterNode = await prisma.node.create({
          data: {
            id: chapter.id, // Keep the same ID for easy migration
            storyId,
            parentId: arc.id,
            type: 'chapter',
            title: chapter.title,
            summary: chapter.summary,
            order: i,
            expanded: chapter.expanded,
            includeInFull: chapter.includeInFull,
            status: chapter.status,
          },
        })
        migratedCount++
        console.log(`Created node for chapter: ${chapter.title}`)
      }

      // Update messages to reference the node (even if node already existed)
      await prisma.message.updateMany({
        where: {
          storyId,
          chapterId: chapter.id,
          nodeId: null, // Only update if nodeId is not set
        },
        data: {
          nodeId: chapterNode.id,
        },
      })
    }

    console.log(`Migrated ${migratedCount} chapters to nodes`)

    // Delete all chapter marker messages
    await prisma.message.deleteMany({
      where: {
        storyId,
        type: 'chapter',
      },
    })

    // Reorder remaining messages
    const remainingMessages = await prisma.message.findMany({
      where: {
        storyId,
        deleted: false,
        type: null,
      },
      orderBy: { order: 'asc' },
    })

    // Update order to be continuous
    for (let i = 0; i < remainingMessages.length; i++) {
      await prisma.message.update({
        where: {
          storyId_id: {
            storyId,
            id: remainingMessages[i].id,
          },
        },
        data: { order: i },
      })
    }

    console.log(`Migration complete for story ${storyId}`)
  } catch (error) {
    console.error('Error migrating story:', error)
    throw error
  }
}
