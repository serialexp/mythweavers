import { createSelector } from 'reselect'
import { scenesSelector } from './scenesSelector'
import { selectedObjectSelector } from './selectedObjectSelector'
import { allBookObjects } from './sortedBookObjects'

export const itemsUntilParagraphSelector = createSelector(
  selectedObjectSelector,
  scenesSelector,
  allBookObjects,
  (selected, scenes, allBookObjects) => {
    const currentInventory: Record<string, number> = {}
    const selectedScene = selected?.type === 'scene' ? scenes[selected.id] : undefined

    if (!selectedScene || !selectedScene.selectedParagraph) return {}

    console.log('bookobjects', allBookObjects.length)
    for (const bookObject of allBookObjects) {
      if (bookObject.type === 'paragraph') {
        const scene = scenes[bookObject.sceneId]

        const paragraph = scene.paragraphs.find((p) => p.id === bookObject.paragraphId)

        for (const item of paragraph.inventory_actions || []) {
          console.log(paragraph.id, currentInventory)
          if (!currentInventory[item.item_name]) currentInventory[item.item_name] = 0
          currentInventory[item.item_name] += item.item_amount * (item.type === 'add' ? 1 : -1)
        }

        if (selectedScene.selectedParagraph === bookObject.paragraphId) {
          break
        }
      }
    }

    return currentInventory
  },
)
