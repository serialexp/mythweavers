import type { Story } from '@writer/shared'

/**
 * Prepares the input data for the checkStoryDifferences procedure
 * by extracting IDs and timestamps from the client's story state.
 */
export const prepareDifferenceInput = (story: Story) => {
  const clientNodes: Record<string, { modifiedAt: number; type: 'book' | 'arc' | 'chapter' | 'scene' }> = {}
  const clientParagraphs: Record<string, number> = {}

  // Add Books, Arcs, Chapters, Scenes
  for (const type of ['book', 'arc', 'chapter', 'scene'] as const) {
    const entities = story[type]
    if (entities) {
      for (const id in entities) {
        if (Object.hasOwn(entities, id)) {
          const entity = entities[id]
          if (entity?.modifiedAt) {
            clientNodes[id] = {
              modifiedAt:
                typeof entity.modifiedAt === 'string' ? Number.parseInt(entity.modifiedAt) : entity.modifiedAt,
              type: type,
            }
          }
        }
      }
    }
  }

  // Add Paragraphs (iterate through scenes)
  if (story.scene) {
    for (const sceneId in story.scene) {
      if (Object.hasOwn(story.scene, sceneId)) {
        const scene = story.scene[sceneId]
        if (scene?.paragraphs) {
          for (const paragraph of scene.paragraphs) {
            if (paragraph.id && paragraph.modifiedAt) {
              clientParagraphs[paragraph.id] =
                typeof paragraph.modifiedAt === 'string' ? Number.parseInt(paragraph.modifiedAt) : paragraph.modifiedAt
            }
          }
        }
      }
    }
  }

  return { clientNodes, clientParagraphs }
}
