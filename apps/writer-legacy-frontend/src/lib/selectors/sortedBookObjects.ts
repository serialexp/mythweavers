import type { Node, Scene } from '@writer/shared'
import { createSelector } from 'reselect'
import { arcSelector } from './arcSelector'
import { bookSelector } from './bookSelector'
import { chaptersSelector } from './chapterSelector'
import { scenesSelector } from './scenesSelector'
import { selectedObjectSelector } from './selectedObjectSelector'
import { structureSelector } from './structureSelector'

export type SortedBookObject =
  | {
      type: 'chapter_header' | 'break'
      text: string
    }
  | {
      type: 'paragraph'
      text: string
      sceneId: string
      posted: boolean
      state: string
      paragraphId: string
    }
  | {
      type: 'summary'
      words: number
      aiWords: number
      books: number
      chapters: number
      scenes: number
    }

export const sortedBookObjectsFromRoot = (structure: Node[], scenes: Record<string, Scene>, rootId?: string) => {
  const stats = {
    words: 0,
    aiWords: 0,
    books: 0,
    chapters: 0,
    scenes: 0,
  }

  const objects: SortedBookObject[] = []
  let currentlySelected = 0
  // transform structure into a flat list of objects
  for (const bookNode of structure) {
    if (bookNode.id === rootId || rootId === undefined) {
      currentlySelected++
    }

    if (currentlySelected > 0) {
      stats.books++
    }
    for (const arcNode of bookNode.children ?? []) {
      if (arcNode.id === rootId || rootId === undefined || currentlySelected > 0) {
        currentlySelected++
      }

      for (const chapterNode of arcNode.children ?? []) {
        if (chapterNode.id === rootId || rootId === undefined || currentlySelected > 0) {
          currentlySelected++
        }
        if (currentlySelected > 0) {
          stats.chapters++
          objects.push({
            type: 'chapter_header',
            text: chapterNode.name,
          })
        }
        for (let index = 0; index < (chapterNode.children?.length ?? 0); index++) {
          const scene = chapterNode.children?.[index]
          if (!scene) continue

          if (scene.id === rootId || rootId === undefined || currentlySelected > 0) {
            currentlySelected++
          }

          if (currentlySelected > 0) {
            stats.scenes++
            for (const paragraph of scenes[scene.id].paragraphs) {
              stats.words += paragraph.state === 'ai' ? 0 : paragraph.text.split(' ').length
              stats.aiWords += paragraph.state === 'ai' ? paragraph.text.split(' ').length : 0
              objects.push({
                type: 'paragraph',
                text: paragraph.text,
                sceneId: scene.id,
                state: paragraph.state,
                posted: scenes[scene.id].posted ?? false,
                paragraphId: paragraph.id,
              })
            }
            if (index !== (chapterNode.children?.length ?? 0) - 1) {
              objects.push({
                type: 'break',
                text: '',
              })
            }
          }
          if (currentlySelected > 0) {
            currentlySelected--
          }
        }
        if (currentlySelected > 0) {
          currentlySelected--
        }
      }
      if (currentlySelected > 0) {
        currentlySelected--
      }
    }
    if (currentlySelected > 0) {
      currentlySelected--
    }
  }

  return {
    objects,
    stats,
  }
}

export const sortedBookObjects = createSelector(
  structureSelector,
  bookSelector,
  arcSelector,
  chaptersSelector,
  scenesSelector,
  selectedObjectSelector,
  (structure, _book, _arcs, _chapters, scenes, selected) => {
    if (!selected) return

    const { objects, stats } = sortedBookObjectsFromRoot(structure, scenes, selected.id)

    objects.unshift({
      type: 'summary',
      ...stats,
    })

    return objects
  },
)

export const allBookObjects = createSelector(
  structureSelector,
  bookSelector,
  arcSelector,
  chaptersSelector,
  scenesSelector,
  (structure, _book, _arcs, _chapters, scenes) => {
    const { objects, stats } = sortedBookObjectsFromRoot(structure, scenes)

    objects.unshift({
      type: 'summary',
      ...stats,
    })

    return objects
  },
)
