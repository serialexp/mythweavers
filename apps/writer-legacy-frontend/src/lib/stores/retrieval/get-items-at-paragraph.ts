import { scenesState } from '../scenes'
import { getItemsInOrder } from '../tree'

export const getItemsAtParagraph = (paragraphId: string) => {
  const items: Record<string, number> = {}

  const treeScenes = getItemsInOrder('scene')
  const scenes = treeScenes.map((scene) => scenesState.scenes[scene.id])

  for (const scene of scenes) {
    for (const paragraph of scene.paragraphs) {
      if (paragraph.inventory_actions) {
        for (const action of paragraph.inventory_actions) {
          items[action.item_name] =
            action.type === 'add'
              ? (items[action.item_name] ?? 0) + action.item_amount
              : (items[action.item_name] ?? 0) - action.item_amount
        }
      }
      if (paragraph.id === paragraphId) {
        return items
      }
    }
  }
}
